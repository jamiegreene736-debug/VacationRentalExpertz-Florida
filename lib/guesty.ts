import type { StaySearch } from "./stay-search";

const GUESTY_API_BASE = "https://open-api.guesty.com/v1";
const GUESTY_TOKEN_URL = "https://open-api.guesty.com/oauth2/token";
const TOKEN_SAFETY_WINDOW_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12_000;
const LISTING_FIELDS = [
  "_id",
  "title",
  "nickname",
  "address",
  "pictures",
  "amenities",
  "accommodates",
  "bedrooms",
  "bathrooms",
  "propertyType",
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

function safeImageUrl(value: unknown): string | undefined {
  const text = stringValue(value);
  if (!text) return undefined;
  try {
    const url = new URL(text);
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
  if (!isRecord(value)) return undefined;
  const picture: GuestyPicture = {
    thumbnail: safeImageUrl(value.thumbnail),
    regular: safeImageUrl(value.regular),
    original: safeImageUrl(value.original),
    caption: stringValue(value.caption),
  };
  return picture.thumbnail || picture.regular || picture.original ? picture : undefined;
}

function normalizeListing(value: unknown): GuestyListing | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value._id) ?? stringValue(value.id);
  const title = stringValue(value.title) ?? stringValue(value.nickname);
  if (!id || !title) return undefined;

  const address = isRecord(value.address) ? value.address : {};
  const publicDescription = isRecord(value.publicDescription)
    ? value.publicDescription
    : {};
  const prices = isRecord(value.prices) ? value.prices : {};
  const pictures = Array.isArray(value.pictures)
    ? value.pictures.map(normalizePicture).filter((item): item is GuestyPicture => Boolean(item))
    : [];
  const amenities = Array.isArray(value.amenities)
    ? value.amenities.map(stringValue).filter((item): item is string => Boolean(item))
    : [];
  const description = [
    publicDescription.summary,
    publicDescription.space,
    publicDescription.neighborhood,
  ].map(stripMarkup).filter(Boolean).join(" ") || undefined;

  return {
    id,
    title,
    nickname: stringValue(value.nickname),
    city: stringValue(address.city),
    state: stringValue(address.state),
    address: stringValue(address.full),
    pictures,
    amenities,
    accommodates: numberValue(value.accommodates),
    bedrooms: numberValue(value.bedrooms),
    bathrooms: numberValue(value.bathrooms),
    propertyType: stringValue(value.propertyType),
    description,
    nightlyPrice: numberValue(value.price) ?? numberValue(prices.basePrice),
    currency: stringValue(prices.currency),
  };
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
    scope: "open-api",
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
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
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
    active: "true",
    pmsActive: "true",
    listed: "true",
    limit: "100",
    sort: "title",
    fields: LISTING_FIELDS,
  });
  if (search.city) params.set("city", search.city);
  if (search.checkIn && search.checkOut) {
    params.set("available", JSON.stringify({
      checkIn: search.checkIn,
      checkOut: search.checkOut,
      minOccupancy: search.guests,
    }));
  }
  const tag = process.env.GUESTY_LISTING_TAG?.trim();
  if (tag) params.set("tags", tag);

  const data = await guestyFetch(`/listings?${params.toString()}`);
  if (!isRecord(data) || !Array.isArray(data.results)) {
    throw new GuestyRequestError("Guesty returned an invalid listings response.");
  }
  return data.results
    .map(normalizeListing)
    .filter((listing): listing is GuestyListing => Boolean(listing));
}

export async function getListing(id: string): Promise<GuestyListing | undefined> {
  if (!/^[a-f0-9]{24}$/i.test(id)) return undefined;
  credentials();
  try {
    const data = await guestyFetch(
      `/listings/${encodeURIComponent(id)}?fields=${encodeURIComponent(LISTING_FIELDS)}`,
    );
    return normalizeListing(data);
  } catch (error) {
    if (error instanceof GuestyNotFoundError) return undefined;
    if (error instanceof GuestyRequestError) throw error;
    return undefined;
  }
}
