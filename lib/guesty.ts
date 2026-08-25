import type { StaySearch } from "./stay-search";
import {
  readStoredListings,
  readStoredToken,
  writeStoredListings,
  writeStoredToken,
} from "./guesty-cache";
import {
  normalizeStayQuote,
  unavailableReasonFromGuestyError,
  type GuestyStayResult,
  type GuestyUnavailableStay,
} from "./guesty-quote";

export { bookingEngineUrlForStay, normalizeStayQuote } from "./guesty-quote";
export type {
  GuestyStayQuote,
  GuestyStayResult,
  GuestyUnavailableStay,
} from "./guesty-quote";

const GUESTY_API_BASE = "https://booking.guesty.com/api";
const GUESTY_TOKEN_URL = "https://booking.guesty.com/oauth2/token";
const TOKEN_SAFETY_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const LISTING_MEMORY_TTL_MS = 5 * 60 * 1000;
const LISTING_FIELDS = [
  "_id",
  "title",
  "nickname",
  "address",
  "pictures",
  "picture",
  "amenities",
  "accommodates",
  "bedrooms",
  "bathrooms",
  "propertyType",
  "tags",
  "publicDescription",
  "terms",
  "prices",
  "price",
].join(" ");

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

interface UnknownRecord {
  [key: string]: unknown;
}

export interface GuestyPicture {
  thumbnail?: string;
  regular?: string;
  large?: string;
  original?: string;
  caption?: string;
}

export interface GuestyListing {
  id: string;
  title: string;
  nickname?: string;
  city?: string;
  state?: string;
  address?: string;
  pictures: GuestyPicture[];
  amenities: string[];
  accommodates?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  tags: string[];
  description?: string;
  nightlyPrice?: number;
  currency?: string;
}

export class GuestyConfigurationError extends Error {
  constructor() {
    super("Guesty is not configured for this website.");
    this.name = "GuestyConfigurationError";
  }
}

export class GuestyRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestyRequestError";
  }
}

class GuestyUnavailableError extends GuestyRequestError {
  constructor(readonly reason: GuestyUnavailableStay["reason"]) {
    super("The listing is unavailable for this stay.");
    this.name = "GuestyUnavailableError";
  }
}

export class GuestyNotFoundError extends Error {
  constructor() {
    super("The requested Guesty listing was not found.");
    this.name = "GuestyNotFoundError";
  }
}

let tokenCache: TokenCache | undefined;
let tokenInFlight: Promise<string> | undefined;
let listingMemory:
  | { expiresAt: number; key: string; listings: GuestyListing[] }
  | undefined;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function tagValue(value: unknown): string | undefined {
  if (typeof value === "string") return stringValue(value);
  if (!isRecord(value)) return undefined;
  return stringValue(value.name) ?? stringValue(value.label) ?? stringValue(value.value);
}

