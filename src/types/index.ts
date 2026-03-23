export type UserRole = 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface ResearcherSummary {
  id: string;
  facultyId: number;
  canonicalName: string;
  department: string;
  orcid: string | null;
  sluStartDate: string | null;
  activeStatus: boolean;
  notes: string | null;
  aliasCount: number;
  publicationCount: number;
  totalCitations: number;
  hIndex: number;
  i10Index: number;
  profileCompleteness: number;
  specialties: string[];
}

export interface PublicationSummary {
  id: string;
  title: string;
  doi: string | null;
  publicationDate: string | null;
  publicationYear: number | null;
  journalName: string | null;
  latestCitations: number;
  impactFactor: number | null;
  verifiedStatus: string;
  sourcePrimary: string;
  authors: string[];
  matchedResearchers: { id: string; name: string; department: string; confidence: number; matchType: string }[];
  specialties: string[];
  includedInSluOutput: boolean;
}

export interface CitationDataPoint {
  year: number;
  citations: number;
  cumulative: number;
}

export interface DashboardStats {
  totalPublications: number;
  totalCitations: number;
  citationsThisYear: number;
  avgCitationsPerArticle: number;
  byDepartment: { dept: string; publications: number; citations: number }[];
  recentActivity: { date: string; description: string; type: string }[];
  alerts: { id: string; alertType: string; title: string; message: string; createdAt: string }[];
  topResearchers: { id: string; name: string; department: string; hIndex: number; totalCitations: number }[];
}

export interface FilterState {
  department?: string;
  researcherId?: string;
  yearFrom?: number;
  yearTo?: number;
  sluOnly?: boolean;
  minImpactFactor?: number;
  specialty?: string;
  source?: string;
  keyword?: string;
  verifiedStatus?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
