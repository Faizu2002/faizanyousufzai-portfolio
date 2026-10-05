# Google Indexing API runner

This repository includes a manual GitHub Actions workflow that reads up to 100 URLs from the live sitemap and submits them to Google's Indexing API as `URL_UPDATED`.

## One-time setup

1. In Google Cloud, create or select a project.
2. Enable the Web Search Indexing API.
3. Create a service account and generate a JSON key.
4. In Google Search Console, add the service account email from `client_email` to the `faizanyousufzai.online` property with sufficient permission.
5. In this GitHub repository, open:
   `Settings -> Secrets and variables -> Actions -> New repository secret`
6. Create a secret named exactly:
   `GOOGLE_INDEXING_SERVICE_ACCOUNT`
7. Paste the complete service-account JSON as the secret value.

Never commit the JSON key into the repository.

## Run

Open:
`Actions -> Google Indexing API Submit -> Run workflow`

The default limit is 100 URLs. You can choose a smaller number from 1 to 100.

The script:
- reads the live sitemap,
- follows sitemap indexes when present,
- keeps only URLs on `faizanyousufzai.online`,
- removes duplicates,
- submits URLs one by one as `URL_UPDATED`,
- prints success or failure for every URL.

## Important

Google officially documents the Indexing API mainly for pages with `JobPosting` or livestream `BroadcastEvent` structured data. Using it for ordinary pages is outside the documented use case. A successful API response does not guarantee indexing or rankings.
