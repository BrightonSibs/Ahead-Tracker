'use client';

import Image from 'next/image';
import { useState } from 'react';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Alert, Button, Card, CardHeader, CardTitle, Input } from '@/components/ui';

const SOURCES = [
  {
    id: 'CROSSREF',
    name: 'Crossref',
    logoSrc: '/source-logos/crossref.svg',
    logoAlt: 'Crossref logo',
    logoWidth: 200,
    logoHeight: 60,
    status: 'active',
    description:
      'Primary metadata source. Automatic sync is supported for DOI metadata, author lists, journal metadata, and CrossRef citation counts.',
    fields: [{ key: 'email', label: 'Contact Email (polite pool)', placeholder: 'research@slu.edu', type: 'email' }],
    docsUrl: 'https://api.crossref.org',
  },
  {
    id: 'PUBMED',
    name: 'PubMed / NCBI',
    logoSrc: '/source-logos/ncbi.svg',
    logoAlt: 'NCBI logo',
    logoWidth: 240,
    logoHeight: 72,
    status: 'active',
    description:
      'Biomedical publication discovery. Automatic sync is supported through author-based PubMed searches. Adding NCBI_API_KEY is strongly recommended to avoid rate limits.',
    fields: [{ key: 'apiKey', label: 'NCBI API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'password' }],
    docsUrl: 'https://www.ncbi.nlm.nih.gov/account/',
  },
  {
    id: 'ORCID',
    name: 'ORCID',
    logoSrc: '/source-logos/orcid.png',
    logoAlt: 'ORCID logo',
    logoWidth: 220,
    logoHeight: 64,
    status: 'active',
    description: 'Researcher identity resolution. Automatic sync is supported for researchers who have ORCID iDs.',
    fields: [
      { key: 'clientId', label: 'Client ID', placeholder: 'APP-XXXXXXXXXXXXXXXX', type: 'text' },
      { key: 'clientSecret', label: 'Client Secret', placeholder: 'optional for future member-api flows', type: 'password' },
    ],
    docsUrl: 'https://info.orcid.org/documentation/integration-guide/',
  },
  {
    id: 'GOOGLE_SCHOLAR',
    name: 'Google Scholar',
    logoSrc: '/source-logos/google-scholar.png',
    logoAlt: 'Google Scholar logo',
    logoWidth: 286,
    logoHeight: 60,
    status: 'active',
    description:
      'Automatic sync is supported through SerpAPI. Add SERPAPI_KEY to .env.local, restart the dev server, then run Scholar sync from Admin > Sync Jobs.',
    fields: [{ key: 'serpApiKey', label: 'SerpAPI Key', placeholder: 'paste your SerpAPI key into .env.local as SERPAPI_KEY', type: 'password' }],
    docsUrl: 'https://serpapi.com/google-scholar-api',
  },
  {
    id: 'RESEARCHGATE',
    name: 'ResearchGate',
    logoSrc: '/source-logos/researchgate.jpg',
    logoAlt: 'ResearchGate logo',
    logoWidth: 96,
    logoHeight: 96,
    status: 'optional',
    description: 'Secondary or optional source. No official public API is wired into this project today.',
    fields: [],
    docsUrl: 'https://www.researchgate.net',
  },
];

export default function AdminSourcesPage() {
  const [configs, setConfigs] = useState<Record<string, Record<string, string>>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  function save(sourceId: string) {
    setSaved(prev => ({ ...prev, [sourceId]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [sourceId]: false })), 2000);
  }

  const statusBadge: Record<string, string> = {
    active: 'border-green-200 bg-green-50 text-green-700',
    restricted: 'border-amber-200 bg-amber-50 text-amber-700',
    optional: 'border-gray-200 bg-gray-50 text-gray-600',
  };

  return (
    <PageLayout>
      <TopBar title="Data Sources" subtitle="Configure API credentials and external ingestion settings" />
      <PageContent>
        <Alert type="info" title="Configuration Note">
          Runtime credentials are read from <code className="rounded bg-blue-100 px-1 text-xs font-mono">.env.local</code>.
          The inputs on this screen are guidance only and do not write environment variables automatically.
        </Alert>

        <div className="space-y-4">
          {SOURCES.map(source => (
            <Card key={source.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-start">
                <div className="flex h-16 w-full max-w-[7.5rem] flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <Image
                    src={source.logoSrc}
                    alt={source.logoAlt}
                    width={source.logoWidth}
                    height={source.logoHeight}
                    className="max-h-10 w-auto object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-3">
                    <h3 className="text-base font-bold font-display text-gray-900">{source.name}</h3>
                    <span className={`rounded border px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[source.status]}`}>
                      {source.status}
                    </span>
                    <a
                      href={source.docsUrl}
                      target="_blank"
                      rel="noopener"
                      className="ml-auto text-xs text-brand-600 hover:text-brand-700"
                    >
                      Documentation
                    </a>
                  </div>

                  <p className="mb-4 text-sm leading-relaxed text-gray-500">{source.description}</p>

                  {source.fields.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {source.fields.map(field => (
                        <Input
                          key={field.key}
                          label={field.label}
                          type={field.type as any}
                          placeholder={field.placeholder}
                          value={configs[source.id]?.[field.key] || ''}
                          onChange={event =>
                            setConfigs(prev => ({
                              ...prev,
                              [source.id]: { ...prev[source.id], [field.key]: event.target.value },
                            }))
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-gray-400">No additional credentials are configured for this source in the app today.</p>
                  )}

                  {source.fields.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => save(source.id)}>
                        {saved[source.id] ? 'Saved' : 'Save Notes'}
                      </Button>
                      <Button variant="ghost" size="sm">Update .env.local manually</Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Environment Variables Reference</CardTitle>
          </CardHeader>
          <div className="space-y-1 overflow-x-auto rounded-lg bg-gray-900 p-4 font-mono text-xs text-gray-300">
            {[
              '# Database',
              'DATABASE_URL="file:./dev.db"',
              '',
              '# NextAuth',
              'NEXTAUTH_SECRET="your-secret-here"',
              'NEXTAUTH_URL="http://localhost:3000"',
              '',
              '# CrossRef',
              'CROSSREF_EMAIL="research@slu.edu"',
              '',
              '# PubMed / NCBI',
              'NCBI_API_KEY=""',
              '',
              '# ORCID',
              'ORCID_CLIENT_ID=""',
              'ORCID_CLIENT_SECRET=""',
              '',
              '# SerpAPI for Google Scholar',
              'SERPAPI_KEY=""',
            ].map((line, index) => (
              <div key={index} className={line.startsWith('#') ? 'text-gray-500' : line === '' ? 'h-2' : 'text-green-400'}>
                {line || '\u00A0'}
              </div>
            ))}
          </div>
        </Card>
      </PageContent>
    </PageLayout>
  );
}
