import type { Prisma } from '@prisma/client';

export const SYNCABLE_SOURCES = ['CROSSREF', 'PUBMED', 'EUROPE_PMC', 'ORCID', 'OPENALEX', 'GOOGLE_SCHOLAR'] as const;
export const MANUAL_ONLY_SOURCES = ['RESEARCHGATE'] as const;

export type AutomaticSyncSource = (typeof SYNCABLE_SOURCES)[number];
export type SyncSource = AutomaticSyncSource | (typeof MANUAL_ONLY_SOURCES)[number];

export type ResearcherWithAliases = Prisma.ResearcherGetPayload<{
  include: {
    aliases: true;
    identifiers: true;
  };
}>;

export type PublicationCandidate = {
  source: AutomaticSyncSource;
  externalId: string | null;
  alternateExternalIds?: string[];
  doi: string | null;
  pubmedId: string | null;
  title: string;
  journalName: string | null;
  abstract: string | null;
  publicationDate: Date | null;
  publicationYear: number | null;
  authorNames: string[];
  citationCount: number | null;
};

export type AuthorMatch = {
  matchType: 'ORCID_MATCH' | 'EXACT_NAME_MATCH' | 'ALIAS_MATCH';
  confidence: number;
};

export type SyncSourceAdapter = {
  source: AutomaticSyncSource;
  fetchCandidates: (researcher: ResearcherWithAliases) => Promise<PublicationCandidate[]>;
};
