// Shared search helper for any "type free text, find matching rows" surface.
//
// Behavior:
//   - Case-insensitive.
//   - Accent-insensitive (NFD normalize then strip combining marks, so "Cruz"
//     finds "Crúz" and "Acuna" finds "Acuña").
//   - Token-based: the query is split on whitespace, and EVERY token must
//     appear somewhere in the haystack. So "Devin Pope" matches "Devin
//     Garrett Pope" — tokens "devin" and "pope" both appear.
//   - Empty / whitespace query matches everything.

export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function tokenize(query: string): string[] {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean)
}

/**
 * Returns true if every token in `query` appears in `haystack`.
 * Whitespace / empty queries match everything.
 */
export function matchesAllTokens(haystack: string, query: string): boolean {
  const tokens = tokenize(query)
  if (tokens.length === 0) return true
  const hay = normalizeForSearch(haystack)
  return tokens.every((t) => hay.includes(t))
}
