export interface CitationSnapshot {
  citationCount: number;
  capturedAt: Date;
}

function buildCitationYearMaxLookup(citations: CitationSnapshot[]) {
  const maxByYear: Record<number, number> = {};

  for (const citation of citations) {
    const year = citation.capturedAt.getFullYear();
    maxByYear[year] = Math.max(maxByYear[year] || 0, citation.citationCount);
  }

  return maxByYear;
}

export function buildCitationSeriesByYear(
  citations: CitationSnapshot[],
  endYear?: number,
) {
  const maxByYear = buildCitationYearMaxLookup(citations);

  const years = Object.keys(maxByYear)
    .map(Number)
    .sort((a, b) => a - b);

  if (years.length === 0) {
    return [];
  }

  const finalYear = Math.max(years[years.length - 1], endYear ?? years[years.length - 1]);
  const timeline = [];
  let runningMax = 0;
  let previousMax: number | null = null;

  for (let year = years[0]; year <= finalYear; year += 1) {
    if (year in maxByYear) {
      runningMax = Math.max(runningMax, maxByYear[year]);
    }

    const cumulative = runningMax;
    const observedGrowth = previousMax === null ? 0 : Math.max(0, cumulative - previousMax);

    timeline.push({
      year,
      observedGrowth,
      cumulative,
    });

    previousMax = cumulative;
  }

  return timeline;
}

export function buildObservedCitationGrowthByYear(
  citations: CitationSnapshot[],
  endYear?: number,
) {
  const growthByYear: Record<number, number> = {};

  for (const point of buildCitationSeriesByYear(citations, endYear)) {
    if (point.observedGrowth > 0) {
      growthByYear[point.year] = point.observedGrowth;
    }
  }

  return growthByYear;
}

export function buildCumulativeCitationCountByYear(
  citations: CitationSnapshot[],
  endYear?: number,
) {
  const cumulativeByYear: Record<number, number> = {};

  for (const point of buildCitationSeriesByYear(citations, endYear)) {
    cumulativeByYear[point.year] = point.cumulative;
  }

  return cumulativeByYear;
}

export function getLatestCitationCount(citations: CitationSnapshot[]) {
  if (citations.length === 0) return 0;

  return citations.reduce((latest, citation) => (
    citation.capturedAt > latest.capturedAt ? citation : latest
  )).citationCount;
}
