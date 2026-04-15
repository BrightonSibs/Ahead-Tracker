const baseUrl = (process.env.BASE_URL || 'http://127.0.0.1:3050').replace(/\/$/, '');

const pageChecks = [
  { path: '/login', text: 'Sign in to your account', auth: false },
  { path: '/dashboard', text: 'Dashboard', auth: true },
  { path: '/researchers', text: 'Researchers', auth: true },
  { path: '/publications', text: 'Publications', auth: true },
  { path: '/analytics', text: 'Analytics', auth: true },
  { path: '/collaborations', text: 'Collaborations', auth: true },
  { path: '/reports', text: 'Reports', auth: true },
  { path: '/admin', text: 'Admin', auth: true },
  { path: '/admin/data-quality', text: 'Data Quality', auth: true },
  { path: '/admin/departments', text: 'Departments', auth: true },
  { path: '/admin/publications', text: 'Publications', auth: true },
  { path: '/admin/researchers', text: 'Researchers', auth: true },
  { path: '/admin/sources', text: 'Sources', auth: true },
  { path: '/admin/sync', text: 'Sync', auth: true },
  { path: '/admin/journals', text: 'Journal', auth: true },
];

const apiChecks = [
  { path: '/api/health', auth: false },
  { path: '/api/analytics?type=dashboard&sluOnly=false', auth: true },
  { path: '/api/analytics?type=full&sluOnly=false', auth: true },
  { path: '/api/researchers?page=1&pageSize=5', auth: true },
  { path: '/api/publications?page=1&pageSize=5', auth: true },
  { path: '/api/collaborations?sluOnly=false', auth: true },
  { path: '/api/admin/data-quality', auth: true },
  { path: '/api/admin/sync/config', auth: true },
  { path: '/api/journals/coverage', auth: true },
  { path: '/api/export?type=publications', auth: true, expectedType: 'text/csv' },
];

function parseSetCookies(response) {
  const cookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);

  return cookies
    .map(cookie => cookie?.split(';')[0]?.trim())
    .filter(Boolean);
}

function mergeCookieJar(jar, response) {
  for (const cookie of parseSetCookies(response)) {
    const [name] = cookie.split('=');
    jar.set(name, cookie);
  }
}

function cookieHeader(jar) {
  return Array.from(jar.values()).join('; ');
}

async function timedFetch(path, options = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
  });
  const durationMs = Math.round(performance.now() - startedAt);
  return { response, durationMs };
}

async function login() {
  const jar = new Map();

  const csrfResult = await timedFetch('/api/auth/csrf');
  if (!csrfResult.response.ok) {
    throw new Error(`/api/auth/csrf failed with ${csrfResult.response.status}`);
  }

  mergeCookieJar(jar, csrfResult.response);
  const csrf = await csrfResult.response.json();
  if (!csrf?.csrfToken) {
    throw new Error('Missing CSRF token from NextAuth.');
  }

  const body = new URLSearchParams({
    csrfToken: csrf.csrfToken,
    email: process.env.AUDIT_EMAIL || 'admin@slu.edu',
    password: process.env.AUDIT_PASSWORD || 'admin123',
    callbackUrl: `${baseUrl}/dashboard`,
    json: 'true',
  });

  const signInResult = await timedFetch('/api/auth/callback/credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
    },
    body,
  });

  mergeCookieJar(jar, signInResult.response);

  if (![200, 302].includes(signInResult.response.status)) {
    const text = await signInResult.response.text();
    throw new Error(`Sign-in failed with ${signInResult.response.status}: ${text.slice(0, 200)}`);
  }

  if (!Array.from(jar.keys()).some(name => name.includes('next-auth.session-token') || name.includes('__Secure-next-auth.session-token'))) {
    throw new Error('No NextAuth session cookie was set after sign-in.');
  }

  return { jar, loginMs: csrfResult.durationMs + signInResult.durationMs };
}

async function runPageCheck(check, jar) {
  const { response, durationMs } = await timedFetch(check.path, {
    headers: check.auth ? { Cookie: cookieHeader(jar) } : undefined,
  });

  if (response.status !== 200) {
    throw new Error(`${check.path} returned ${response.status}`);
  }

  const text = await response.text();
  if (check.text && !text.includes(check.text)) {
    throw new Error(`${check.path} did not include expected text: ${check.text}`);
  }
  for (const forbidden of check.forbiddenText || []) {
    if (text.includes(forbidden)) {
      throw new Error(`${check.path} included forbidden text: ${forbidden}`);
    }
  }

  return { path: check.path, durationMs };
}

async function runApiCheck(check, jar) {
  const { response, durationMs } = await timedFetch(check.path, {
    headers: check.auth ? { Cookie: cookieHeader(jar) } : undefined,
  });

  if (response.status !== 200) {
    throw new Error(`${check.path} returned ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (check.expectedType) {
    if (!contentType.includes(check.expectedType)) {
      throw new Error(`${check.path} returned ${contentType} instead of ${check.expectedType}`);
    }

    const text = await response.text();
    if (!text.trim()) {
      throw new Error(`${check.path} returned an empty export.`);
    }
  } else {
    await response.json();
  }

  return { path: check.path, durationMs, contentType };
}

function getCollection(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.items)) return result.items;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.researchers)) return result.researchers;
  if (Array.isArray(result?.publications)) return result.publications;
  return [];
}

async function fetchJson(path, jar) {
  const { response, durationMs } = await timedFetch(path, {
    headers: { Cookie: cookieHeader(jar) },
  });
  if (response.status !== 200) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return { data: await response.json(), durationMs };
}

async function main() {
  const { jar, loginMs } = await login();
  const pageResults = [];
  const apiResults = [];

  for (const check of pageChecks) {
    pageResults.push(await runPageCheck(check, jar));
  }

  for (const check of apiChecks) {
    apiResults.push(await runApiCheck(check, jar));
  }

  const researchersResult = await fetchJson('/api/researchers?page=1&pageSize=1', jar);
  const publicationsResult = await fetchJson('/api/publications?page=1&pageSize=1', jar);

  const firstResearcher = getCollection(researchersResult.data)[0];
  const firstPublication = getCollection(publicationsResult.data)[0];

  if (!firstResearcher?.id) {
    throw new Error('Could not resolve a researcher detail page target.');
  }

  if (!firstPublication?.id) {
    throw new Error('Could not resolve a publication detail page target.');
  }

  const detailPages = [
    await runPageCheck({ path: `/researchers/${firstResearcher.id}`, auth: true }, jar),
    await runPageCheck({ path: `/publications/${firstPublication.id}`, auth: true }, jar),
  ];

  const detailApis = [
    await runApiCheck({ path: `/api/researchers/${firstResearcher.id}`, auth: true }, jar),
    await runApiCheck({ path: `/api/publications/${firstPublication.id}`, auth: true }, jar),
  ];

  const allDurations = [
    loginMs,
    ...pageResults.map(result => result.durationMs),
    ...apiResults.map(result => result.durationMs),
    ...detailPages.map(result => result.durationMs),
    ...detailApis.map(result => result.durationMs),
    researchersResult.durationMs,
    publicationsResult.durationMs,
  ];

  const maxMs = Math.max(...allDurations);
  const avgMs = Math.round(allDurations.reduce((sum, value) => sum + value, 0) / allDurations.length);

  console.log(JSON.stringify({
    baseUrl,
    loginMs,
    pageResults,
    apiResults,
    detailPages,
    detailApis,
    avgMs,
    maxMs,
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
