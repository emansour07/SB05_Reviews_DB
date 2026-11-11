# SB05 Review Dashboard

Single-page review dashboard for management and discipline leads: ARX header, overview charts, discipline filters and review register. Click a status, outcome, discipline or deadline indicator to filter the register. The Autodesk Forma icon beside a review name opens that exact review in a new tab; clicking the name still opens its document panel. Direct links use the Autodesk review UUID, never the displayed sequence number. Imported rows without an Autodesk UUID do not show an invented link. Void reviews are excluded; overdue and due-in-48-hours indicators are retained.

## Hosting and access

- Canonical team dashboard: https://emansour07.github.io/SB05_Reviews_DB/ — publish future updates in place at this same address.
- Cloudflare backend: https://sb05-reviews-api.eslam-mansour.workers.dev
- Owner controls: backend `/admin`, protected by a private owner code. The owner can choose or replace it at `/admin/code` after signing in.
- Team members open the GitHub Pages link without an account or password.

GitHub Pages serves the dashboard; Cloudflare handles Autodesk authentication, encrypted tokens and shared storage. No ChatGPT hosting or account is needed for this deployment. Credentials and project logs are never committed to this repository. Public viewing is enabled: anyone with the link can read and export the register.

Owner codes are stored as salted PBKDF2 verifiers with a server-secret HMAC pepper. Codes must contain 8–128 characters. Login attempts are limited to 10 per address and 200 overall per 15-minute window. Saving a new code invalidates other owner sessions and disables the original key for sign-in. No email service, Zero Trust activation or additional subscription is used. The original Cloudflare secret is retained as the server pepper and cookie-signing secret; never remove or expose it.

## Drawing KPIs

Each classified drawing PDF counts as one sheet within its review package. Drawing KPIs exclude report PDFs, other documents, unclassified PDFs, DWG copies and models. The owner-confirmed SB05 document code `SDW` identifies shop drawings. A PDF also counts as a drawing when a DWG, DXF or DGN file with the same base filename (case-insensitive) exists in the same package. CAD pairing is never borrowed from another package. Only the SDW filename token or a matching CAD counterpart qualifies a PDF as a drawing. Names containing the word drawing, or declared drawing metadata alone, do not qualify. Other files may be identified as reports or supporting documents by their supplied type or clear filename labels; unknown types remain unclassified. Classification uses file metadata/names, not PDF content inspection. The document-type totals, register, detail list and CSV keep these groups separate. Resubmissions in different packages count again. Reviewed drawings belong to closed packages, including rejected or returned packages. Under-review drawings belong to open packages.

The age chart uses calendar days since submission for open packages, and submission-to-finish duration for completed packages. Each drawing carries its package age. Age bands are non-overlapping: ≤1, >1–2, >2–3 and >3 days. Cumulative within-1/2/3-day figures intentionally overlap. Missing or invalid dates appear separately.

Package-size bands are 1–4, 5–10, 11–20 and >20 PDF drawings. Packages without drawings are excluded from this distribution and disclosed. Charts can be scoped to a discipline and clicked to filter the register. The register and CSV include drawing counts and age. Run `node test-kpis.cjs` to validate boundaries, drawing weights and filters.

## Updates

Any viewer can press **Refresh** to request an Autodesk Forma update. The connector processes up to 20 Autodesk reads per batch, saving its progress between requests to fit the Cloudflare Free plan. Only a complete, validated result replaces the shared report; failed updates keep the last saved data.

Open dashboards check saved data every 30 seconds. Once enabled, the Cloudflare minute cron advances batches and starts new updates on a five-minute cadence. This is periodic synchronization, not instantaneous event streaming. Concurrent requests share a lock and cooldown. Uploads and Autodesk connection controls remain owner-only. Regular viewers see simple update messages rather than technical notices.

## Autodesk connection and deployment

See [Cloudflare setup](CLOUDFLARE.md) for credentials, callback registration, deployment, verification and optional CI. Target project: `3a53d588-cf1e-451a-8083-4febcfb07486`.

The entry point is `cloudflare/index.mjs`. It verifies signed owner cookies and strips incoming identity headers before calling the shared handler. Do not deploy `worker.mjs` directly to a public host. SQLite-backed Durable Objects provide atomic snapshot, synchronization-job and token storage.

The APS application must be provisioned in Autodesk Custom Integrations, and the account authorizing it must have SB05 project access. Register this exact callback in the APS application:

`https://sb05-reviews-api.eslam-mansour.workers.dev/api/forma/callback`

The connector reads active/non-archived reviews and latest-round document versions. Exact approval labels, workflow state, assignees and available dates are preserved. Unavailable round numbers and document comments are omitted for Forma data.

## Development

Use Node.js 24. Builds and tests have no npm package dependencies; deployment uses Wrangler 4.160.0.

```sh
node build.cjs --pages
node test-forma.mjs
node test-forma-batches.mjs
node test-cloudflare.mjs
npx --yes wrangler@4.160.0 deploy
```

Pages publishes from `main`. The optional Cloudflare deployment workflow is disabled until its repository variables and token are configured. Runtime secrets stay in Cloudflare. The manual recovery workflow is separate from the Cloudflare schedule.

Tests cover authentication, forged headers, storage conflicts, pagination, batch limits, cooldowns, failed-update retention and concurrent uploads. Simulated tests do not replace verification against the live project after authorization.

## References

- [Autodesk setup](https://get-started.aps.autodesk.com/)
- [Reviews API](https://aps.autodesk.com/en/docs/acc/v1/reference/http/reviews-reviews-GET/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- ARX logo: vector from https://www.arx.ing/en, retrieved 11 November 2026. The logo belongs to its owner.

- Autodesk Forma icon: original application favicon from https://acc.autodesk.com/assets/exo/1167/favicon.ico, retrieved 11 November 2026. The icon belongs to Autodesk.
