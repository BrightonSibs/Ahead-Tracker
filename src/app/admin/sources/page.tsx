'use client';
import { PageLayout, PageContent, TopBar } from '@/components/layout';
import { Card, CardHeader, CardTitle, Button, Input, Alert } from '@/components/ui';
import { useState } from 'react';

const SOURCES = [
  {
    id: 'CROSSREF',
    name: 'CrossRef',
    icon: '🔶',
    status: 'active',
    description: 'Primary metadata source. Automatic sync is supported for DOI metadata, author lists, journal metadata, and CrossRef citation counts.',
    fields: [{ key: 'email', label: 'Contact Email (polite pool)', placeholder: 'research@slu.edu', type: 'email' }],
    docsUrl: 'https://api.crossref.org',
  },
  {
    id: 'PUBMED',
    name: 'PubMed / NCBI',
    icon: '🟣',
    status: 'active',
    description: 'Biomedical publication discovery. Automatic sync is supported through author-based PubMed searches. Adding NCBI_API_KEY is strongly recommended to avoid rate limits.',
    fields: [{ key: 'apiKey', label: 'NCBI API Key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', type: 'password' }],
    docsUrl: 'https://www.ncbi.nlm.nih.gov/account/',
  },
  {
    id: 'ORCID',
    name: 'ORCID',
    icon: '🟢',
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
    icon: '🔵',
    status: 'active',
    description: 'Automatic sync is supported through SerpAPI. Add SERPAPI_KEY to .env.local, restart the dev server, then run Scholar sync from Admin > Sync Jobs.',
    fields: [{ key: 'serpApiKey', label: 'SerpAPI Key', placeholder: 'paste your SerpAPI key into .env.local as SERPAPI_KEY', type: 'password' }],
    docsUrl: 'https://serpapi.com/google-scholar-api',
  },
  {
    id: 'RESEARCHGATE',
    name: 'ResearchGate',
    icon: '🩵',
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
    active: 'bg-green-50 text-green-700 border-green-200',
    restricted: 'bg-amber-50 text-amber-700 border-amber-200',
    optional: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  return (
    <PageLayout>
      <TopBar title="Data Sources" subtitle="Configure API credentials and external ingestion settings" />
      <PageContent>
        <Alert type="info" title="Configuration Note">
          Runtime credentials are read from <code className="font-mono bg-blue-100 px-1 rounded text-xs">.env.local</code>.
          The inputs on this screen are guidance only and do not write environment variables automatically.
        </Alert>

        <div className="space-y-4">
          {SOURCES.map(source => (
            <Card key={source.id}>
              <div className="flex items-start gap-4">
                <span className="text-3xl">{source.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base font-bold font-display text-gray-900">{source.name}</h3>
                    <span className={`px-2 py-0.5 rounded border text-xs font-medium capitalize ${statusBadge[source.status]}`}>
                      {source.status}
                    </span>
                    <a href={source.docsUrl} target="_blank" rel="noopener" className="text-xs text-brand-600 hover:text-brand-700 ml-auto">
                      Documentation
                    </a>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 leading-relaxed">{source.description}</p>

                  {source.fields.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                    <p className="text-sm text-gray-400 italic">No additional credentials are configured for this source in the app today.</p>
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
          <CardHeader><CardTitle>Environment Variables Reference</CardTitle></CardHeader>
          <div className="bg-gray-900 rounded-lg p-4 text-xs font-mono text-gray-300 space-y-1 overflow-x-auto">
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