function safeImageUrl(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function stripMarkup(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePicture(value: unknown): GuestyPicture | undefined {
  if (typeof value === "string") {
    const url = safeImageUrl(value);
    return url ? { original: url } : undefined;
  }
  if (!isRecord(value)) return undefined;
  const picture: GuestyPicture = {
    thumbnail: safeImageUrl(value.thumbnail),
    regular: safeImageUrl(value.regular),
    large: safeImageUrl(value.large),
    original: safeImageUrl(value.original),
    caption: stringValue(value.caption),
  };
  return picture.thumbnail || picture.regular || picture.large || picture.original
    ? picture
    : undefined;
}

function pictureList(value: unknown): GuestyPicture[] {
  if (Array.isArray(value)) {
    return value.map(normalizePicture).filter((item): item is GuestyPicture => Boolean(item));
  }
  const single = normalizePicture(value);
  return single ? [single] : [];
}

function listingPayload(value: unknown): unknown {
  if (isRecord(value) && isRecord(value.listing)) return value.listing;
  return value;
}

function normalizeListing(value: unknown): GuestyListing | undefined {
  const payload = listingPayload(value);
  if (!isRecord(payload)) return undefined;
  const id = stringValue(payload._id) ?? stringValue(payload.id);
  const title = stringValue(payload.title) ?? stringValue(payload.nickname);
  if (!id || !title) return undefined;

  const address = isRecord(payload.address) ? payload.address : {};
  const publicDescription = isRecord(payload.publicDescription)
    ? payload.publicDescription
    : {};
  const prices = isRecord(payload.prices) ? payload.prices : {};
  const pictures = [
    ...pictureList(payload.pictures),
    ...pictureList(payload.picture),
    ...pictureList(payload.photos),
    ...pictureList(payload.images),
  ].filter((picture, index, all) => {
    const key = picture.regular ?? picture.large ?? picture.original ?? picture.thumbnail;
    return Boolean(key) && all.findIndex((item) => (
      (item.regular ?? item.large ?? item.original ?? item.thumbnail) === key
    )) === index;
  });
  const amenities = Array.isArray(payload.amenities)
    ? payload.amenities.map(stringValue).filter((item): item is string => Boolean(item))
    : [];
  const tags = Array.isArray(payload.tags)
    ? payload.tags.map(tagValue).filter((item): item is string => Boolean(item))
    : [];
  const description = [
    publicDescription.summary,
    publicDescription.space,
    publicDescription.neighborhood,
  ].map(stripMarkup).filter(Boolean).join(" ") || undefined;

  return {
    id,
    title,
    nickname: stringValue(payload.nickname),
    city: stringValue(address.city),
    state: stringValue(address.state),
    address: stringValue(address.full),
    pictures,
    amenities,
    accommodates: numberValue(payload.accommodates),
    bedrooms: numberValue(payload.bedrooms),
    bathrooms: numberValue(payload.bathrooms),
    propertyType: stringValue(payload.propertyType),
    tags,
    description,
    nightlyPrice: numberValue(payload.price) ?? numberValue(prices.basePrice),
    currency: stringValue(prices.currency),
  };
}

export function isCondoListing(listing: GuestyListing): boolean {
  const propertyType = listing.propertyType?.toLocaleLowerCase() ?? "";
  const condoTag = process.env.GUESTY_CONDO_TAG?.trim().toLocaleLowerCase();
  if (propertyType.includes("condo")) return true;
  if (condoTag) return listing.tags.some((tag) => tag.toLocaleLowerCase() === condoTag);
  return false;
}

function matchesOptionalFilters(listing: GuestyListing, search: StaySearch): boolean {
  const listingTag = process.env.GUESTY_LISTING_TAG?.trim().toLocaleLowerCase();
  if (listingTag && !listing.tags.some((tag) => tag.toLocaleLowerCase() === listingTag)) {
    return false;
  }

  const condoTag = process.env.GUESTY_CONDO_TAG?.trim();
  if (condoTag && !isCondoListing(listing)) return false;

  if (search.city) {
    const city = listing.city?.toLocaleLowerCase() ?? "";
    if (!city.includes(search.city.toLocaleLowerCase())) return false;
  }

  return true;
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GUESTY_CLIENT_ID?.trim();
  const clientSecret = process.env.GUESTY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new GuestyConfigurationError();
  return { clientId, clientSecret };
}

function rememberToken(token: TokenCache): string {
  tokenCache = token;
  void writeStoredToken(token);
  return token.accessToken;
}

async function requestToken(): Promise<string> {
  const stored = await readStoredToken();
  if (stored && stored.expiresAt > Date.now()) {
    tokenCache = stored;
    return stored.accessToken;
  }

  const { clientId, clientSecret } = credentials();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "booking_engine:api",
    client_id: clientId,
    client_secret: clientSecret,
  });
  let response: Response;

  try {
    response = await fetch(GUESTY_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Guesty token request failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    if (stored) {
      tokenCache = stored;
      return stored.accessToken;
    }
    throw new GuestyRequestError("The property service is temporarily unavailable.");
  }

  if (!response.ok) {
    console.error("Guesty token request rejected", { status: response.status });
    if (stored) {
      tokenCache = stored;
      return stored.accessToken;
    }
    throw new GuestyRequestError("The property service could not be authenticated.");
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || !stringValue(data.access_token)) {
    throw new GuestyRequestError("Guesty returned an invalid authentication response.");
  }

  const expiresIn = numberValue(data.expires_in) ?? 86_400;
  return rememberToken({
    accessToken: data.access_token as string,
    expiresAt: Date.now() + expiresIn * 1000 - TOKEN_SAFETY_WINDOW_MS,
  });
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.accessToken;
  if (!tokenInFlight) {
    tokenInFlight = requestToken().finally(() => {
      tokenInFlight = undefined;
    });
  }
  return tokenInFlight;
}

async function guestyFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${GUESTY_API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Guesty API request failed", {
      path: path.split("?")[0],
      reason: error instanceof Error ? error.name : "unknown",
    });
    throw new GuestyRequestError("The property service is temporarily unavailable.");
  }

  if (response.status === 404) throw new GuestyNotFoundError();
  if (!response.ok) {
    if (response.status === 400 && path === "/reservations/quotes") {
      const payload: unknown = await response.json().catch(() => undefined);
      const reason = unavailableReasonFromGuestyError(payload);
      if (reason) throw new GuestyUnavailableError(reason);
    }
    console.error("Guesty API request rejected", {
      path: path.split("?")[0],
      status: response.status,
    });
    throw new GuestyRequestError("The property service returned an error.");
  }

  return response.json();
}

