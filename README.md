# SB05 Review Dashboard

Single-page review dashboard for management and discipline leads. Click timing, workflow status, review outcome, or discipline to filter the register. Void reviews are excluded. Includes overdue and due-within-48-hours indicators, document decisions, and CSV export.

## Hosting

- GitHub repository: https://github.com/emansour07/SB05_Reviews_DB
- Existing backend and dashboard: https://sb05-review-control-eslam-1109.gladlapwing.chatgpt.site/
- GitHub Pages serves `pages/index.html`, built with `node build.cjs --pages`. The Pages frontend reads the backend snapshot; Autodesk credentials never reach the browser.
- In GitHub Settings → Pages, choose **GitHub Actions**. Run the **Deploy dashboard** workflow. The expected Pages address is https://emansour07.github.io/SB05_Reviews_DB/ — this is not confirmed live until the workflow succeeds.
- GitHub Pages is static. The Worker backend remains necessary for Autodesk authentication, token refresh and centralized storage. This is not a standalone HTML-only live integration.

The repository contains no project log or Autodesk credentials. The existing shared snapshot is stored separately in the backend. A fresh backend needs an initial upload or successful Forma synchronization.

## Autodesk setup (required before live synchronization)

1. Create an APS **Traditional Web App** in your Autodesk developer hub. Enable the Forma/ACC API. The runtime asks only for `data:read`.
2. The Account/Hub Admin registers the app's Client ID in **Custom Integrations**. A Project Admin role grants project access, but does not replace app provisioning. An existing Autodesk product subscription does not itself supply API credentials.
3. Set the exact callback URL:
   `https://sb05-review-control-eslam-1109.gladlapwing.chatgpt.site/api/forma/callback`
4. Configure these backend runtime values using secure hosting settings:
   - `APS_CLIENT_ID`
   - `APS_CLIENT_SECRET` (secret)
   - `APS_CALLBACK_URL` (the exact URL above)
   - `APS_TOKEN_KEY` (secret: base64-encoded 32 random bytes for AES-GCM token encryption)
   - `SB05_SYNC_SECRET` (secret: a long random scheduler authorization token)
   Existing `SB05_UPLOADER_EMAIL` and the `BUCKET` R2 binding must remain configured.
5. Sign in as the dashboard owner on the backend site. Open **Forma connection → Connect Autodesk**, then sign in with the Project Admin account and authorize read access.
6. Click **Synchronize now**. Compare review counts, active deadlines, assignees and exact outcome labels against the current Forma export before enabling the schedule.

Target project: `3a53d588-cf1e-451a-8083-4febcfb07486`. The backend fixes this project in code; visitors cannot substitute a different project or arbitrary API URL.

## Automatic updates

After the first successful live verification:

- Add the GitHub Actions secret `SB05_SYNC_SECRET` with the same value as the backend.
- Set repository Actions variable `FORMA_SYNC_ENABLED` to `true`.
- Run **Synchronize Forma** once and confirm success. The workflow then requests synchronization every five minutes. GitHub schedules may be delayed; this is near-live polling, not guaranteed instantaneous delivery.
- Open dashboards reread the central snapshot every 30 seconds. Rebuilding or resending the HTML is unnecessary.

Any viewer can use **Refresh** to request a new Forma synchronization through the backend. The fixed SB05 project and encrypted Autodesk credentials stay server-side. Refresh requests from the hosted dashboard or GitHub Pages share a one-minute cooldown, a synchronization lock, and failure/rate-limit backoff. Uploads and Autodesk connection management remain owner-only. Viewers see last-update times and simple update messages; technical connection controls and source notes are hidden, and unavailable round/comment fields are omitted for Forma data.

The scheduler calls only the backend, using its separate authorization token. Provider access/refresh tokens are encrypted in private R2 objects. The public read API exposes only the dashboard snapshot and a sanitized connection status.

Failed, incomplete or unexpectedly empty fetches do not replace the existing snapshot. Rate limits defer the next attempt. Concurrent syncs use a conditional R2 lease and uploads/syncs use revision checks.

## Coverage and remaining validation

The connector reads active/non-archived reviews and each review's workflow and latest-round file versions. It retains custom approval labels, workflow status, assignees, creation/finish dates and current-step deadlines. VOID records are omitted. Round numbers and document comments are not returned by the selected endpoints; the UI labels these as unavailable rather than inventing values. Archived reviews are intentionally excluded and this is noted in the UI.

Automated tests use simulated Autodesk responses. **An authenticated read of the SB05 project has not yet been verified.** OAuth, permissions, pagination and field mappings must be checked with that project after app provisioning.

## Development

Node.js 22 or later. No npm dependencies are required for build/tests.

```sh
node build.cjs --pages
node test-forma.mjs
```

`worker.mjs` uses trusted identity headers injected by Sites. **Do not deploy this backend to a raw public Worker host unchanged**: those headers require a trusted gateway. A move to company hosting must replace this owner-authentication adapter and configure durable storage and scheduler credentials. The public Pages frontend can remain unchanged if its backend URL and backend CORS allowlist are updated together.

Never commit `.env`, client secrets, access/refresh tokens, uploaded reports or exported project data. Public dashboard viewing remains enabled as requested; anyone with the link can read and export the register.

## References and branding

- [Autodesk application and integration setup](https://get-started.aps.autodesk.com/)
- [Reviews API](https://aps.autodesk.com/en/docs/acc/v1/reference/http/reviews-reviews-GET/)
- [Latest review file versions](https://aps.autodesk.com/en/docs/acc/v1/reference/http/reviews-getreviewversions-GET/)
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- ARX logo: vector from https://www.arx.ing/en, retrieved 11 November 2026.

Logos belong to their respective organizations and identify the project parties.

