import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !['ADMIN', 'ANALYST'].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    sources: {
      CROSSREF: {
        configured: true,
        reason: process.env.CROSSREF_EMAIL
          ? 'Using CROSSREF_EMAIL from server environment.'
          : 'CrossRef can run with the built-in SLU contact email fallback.',
      },
      PUBMED: {
        configured: true,
        reason: process.env.NCBI_API_KEY
          ? 'Using NCBI_API_KEY from server environment.'
          : 'PubMed sync works without an API key, but rate limits are stricter.',
      },
      ORCID: {
        configured: true,
        reason: process.env.ORCID_CLIENT_ID
          ? 'ORCID client credentials are present for future member API flows.'
          : 'Public ORCID sync is available for researchers who already have ORCID iDs.',
      },
      GOOGLE_SCHOLAR: {
        configured: Boolean(process.env.SERPAPI_KEY),
        reason: process.env.SERPAPI_KEY
          ? 'SERPAPI_KEY is loaded and Google Scholar sync is ready.'
          : 'Add SERPAPI_KEY to .env.local and restart the dev server to enable Scholar sync.',
      },
    },
  });
}
