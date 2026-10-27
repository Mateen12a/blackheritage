# One Render web service: frontend and backend

Use the whole repository. Keep Root Directory blank. The build generates
`client/dist` and `dist/index.cjs`; Express serves both on the same public URL
when `SERVE_FRONTEND=true`. No separate frontend service is required.

## Dashboard settings

| Setting | Value |
| --- | --- |
| Service | Web Service |
| Runtime | Node |
| Root Directory | Blank (repository root) |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Compute | Paid, always-on instance; review the cost before creating |

The root `render.yaml` is the equivalent Blueprint configuration. Local
changes must be pushed to the branch Render deploys before they take effect.

## Environment variables

Set these in Render, not in Git:

```text
NODE_VERSION=22
NODE_ENV=production
SERVE_FRONTEND=true
SKIP_SEED=true
PORT=10000
MONGODB_URI=<confirmed current production connection string>
SESSION_SECRET=<long random secret; reuse the production value if preserving signed sessions>
PUBLIC_APP_URL=https://<your-service>.onrender.com
BASE_URL=https://<your-service>.onrender.com
FRONTEND_URL=https://<your-service>.onrender.com
PAYSTACK_PUBLIC_KEY=<matching live public key>
PAYSTACK_SECRET_KEY=<live secret key>
RESEND_API_KEY=<production email key>
```

Leave `VITE_API_URL` unset or empty: browser requests should use the same
service as the frontend. The Blueprint generates a session secret for a new
service; existing users will need to sign in again if their old cookies use
a different secret. Preserve any production mail sender/reply-to settings
used by your verified Resend domain. Google sign-in additionally needs
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and an authorized callback URL for
the chosen hostname in Google Cloud Console.

## Data and uploads are separate from deploying code

The reachable Atlas database selected by the local `.env` did not contain
the current High Frequency event during the October 27 incident check. Do
not assume it is the live database. An Oracle-local `127.0.0.1` MongoDB URI
will not work from Render. Recover/migrate the actual data or identify the
correct existing remote database first. Allow Render's service outbound
addresses in Atlas network access where needed.

`SKIP_SEED=true` prevents the existing demo seeding routine from running.
Do not recreate organizers/events as a substitute for existing paid booking
and ticket records. Preserve the Oracle boot volume while recovering data.

For new uploads, configure all five existing Cloudflare R2 variables:
`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and
`R2_PUBLIC_BASE_URL`. Without R2, this app writes to `uploads/portfolio`;
those files need a persistent disk mounted at the app's uploads directory
on a paid Render service. Default Render storage is ephemeral. Existing
Oracle `/uploads/...` images must also be copied to durable storage or the
new service's persistent uploads directory; adding R2 keys does not migrate
old images automatically. Persistent-disk charges are separate from compute.

## Verify before domain cutover

1. Confirm `/` renders, JavaScript and CSS load, and `/events` and `/auth`
   work on a direct visit/refresh.
2. Confirm `/api/health` responds and the API returns the real current event,
   existing accounts/bookings and correct uploaded media.
3. Confirm login persists across requests. Test authorized payment, signed
   webhook confirmation, ticket email and gate scanning. A build or healthy
   homepage is not proof that checkout is ready.
4. Add `blackhevents.com` in Render Custom Domains, apply its displayed DNS
   instructions in Cloudflare, and confirm TLS. Update `PUBLIC_APP_URL`,
   `BASE_URL`, and `FRONTEND_URL` to `https://blackhevents.com` and redeploy. If retaining
   `www`, add and verify that hostname too.
5. Keep Paystack's webhook at
   `https://blackhevents.com/api/payments/webhook` when retaining the domain;
   verify delivery after cutover. During temporary-domain testing use its
   correct webhook destination and update OAuth callbacks as needed.
6. Reconcile payments around the outage before resuming paid promotion.

Preparing this configuration does not deploy or charge an account, migrate
data, change DNS, or alter the disabled Oracle instance.
