/** Injectable fetch so URL ingestion can be unit-tested without the network. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

/**
 * Fetch the raw HTML of a job posting. The URL is provided by the USER (never by
 * untrusted content), so this is a direct GET. Returns the response body text;
 * throws on a non-2xx response. `fetchImpl` defaults to the global `fetch`.
 */
export async function fetchJobHtml(
  url: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
): Promise<string> {
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`failed to fetch job posting: ${url} responded ${res.status}`);
  }
  return res.text();
}
