import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GuestyListing } from "./guesty";

const TOKEN_FILE = "guesty-token.json";
const LISTINGS_FILE = "guesty-listings.json";

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

interface StoredListings {
  savedAt: number;
  listings: GuestyListing[];
}

function configuredCacheDir(): string | undefined {
  const value = process.env.GUESTY_CACHE_DIR?.trim();
  return value || undefined;
}

async function canUseDir(dir: string): Promise<boolean> {
  try {
    await access(dir);
    return true;
  } catch {
    try {
      await mkdir(dir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }
}

async function cacheDirs(): Promise<string[]> {
  const dirs: string[] = [];
  const configured = configuredCacheDir();
  if (configured) dirs.push(configured);
  if (await canUseDir("/data")) dirs.push("/data");
  dirs.push("/tmp");
  return [...new Set(dirs)];
}

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return undefined;
  }
}

async function writeJson(dir: string, fileName: string, value: unknown): Promise<void> {
  if (!(await canUseDir(dir))) return;
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, JSON.stringify(value), { encoding: "utf8", mode: 0o600 });
}

function isStoredToken(value: unknown): value is StoredToken {
  if (!value || typeof value !== "object") return false;
  const record = value as StoredToken;
  return typeof record.accessToken === "string"
    && record.accessToken.trim().length > 0
    && typeof record.expiresAt === "number"
    && Number.isFinite(record.expiresAt);
}

function isStoredListings(value: unknown): value is StoredListings {
  if (!value || typeof value !== "object") return false;
  const record = value as StoredListings;
  return typeof record.savedAt === "number"
    && Number.isFinite(record.savedAt)
    && Array.isArray(record.listings);
}

export async function readStoredToken(): Promise<StoredToken | undefined> {
  let newest: StoredToken | undefined;
  for (const dir of await cacheDirs()) {
    const candidate = await readJson(path.join(dir, TOKEN_FILE));
    if (!isStoredToken(candidate)) continue;
    if (!newest || candidate.expiresAt > newest.expiresAt) newest = candidate;
  }
  return newest;
}

export async function writeStoredToken(token: StoredToken): Promise<void> {
  const dirs = await cacheDirs();
  await Promise.all(dirs.map((dir) => writeJson(dir, TOKEN_FILE, token).catch(() => undefined)));
}

export async function readStoredListings(): Promise<GuestyListing[] | undefined> {
  let newest: StoredListings | undefined;
  for (const dir of await cacheDirs()) {
    const candidate = await readJson(path.join(dir, LISTINGS_FILE));
    if (!isStoredListings(candidate)) continue;
    if (!newest || candidate.savedAt > newest.savedAt) newest = candidate;
  }
  return newest?.listings;
}

export async function writeStoredListings(listings: GuestyListing[]): Promise<void> {
  const payload: StoredListings = { savedAt: Date.now(), listings };
  const dirs = await cacheDirs();
  await Promise.all(dirs.map((dir) => writeJson(dir, LISTINGS_FILE, payload).catch(() => undefined)));
}
