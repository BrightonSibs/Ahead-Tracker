export function normalizeDoi(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  return normalized || null;
}

export function buildDoiUrl(value: string | null | undefined) {
  const normalized = normalizeDoi(value);
  return normalized ? `https://doi.org/${normalized}` : null;
}
