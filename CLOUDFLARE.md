# SB05 Cloudflare migration

The frontend stays on GitHub Pages. Cloudflare runs the Autodesk connector and stores the shared snapshot in a SQLite-backed Durable Object. This deployment does not require ChatGPT hosting or accounts.

## Deployment

1. Sign in with Wrangler 4.160.0. Set your account ID in `wrangler.jsonc`. Deployment creates the private `SB05State` SQLite-backed Durable Object.
2. Configure Cloudflare secrets: `APS_CLIENT_ID`, `APS_CLIENT_SECRET`, `APS_CALLBACK_URL`, `APS_TOKEN_KEY`, `SB05_ADMIN_KEY`, and optionally `SB05_SYNC_SECRET` for service calls. Keep these out of Git.
3. `APS_TOKEN_KEY` is a base64-encoded 32-byte random encryption key. `SB05_ADMIN_KEY` is a random owner key of at least 40 characters.
4. Deploy with `npx --yes wrangler@4.160.0 deploy`. Use the returned Worker HTTPS origin in `frontend-config.json`.
5. Register that origin plus `/api/forma/callback` in the Autodesk APS Traditional Web App and in the Cloudflare `APS_CALLBACK_URL` secret.
6. Open the Worker origin plus `/admin`, enter the owner key, and use Forma connection â†’ Connect Autodesk. Authorize with the Autodesk account that has SB05 project access. Synchronize and verify the report.
7. Enable the Cloudflare cron with `FORMA_SYNC_ENABLED=true` after successful verification, then redeploy. Publish GitHub Pages with the verified backend origin.

The free-plan connector performs at most 20 Autodesk reads per invocation and persists progress between batches. A minute cron advances active jobs and starts new jobs on a five-minute cadence. Viewer Refresh continues batches immediately while the page stays open. Only complete results replace the shared snapshot. No paid-plan upgrade is required within Cloudflare's free daily quotas.

## Access and refresh

Viewers can request a Forma update using Refresh without signing in. Requests share a one-minute cooldown and synchronization lock. Failures preserve the prior snapshot. Open pages check the saved data every 30 seconds, while Cloudflare cron can synchronize every five minutes.

The owner uses a separate random access key and signed, host-bound Secure/HttpOnly cookies lasting 12 hours. Incoming `oai-*` headers are stripped and never trusted. Uploads and connection management remain owner-only. Rotate `SB05_ADMIN_KEY` to invalidate sessions. Changing the callback host requires a fresh Autodesk authorization.

The Durable Object stores each JSON object atomically in SQLite using an ETag. Individual objects are limited to 1.9 MB. Larger updates fail without replacing the saved report.

## Repository automation

Pages publishes frontend changes from `main`. The optional **Deploy Cloudflare backend** workflow requires repository variable `CLOUDFLARE_DEPLOY_ENABLED=true`, variable `CLOUDFLARE_ACCOUNT_ID`, and secret `CLOUDFLARE_API_TOKEN`. Runtime Autodesk secrets stay in Cloudflare.

Cloudflare cron owns scheduled synchronization. The manual GitHub recovery workflow requires `FORMA_SYNC_ENABLED`, `SB05_API_ORIGIN`, and the matching `SB05_SYNC_SECRET`; normal viewer refresh does not need it.

## Validation

Run `node build.cjs --pages`, `node test-forma.mjs`, `node test-cloudflare.mjs`, `node test-forma-batches.mjs`, and `npx --yes wrangler@4.160.0 deploy --dry-run`.

Tests cover owner authorization, forged identity headers, cookie tampering/expiry, atomic storage, OAuth replay, encrypted tokens, viewer refresh cooldowns and locks, failed-update retention, pagination, and CORS. Complete a real SB05 sync before switching the frontend to Cloudflare.

The connector reads active/non-archived reviews and latest-round document versions. Round numbers and document comments are unavailable from the selected endpoints and omitted from the Forma viewer. Technical notices and connection controls are hidden from regular viewers.
