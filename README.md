# SB05 Review Dashboard

Single-page review dashboard for management and discipline leads: ARX header, overview charts, discipline filters and review register. Click a status, outcome, discipline or deadline indicator to filter the register. Void reviews are excluded; overdue and due-in-48-hours indicators are retained.

## Hosting and access

- Frontend: https://emansour07.github.io/SB05_Reviews_DB/
- Cloudflare backend: https://sb05-reviews-api.eslam-mansour.workers.dev
- Owner controls: backend `/admin`, protected by a private owner key.
- Team members open the GitHub Pages link without an account or password.

GitHub Pages serves the dashboard; Cloudflare handles Autodesk authentication, encrypted tokens and shared storage. No ChatGPT hosting or account is needed for this deployment. Credentials and project logs are never committed to this repository. Public viewing is enabled: anyone with the link can read and export the register.

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
