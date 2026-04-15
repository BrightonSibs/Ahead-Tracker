import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calcHIndex(citations: number[]): number {
  const sorted = [...citations].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

export function calcI10Index(citations: number[]): number {
  return citations.filter(c => c >= 10).length;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatYear(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).getFullYear().toString();
}

export function formatCitationCount(value: number | null | undefined, fallback = '-'): string {
  if (value == null) return fallback;
  return value.toLocaleString('en-US');
}

export function truncate(str: string, maxLen = 80): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

export function normalizeAuthorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance for fuzzy name matching
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function nameSimilarity(a: string, b: string): number {
  const na = normalizeAuthorName(a);
  const nb = normalizeAuthorName(b);
  if (na === nb) return 1.0;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(na, nb) / maxLen;
}

export function isTenureInclusive(
  publicationDate: Date | null,
  sluStartDate: Date | null,
): { included: boolean; reason: string } {
  if (!sluStartDate) return { included: true, reason: 'No SLU start date set' };
  if (!publicationDate) return { included: true, reason: 'No publication date' };
  if (publicationDate >= sluStartDate) return { included: true, reason: 'Within SLU tenure' };
  return { included: false, reason: `Published before SLU start (${sluStartDate.toISOString().split('T')[0]})` };
}

export function confidenceBadgeColor(confidence: number): string {
  if (confidence >= 0.95) return 'border border-brand-200 bg-brand-50 text-brand-800';
  if (confidence >= 0.80) return 'border border-gray-300 bg-white text-gray-800';
  if (confidence >= 0.60) return 'border border-gray-300 bg-gray-50 text-gray-700';
  return 'border border-red-200 bg-white text-red-800';
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.95) return 'High';
  if (confidence >= 0.80) return 'Good';
  if (confidence >= 0.60) return 'Medium';
  return 'Low';
}

export function matchTypeLabel(matchType: string): string {
  const labels: Record<string, string> = {
    ORCID_MATCH: 'ORCID',
    EXACT_NAME_MATCH: 'Canonical name',
    ALIAS_MATCH: 'Approved alias',
    INITIALS_MATCH: 'Initials / reordered',
    TRUSTED_SOURCE_ENRICHMENT: 'Trusted source',
    MANUAL_ASSIGNMENT: 'Manual',
  };

  return labels[matchType] || matchType.replace(/_/g, ' ');
}

export function matchTypeBadgeColor(matchType: string): string {
  const colors: Record<string, string> = {
    ORCID_MATCH: 'border border-teal-200 bg-teal-50 text-teal-700',
    EXACT_NAME_MATCH: 'border border-brand-200 bg-brand-50 text-brand-800',
    ALIAS_MATCH: 'border border-gray-300 bg-white text-gray-800',
    INITIALS_MATCH: 'border border-slate-300 bg-slate-50 text-slate-700',
    TRUSTED_SOURCE_ENRICHMENT: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    MANUAL_ASSIGNMENT: 'border border-amber-200 bg-amber-50 text-amber-700',
  };

  return colors[matchType] || 'border border-gray-300 bg-white text-gray-700';
}

const DEPARTMENT_BADGE_CLASSES = [
  'border border-brand-200 bg-brand-50 text-brand-800',
  'border border-teal-200 bg-teal-50 text-teal-800',
  'border border-slate-300 bg-slate-50 text-slate-700',
  'border border-zinc-300 bg-zinc-50 text-zinc-700',
  'border border-stone-300 bg-stone-50 text-stone-700',
  'border border-neutral-300 bg-neutral-50 text-neutral-700',
  'border border-blue-200 bg-blue-50 text-blue-800',
  'border border-slate-400 bg-white text-slate-800',
];

const DEPARTMENT_DOT_CLASSES = [
  'bg-brand-600',
  'bg-teal-500',
  'bg-slate-600',
  'bg-zinc-600',
  'bg-stone-600',
  'bg-neutral-600',
  'bg-blue-500',
  'bg-slate-400',
];

const DEPARTMENT_HEX_COLORS = [
  '#003DA5',
  '#14B8A6',
  '#64748B',
  '#71717A',
  '#78716C',
  '#525252',
  '#60A5FA',
  '#9CA3AF',
];

function hashDepartment(dept: string) {
  return dept.split('').reduce((hash, char) => hash + char.charCodeAt(0), 0);
}

export function departmentColor(dept: string): string {
  const colors: Record<string, string> = {
    AHEAD: 'border border-brand-200 bg-brand-50 text-brand-800',
    HCOR: 'border border-teal-200 bg-teal-50 text-teal-800',
  };
  return colors[dept] || DEPARTMENT_BADGE_CLASSES[hashDepartment(dept) % DEPARTMENT_BADGE_CLASSES.length];
}

export function departmentDotColor(dept: string): string {
  const colors: Record<string, string> = {
    AHEAD: 'bg-brand-600',
    HCOR: 'bg-teal-500',
  };
  return colors[dept] || DEPARTMENT_DOT_CLASSES[hashDepartment(dept) % DEPARTMENT_DOT_CLASSES.length];
}

export function departmentHexColor(dept: string): string {
  const colors: Record<string, string> = {
    AHEAD: '#003DA5',
    HCOR: '#14B8A6',
  };
  return colors[dept] || DEPARTMENT_HEX_COLORS[hashDepartment(dept) % DEPARTMENT_HEX_COLORS.length];
}

export function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    GOOGLE_SCHOLAR: 'Google Scholar',
    CROSSREF: 'CrossRef',
    ORCID: 'ORCID',
    PUBMED: 'PubMed',
    EUROPE_PMC: 'Europe PMC',
    OPENALEX: 'OpenAlex',
    RESEARCHGATE: 'ResearchGate',
    MANUAL: 'Manual',
    CSV_IMPORT: 'CSV Import',
  };
  return labels[source] || source;
}

export function sourceBadgeColor(source: string): string {
  const colors: Record<string, string> = {
    GOOGLE_SCHOLAR: 'border border-brand-200 bg-brand-50 text-brand-700',
    CROSSREF: 'border border-gray-300 bg-white text-gray-700',
    ORCID: 'border border-gray-300 bg-gray-50 text-gray-700',
    PUBMED: 'border border-slate-300 bg-slate-50 text-slate-700',
    EUROPE_PMC: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
    OPENALEX: 'border border-indigo-200 bg-indigo-50 text-indigo-700',
    RESEARCHGATE: 'border border-gray-300 bg-white text-gray-700',
    MANUAL: 'border border-gray-300 bg-white text-gray-600',
    CSV_IMPORT: 'border border-gray-300 bg-gray-50 text-gray-700',
  };
  return colors[source] || 'border border-gray-300 bg-white text-gray-600';
}
