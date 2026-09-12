export function tryParseUrl(url: string | null | undefined): URL | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function parseHostname(url: string | null | undefined): string {
  const parsed = tryParseUrl(url);
  return parsed ? parsed.hostname.toLowerCase() : '';
}