function searchKey(search: StaySearch): string {
  return JSON.stringify({
    city: search.city ?? "",
    checkIn: search.checkIn ?? "",
    checkOut: search.checkOut ?? "",
    guests: search.guests,
  });
}

function parseListingResults(data: unknown): GuestyListing[] {
  const results = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.results)
      ? data.results
      : undefined;
  if (!results) {
    throw new GuestyRequestError("Guesty returned an invalid listings response.");
  }

  return results
    .map(normalizeListing)
    .filter((listing): listing is GuestyListing => Boolean(listing));
}

export function isGuestyConfigured(): boolean {
  return Boolean(
    process.env.GUESTY_CLIENT_ID?.trim() && process.env.GUESTY_CLIENT_SECRET?.trim(),
  );
}

export async function getListingStayQuote(input: {
  listingId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
}): Promise<GuestyStayResult> {
  credentials();
  if (!/^[a-f0-9]{24}$/i.test(input.listingId)) {
    throw new GuestyRequestError("The requested listing is invalid.");
  }

  let data: unknown;
  try {
    data = await guestyFetch("/reservations/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: input.listingId,
        checkInDateLocalized: input.checkIn,
        checkOutDateLocalized: input.checkOut,
        guestsCount: input.guests,
      }),
    });
  } catch (error) {
    if (error instanceof GuestyUnavailableError) {
      return { available: false, reason: error.reason };
    }
    throw error;
  }
  try {
    return normalizeStayQuote(data, input.checkIn, input.checkOut, input.guests);
  } catch (error) {
    console.error("Guesty quote response could not be normalized", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    throw new GuestyRequestError("Guesty returned an invalid quote response.");
  }
}

export async function getListings(search: StaySearch): Promise<GuestyListing[]> {
  credentials();
  const key = searchKey(search);
  if (listingMemory && listingMemory.key === key && listingMemory.expiresAt > Date.now()) {
    return listingMemory.listings;
  }

  const params = new URLSearchParams({
    limit: "100",
    fields: LISTING_FIELDS,
  });
  if (search.checkIn && search.checkOut) {
    params.set("checkIn", search.checkIn);
    params.set("checkOut", search.checkOut);
    params.set("minOccupancy", String(search.guests));
  }

  try {
    const listings = parseListingResults(await guestyFetch(`/listings?${params.toString()}`))
      .filter((listing) => matchesOptionalFilters(listing, search));
    listingMemory = {
      key,
      listings,
      expiresAt: Date.now() + LISTING_MEMORY_TTL_MS,
    };
    if (!search.checkIn && !search.checkOut) {
      void writeStoredListings(listings);
    }
    return listings;
  } catch (error) {
    const stored = (await readStoredListings() ?? [])
      .filter((listing) => matchesOptionalFilters(listing, search));
    if (stored.length > 0) return stored;
    throw error;
  }
}

export async function getListing(id: string): Promise<GuestyListing | undefined> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return undefined;
  credentials();
  try {
    const data = await guestyFetch(
      `/listings/${encodeURIComponent(id)}?fields=${encodeURIComponent(LISTING_FIELDS)}`,
    );
    const listing = normalizeListing(data);
    return listing && matchesOptionalFilters(listing, { guests: 1 }) ? listing : undefined;
  } catch (error) {
    if (error instanceof GuestyNotFoundError) return undefined;
    const stored = (await readStoredListings() ?? []).find((listing) => listing.id === id);
    if (stored) return stored;
    if (error instanceof GuestyRequestError) throw error;
    return undefined;
  }
}
