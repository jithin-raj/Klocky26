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
