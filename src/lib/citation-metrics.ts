export interface CitationSnapshot {
  citationCount: number;
  capturedAt: Date;
}

export function buildObservedCitationGrowthByYear(citations: CitationSnapshot[]) {
  const maxByYear: Record<number, number> = {};

  for (const citation of citations) {
    const year = citation.capturedAt.getFullYear();
    maxByYear[year] = Math.max(maxByYear[year] || 0, citation.citationCount);
  }

  const years = Object.keys(maxByYear)
    .map(Number)
    .sort((a, b) => a - b);

  const growthByYear: Record<number, number> = {};
  let previousMax: number | null = null;

  for (const year of years) {
    const yearMax = maxByYear[year];
    if (previousMax !== null) {
      growthByYear[year] = Math.max(0, yearMax - previousMax);
    }
    previousMax = previousMax === null ? yearMax : Math.max(previousMax, yearMax);
  }

  return growthByYear;
}

export function getLatestCitationCount(citations: CitationSnapshot[]) {
  if (citations.length === 0) return 0;

  return citations.reduce((latest, citation) => (
    citation.capturedAt > latest.capturedAt ? citation : latest
  )).citationCount;
}
