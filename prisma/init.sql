-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Researcher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facultyId" INTEGER NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "orcid" TEXT,
    "sluStartDate" DATETIME,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ResearcherAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researcherId" TEXT NOT NULL,
    "aliasName" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL DEFAULT 'NAME_VARIANT',
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearcherAlias_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearcherIdentifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researcherId" TEXT NOT NULL,
    "identifierType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearcherIdentifier_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT,
    "doi" TEXT,
    "pubmedId" TEXT,
    "publicationDate" DATETIME,
    "publicationYear" INTEGER,
    "journalName" TEXT,
    "abstract" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "sourcePrimary" TEXT NOT NULL DEFAULT 'MANUAL',
    "verifiedStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PublicationAuthor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorOrder" INTEGER NOT NULL,
    "isCorresponding" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PublicationAuthor_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicationResearcherMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "researcherId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'EXACT_NAME_MATCH',
    "matchConfidence" REAL NOT NULL DEFAULT 0.5,
    "manuallyConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "manuallyExcluded" BOOLEAN NOT NULL DEFAULT false,
    "exclusionReason" TEXT,
    "includedInSluOutput" BOOLEAN NOT NULL DEFAULT true,
    "sluTenureNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PublicationResearcherMatch_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationResearcherMatch_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "citationCount" INTEGER NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Citation_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalName" TEXT NOT NULL,
    "issn" TEXT,
    "year" INTEGER NOT NULL,
    "impactFactor" REAL,
    "hIndex" INTEGER,
    "quartile" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Specialty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT
);

-- CreateTable
CREATE TABLE "PublicationSpecialty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "inferred" BOOLEAN NOT NULL DEFAULT false,
    "inferenceSource" TEXT,
    "inferenceConfidence" REAL,
    "manuallyOverridden" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "PublicationSpecialty_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PublicationSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearcherSpecialty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researcherId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    CONSTRAINT "ResearcherSpecialty_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResearcherSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT,
    "source" TEXT NOT NULL,
    "externalId" TEXT,
    "rawData" TEXT NOT NULL,
    "normalizedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceRecord_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "researcherId" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "recordsFound" INTEGER,
    "recordsCreated" INTEGER,
    "recordsUpdated" INTEGER,
    "errorMessage" TEXT,
    "logs" TEXT,
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ManualOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicationId" TEXT NOT NULL,
    "overrideType" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManualOverride_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousData" TEXT,
    "newData" TEXT,
    "userId" TEXT,
    "researcherId" TEXT,
    "publicationId" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_researcherId_fkey" FOREIGN KEY ("researcherId") REFERENCES "Researcher" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "Publication" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SavedFilter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "filterData" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fileUrl" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Researcher_facultyId_key" ON "Researcher"("facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "Researcher_orcid_key" ON "Researcher"("orcid");

-- CreateIndex
CREATE INDEX "Researcher_department_idx" ON "Researcher"("department");

-- CreateIndex
CREATE INDEX "Researcher_canonicalName_idx" ON "Researcher"("canonicalName");

-- CreateIndex
CREATE INDEX "ResearcherAlias_aliasName_idx" ON "ResearcherAlias"("aliasName");

-- CreateIndex
CREATE INDEX "ResearcherAlias_researcherId_idx" ON "ResearcherAlias"("researcherId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearcherIdentifier_identifierType_value_key" ON "ResearcherIdentifier"("identifierType", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_doi_key" ON "Publication"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "Publication_pubmedId_key" ON "Publication"("pubmedId");

-- CreateIndex
CREATE INDEX "Publication_publicationYear_idx" ON "Publication"("publicationYear");

-- CreateIndex
CREATE INDEX "Publication_journalName_idx" ON "Publication"("journalName");

-- CreateIndex
CREATE INDEX "Publication_doi_idx" ON "Publication"("doi");

-- CreateIndex
CREATE INDEX "PublicationAuthor_publicationId_idx" ON "PublicationAuthor"("publicationId");

-- CreateIndex
CREATE INDEX "PublicationAuthor_authorName_idx" ON "PublicationAuthor"("authorName");

-- CreateIndex
CREATE INDEX "PublicationResearcherMatch_researcherId_idx" ON "PublicationResearcherMatch"("researcherId");

-- CreateIndex
CREATE INDEX "PublicationResearcherMatch_matchConfidence_idx" ON "PublicationResearcherMatch"("matchConfidence");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationResearcherMatch_publicationId_researcherId_key" ON "PublicationResearcherMatch"("publicationId", "researcherId");

-- CreateIndex
CREATE INDEX "Citation_publicationId_idx" ON "Citation"("publicationId");

-- CreateIndex
CREATE INDEX "Citation_capturedAt_idx" ON "Citation"("capturedAt");

-- CreateIndex
CREATE INDEX "JournalMetric_journalName_idx" ON "JournalMetric"("journalName");

-- CreateIndex
CREATE INDEX "JournalMetric_issn_idx" ON "JournalMetric"("issn");

-- CreateIndex
CREATE UNIQUE INDEX "JournalMetric_journalName_year_key" ON "JournalMetric"("journalName", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Specialty_name_key" ON "Specialty"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationSpecialty_publicationId_specialtyId_key" ON "PublicationSpecialty"("publicationId", "specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearcherSpecialty_researcherId_specialtyId_key" ON "ResearcherSpecialty"("researcherId", "specialtyId");

-- CreateIndex
CREATE INDEX "SourceRecord_source_idx" ON "SourceRecord"("source");

-- CreateIndex
CREATE INDEX "SourceRecord_publicationId_idx" ON "SourceRecord"("publicationId");

-- CreateIndex
CREATE INDEX "SyncJob_status_idx" ON "SyncJob"("status");

-- CreateIndex
CREATE INDEX "SyncJob_source_idx" ON "SyncJob"("source");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

