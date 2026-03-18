/**
 * Query builder for the DKAN POST datastore endpoint.
 *
 * Open Payments uses a POST body with { conditions, properties, sorts, limit, offset }.
 * This is different from URL query params used by openFDA / EDGAR.
 */

export interface Condition {
  resource: string;
  property: string;
  value: string;
  operator: "=" | "LIKE" | ">=" | "<=" | "!=";
}

export interface QueryBody {
  conditions: Condition[];
  properties?: string[];
  sorts?: Array<{ property: string; order: "asc" | "desc" }>;
  limit: number;
  offset: number;
}

/** Exact equality condition. */
export function eq(property: string, value: string): Condition {
  return { resource: "t", property, value, operator: "=" };
}

/** LIKE pattern match. Wraps value in %...% for substring matching. */
export function like(property: string, pattern: string): Condition {
  const wrapped = pattern.startsWith("%") ? pattern : `%${pattern}%`;
  return { resource: "t", property, value: wrapped, operator: "LIKE" };
}

/** Greater than or equal. */
export function gte(property: string, value: string): Condition {
  return { resource: "t", property, value, operator: ">=" };
}

/** Less than or equal. */
export function lte(property: string, value: string): Condition {
  return { resource: "t", property, value, operator: "<=" };
}

/** Not equal. */
export function neq(property: string, value: string): Condition {
  return { resource: "t", property, value, operator: "!=" };
}

/** Build a complete query body for the DKAN POST endpoint. */
export function buildQuery(opts: {
  conditions: Condition[];
  properties?: string[];
  sorts?: Array<{ property: string; order: "asc" | "desc" }>;
  limit?: number;
  offset?: number;
}): QueryBody {
  return {
    conditions: opts.conditions,
    ...(opts.properties ? { properties: opts.properties } : {}),
    ...(opts.sorts ? { sorts: opts.sorts } : {}),
    limit: opts.limit ?? 25,
    offset: opts.offset ?? 0,
  };
}
