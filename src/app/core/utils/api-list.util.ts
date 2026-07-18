/**
 * Some list endpoints wrap their array one level deeper than the standard
 * envelope — `{ data: { data: [...] } }` instead of `{ data: [...] }` — and
 * this has varied inconsistently between endpoints on the same backend
 * (confirmed on /tasks/pending, /tasks/work, /documents). Normalizes either
 * shape to a plain array so a template `@for`/`*ngFor` never gets handed a
 * non-iterable object (which throws "newCollection[Symbol.iterator] is not
 * a function" and silently wrecks the whole component's rendering).
 */
export function asArray<T>(data: T[] | { data: T[] } | null | undefined): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { data: T[] }).data)) return (data as { data: T[] }).data;
  return [];
}

/**
 * Same problem as asArray(), for a single object instead of a list: some
 * endpoints return the object directly as documented, others wrap it one
 * level deeper as `{ data: {...} }` — confirmed inconsistent even within a
 * single endpoint's own spec (see dpdp.service.ts). `sentinelKey` is a
 * property that only exists on the real object, used to tell which shape
 * the response actually is.
 */
export function unwrapObject<T extends object>(res: unknown, sentinelKey: keyof T): T {
  if (res && typeof res === 'object' && sentinelKey in res) return res as T;
  const inner = (res as { data?: unknown } | null)?.data;
  if (inner && typeof inner === 'object' && sentinelKey in inner) return inner as T;
  return res as T;
}
