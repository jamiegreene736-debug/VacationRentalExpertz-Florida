const windows = new Map<string, number[]>();

export function requestClientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

/** Best-effort per-instance abuse control; Guesty still enforces account limits. */
export function allowRequest(
  bucket: string,
  client: string,
  maximum: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const key = `${bucket}:${client}`;
  const recent = (windows.get(key) ?? []).filter((at) => now - at < windowMs);
  if (recent.length >= maximum) {
    windows.set(key, recent);
    return false;
  }
  recent.push(now);
  windows.set(key, recent);
  return true;
}
