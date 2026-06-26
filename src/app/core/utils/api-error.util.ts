/**
 * Extracts a human-readable message from an HttpErrorResponse-shaped error.
 *
 * The standard envelope is `{ data, status, message }`. Validation errors put
 * field details under `data.error` as `{ field: string[] }`. Business-rule
 * errors (e.g. EMPLOYEE_FEATURE_INTEGRATION.md's 409s — manager-hierarchy
 * violation, role/designation still in use, manager-scoping) put a single
 * string directly under `data.error` instead — same location, different
 * shape, so this checks both before falling back to the generic top-level
 * `message`.
 */
export function extractApiErrorMessage(err: any, fallback = 'Something went wrong. Please try again.'): string {
  const data = err?.error?.data;
  if (data?.error) {
    if (typeof data.error === 'string') return data.error;
    const messages = Object.values(data.error).flat();
    if (messages.length) return messages.join(' ');
  }
  return err?.error?.message || fallback;
}
