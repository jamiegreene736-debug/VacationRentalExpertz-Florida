import type { StaySearch } from "./stay-search";

const GUESTY_API_BASE = "https://booking.guesty.com/api";
const GUESTY_TOKEN_URL = "https://booking.guesty.com/oauth2/token";
const TOKEN_SAFETY_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
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

export class GuestyNotFoundError extends Error {
  constructor() {
    super("The requested Guesty listing was not found.");
    this.name = "GuestyNotFoundError";
  }
}

let tokenCache: TokenCache | undefined;

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

async function requestToken(): Promise<string> {
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
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Guesty token request failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    throw new GuestyRequestError("The property service is temporarily unavailable.");
  }

  if (!response.ok) {
    console.error("Guesty token request rejected", { status: response.status });
    throw new GuestyRequestError("The property service could not be authenticated.");
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || !stringValue(data.access_token)) {
    throw new GuestyRequestError("Guesty returned an invalid authentication response.");
  }

  const expiresIn = numberValue(data.expires_in) ?? 86_400;
  tokenCache = {
    accessToken: data.access_token as string,
    expiresAt: Date.now() + expiresIn * 1000 - TOKEN_SAFETY_WINDOW_MS,
  };
  return tokenCache.accessToken;
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.accessToken;
  return requestToken();
}

async function guestyFetch(path: string, retryAfterUnauthorized = true): Promise<unknown> {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${GUESTY_API_BASE}${path}`, {
      headers: {
        Accept: "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    console.error("Guesty API request failed", {
      path: path.split("?")[0],
      reason: error instanceof Error ? error.name : "unknown",
    });
    throw new GuestyRequestError("The property service is temporarily unavailable.");
  }

  if (response.status === 401 && retryAfterUnauthorized) {
    tokenCache = undefined;
    return guestyFetch(path, false);
  }
  if (response.status === 404) throw new GuestyNotFoundError();
  if (!response.ok) {
    console.error("Guesty API request rejected", {
      path: path.split("?")[0],
      status: response.status,
    });
    throw new GuestyRequestError("The property service returned an error.");
  }

  return response.json();
}

export function isGuestyConfigured(): boolean {
  return Boolean(
    process.env.GUESTY_CLIENT_ID?.trim() && process.env.GUESTY_CLIENT_SECRET?.trim(),
  );
}

export function bookingEngineUrl(): string | undefined {
  const configuredUrl = process.env.GUESTY_BOOKING_ENGINE_URL?.trim();
  if (!configuredUrl) return undefined;
  try {
    const url = new URL(configuredUrl);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export async function getListings(search: StaySearch): Promise<GuestyListing[]> {
  credentials();
  const params = new URLSearchParams({
    limit: "100",
    fields: LISTING_FIELDS,
  });
  if (search.checkIn && search.checkOut) {
    params.set("checkIn", search.checkIn);
    params.set("checkOut", search.checkOut);
    params.set("minOccupancy", String(search.guests));
  }

  const data = await guestyFetch(`/listings?${params.toString()}`);
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
    .filter((listing): listing is GuestyListing => Boolean(listing))
    .filter((listing) => matchesOptionalFilters(listing, search));
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
    if (error instanceof GuestyRequestError) throw error;
    return undefined;
  }
}
