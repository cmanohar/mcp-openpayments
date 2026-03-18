/**
 * Rate-limited HTTP fetcher for CMS Open Payments DKAN API.
 *
 * Key difference from mcp-openfda/mcp-edgar: this uses POST requests,
 * not GET. The DKAN datastore/query endpoint expects a JSON body.
 *
 * No API key required — Open Payments data is fully public.
 */

import type { QueryBody } from "./query-builder.js";

const BASE_URL = "https://openpaymentsdata.cms.gov/api/1";
const USER_AGENT = "mcp-openpayments/0.1.0 (MCP server for CMS Open Payments data)";

// Token bucket: 10 req/s (conservative; no published rate limit)
const RATE = 10;
let tokens = RATE;
let lastRefill = Date.now();

function refillTokens(): void {
  const now = Date.now();
  const elapsed = now - lastRefill;
  if (elapsed > 0) {
    tokens = Math.min(RATE, tokens + (elapsed / 1000) * RATE);
    lastRefill = now;
  }
}

async function waitForToken(): Promise<void> {
  refillTokens();
  if (tokens >= 1) {
    tokens -= 1;
    return;
  }
  const waitMs = ((1 - tokens) / RATE) * 1000;
  await new Promise((resolve) => setTimeout(resolve, Math.ceil(waitMs)));
  refillTokens();
  tokens -= 1;
}

export interface DkanResponse {
  count: number;
  results: Record<string, string>[];
  schema: Record<string, unknown>;
  query: Record<string, unknown>;
}

/**
 * POST to the DKAN datastore query endpoint with rate limiting.
 */
async function opFetch(url: string, body: object): Promise<Response> {
  await waitForToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return res;
}

/**
 * POST a query to a distribution and parse JSON response.
 * Retries once on 429.
 */
export async function opFetchJson(
  distributionId: string,
  body: QueryBody,
): Promise<DkanResponse> {
  const url = `${BASE_URL}/datastore/query/${distributionId}`;

  let res = await opFetch(url, body);

  // Retry once on 429
  if (res.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    res = await opFetch(url, body);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Open Payments API error: ${res.status} ${res.statusText} — POST ${url}\n${text}`,
    );
  }

  return (await res.json()) as DkanResponse;
}

/**
 * Paginate through results (500 per page) up to maxRecords.
 * Returns the total count and all collected results.
 */
export async function opFetchAll(
  distributionId: string,
  body: QueryBody,
  maxRecords: number = 2000,
): Promise<{ count: number; results: Record<string, string>[] }> {
  const pageSize = Math.min(body.limit, 500);
  const firstBody = { ...body, limit: pageSize, offset: 0 };
  const first = await opFetchJson(distributionId, firstBody);

  const allResults = [...first.results];
  const total = first.count;

  // Page through remaining results up to maxRecords
  let offset = pageSize;
  while (offset < total && allResults.length < maxRecords) {
    const nextBody = { ...body, limit: pageSize, offset };
    const next = await opFetchJson(distributionId, nextBody);
    allResults.push(...next.results);
    offset += pageSize;
  }

  return { count: total, results: allResults.slice(0, maxRecords) };
}
