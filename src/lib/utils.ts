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
  if (confidence >= 0.95) return 'bg-green-100 text-green-800';
  if (confidence >= 0.80) return 'bg-blue-100 text-blue-800';
  if (confidence >= 0.60) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.95) return 'High';
  if (confidence >= 0.80) return 'Good';
  if (confidence >= 0.60) return 'Medium';
  return 'Low';
}

export function departmentColor(dept: string): string {
  const colors: Record<string, string> = {
    AHEAD: 'bg-brand-100 text-brand-800',
    HCOR: 'bg-teal-100 text-teal-800',
  };
  return colors[dept] || 'bg-gray-100 text-gray-700';
}

export function departmentDotColor(dept: string): string {
  const colors: Record<string, string> = {
    AHEAD: 'bg-brand-500',
    HCOR: 'bg-teal-500',
  };
  return colors[dept] || 'bg-gray-400';
}

export function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    GOOGLE_SCHOLAR: 'Google Scholar',
    CROSSREF: 'CrossRef',
    ORCID: 'ORCID',
    PUBMED: 'PubMed',
    RESEARCHGATE: 'ResearchGate',
    MANUAL: 'Manual',
    CSV_IMPORT: 'CSV Import',
  };
  return labels[source] || source;
}

export function sourceBadgeColor(source: string): string {
  const colors: Record<string, string> = {
    GOOGLE_SCHOLAR: 'bg-blue-50 text-blue-700 border-blue-200',
    CROSSREF: 'bg-orange-50 text-orange-700 border-orange-200',
    ORCID: 'bg-green-50 text-green-700 border-green-200',
    PUBMED: 'bg-purple-50 text-purple-700 border-purple-200',
    RESEARCHGATE: 'bg-sky-50 text-sky-700 border-sky-200',
    MANUAL: 'bg-gray-50 text-gray-600 border-gray-200',
    CSV_IMPORT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  };
  return colors[source] || 'bg-gray-50 text-gray-600 border-gray-200';
}
