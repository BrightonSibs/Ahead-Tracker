const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function checkJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }

  return response.json();
}

async function checkText(pathname, expectedText) {
  const response = await fetch(`${baseUrl}${pathname}`);
  if (!response.ok) {
    throw new Error(`${pathname} returned ${response.status}`);
  }

  const text = await response.text();
  if (!text.includes(expectedText)) {
    throw new Error(`${pathname} did not include expected text: ${expectedText}`);
  }
}

async function main() {
  const health = await checkJson('/api/health');
  if (health.status !== 'ok') {
    throw new Error(`/api/health reported ${health.status}`);
  }

  await checkText('/login', 'Sign in to your account');

  console.log(`Smoke checks passed for ${baseUrl}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
