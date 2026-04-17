function normalizeNoticeTitle(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const NOTICE_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: 'ERRATUM', pattern: /^(erratum|errata)\b[:\s-]*/i },
  { kind: 'CORRIGENDUM', pattern: /^(corrigendum|corrigenda)\b[:\s-]*/i },
  { kind: 'CORRECTION', pattern: /^correction\b[:\s-]*/i },
  { kind: 'RETRACTION', pattern: /^(retraction|retracted article|retracted publication)\b[:\s-]*/i },
  { kind: 'EXPRESSION_OF_CONCERN', pattern: /^expression of concern\b[:\s-]*/i },
  { kind: 'ADDENDUM', pattern: /^addendum\b[:\s-]*/i },
];

export function getPublicationNoticeKind(title: string | null | undefined) {
  const normalized = normalizeNoticeTitle(title);
  if (!normalized) return null;

  for (const notice of NOTICE_PATTERNS) {
    if (notice.pattern.test(normalized)) {
      return notice.kind;
    }
  }

  return null;
}

export function isNonResearchNoticeTitle(title: string | null | undefined) {
  return getPublicationNoticeKind(title) !== null;
}
