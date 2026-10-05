import crypto from "node:crypto";

const SITE_URL = process.env.SITE_URL || "https://faizanyousufzai.online";
const SITEMAP_URL = process.env.SITEMAP_URL || `${SITE_URL.replace(/\/$/, "")}/sitemap.xml`;
const MAX_URLS = Math.max(1, Math.min(100, Number.parseInt(process.env.MAX_URLS || "100", 10) || 100));
const DELAY_MS = Math.max(0, Number.parseInt(process.env.DELAY_MS || "500", 10) || 500);
const EXPLICIT_URLS = (process.env.EXPLICIT_URLS || "").split(/[\\n,]+/).map((url) => url.trim()).filter(Boolean);
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/indexing";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const INDEXING_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";

function base64url(value) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeXml(text) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => decodeXml(m[1].trim()));
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "faizanyousufzai-indexing-script/1.0" } });
  if (!response.ok) throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
  return response.text();
}

async function collectUrlsFromSitemap(url, seenSitemaps = new Set(), depth = 0) {
  if (depth > 3 || seenSitemaps.has(url)) return [];
  seenSitemaps.add(url);
  const xml = await fetchText(url);
  const locs = extractLocs(xml);

  if (/<sitemapindex[\s>]/i.test(xml)) {
    const nested = [];
    for (const sitemap of locs) {
      nested.push(...await collectUrlsFromSitemap(sitemap, seenSitemaps, depth + 1));
      if (nested.length >= MAX_URLS) break;
    }
    return nested;
  }
  return locs;
}

function getServiceAccount() {
  const raw = process.env.GOOGLE_INDEXING_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Missing GOOGLE_INDEXING_SERVICE_ACCOUNT GitHub Actions secret.");

  let credentials;
  try { credentials = JSON.parse(raw); }
  catch { throw new Error("GOOGLE_INDEXING_SERVICE_ACCOUNT is not valid JSON."); }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error("Service-account JSON must contain client_email and private_key.");
  }
  return credentials;
}

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: GOOGLE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsignedJwt = `${header}.${claim}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();
  const signature = signer.sign(credentials.private_key, "base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsignedJwt}.${signature}`
    })
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`OAuth token request failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

function isAllowedUrl(url) {
  try {
    const candidate = new URL(url);
    const site = new URL(SITE_URL);
    return ["https:", "http:"].includes(candidate.protocol) && candidate.hostname === site.hostname;
  } catch {
    return false;
  }
}

async function submitUrl(url, accessToken) {
  const response = await fetch(INDEXING_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ url, type: "URL_UPDATED" })
  });

  let body;
  try { body = await response.json(); }
  catch { body = await response.text(); }

  return { ok: response.ok, status: response.status, body };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const credentials = getServiceAccount();
  const accessToken = await getAccessToken(credentials);

  let discovered;
  if (EXPLICIT_URLS.length) {
    console.log(`Using ${EXPLICIT_URLS.length} explicit URL(s).`);
    discovered = EXPLICIT_URLS;
  } else {
    console.log(`Fetching sitemap: ${SITEMAP_URL}`);
    discovered = await collectUrlsFromSitemap(SITEMAP_URL);
  }
  const urls = [...new Set(discovered)].filter(isAllowedUrl).slice(0, MAX_URLS);

  if (!urls.length) throw new Error("No same-domain URLs were found in the sitemap.");

  console.log(`Submitting ${urls.length} URL(s) from ${SITE_URL}.`);
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    const result = await submitUrl(url, accessToken);

    if (result.ok) {
      succeeded += 1;
      console.log(`[${i + 1}/${urls.length}] OK ${result.status} ${url}`);
    } else {
      failed += 1;
      console.error(`[${i + 1}/${urls.length}] FAIL ${result.status} ${url}`);
      console.error(JSON.stringify(result.body));
    }

    if (i < urls.length - 1 && DELAY_MS > 0) await sleep(DELAY_MS);
  }

  console.log(`Finished. Success: ${succeeded}. Failed: ${failed}. Total: ${urls.length}.`);
  if (succeeded === 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
