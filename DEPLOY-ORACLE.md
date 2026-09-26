# Deploying Black Heritage on Oracle Cloud (Always Free)

The whole stack runs on one Always Free Arm VM: Nginx serves the built frontend, Node serves the API, MongoDB Community stores the data. Zero monthly cost. Verify current Always Free limits at oracle.com/cloud/free before you provision; the shape below is the long-standing offer (4 Arm OCPUs and 24 GB memory across Ampere A1 instances, 200 GB block storage, 2 tiny AMD micro VMs).

One VM runs everything. When traffic outgrows it, add a second VM behind Nginx and split Mongo onto its own instance, still inside the free tier.

## 1. Provision the VM

1. Create an Oracle Cloud account (card required for identity, not charged on Always Free).
2. Compute > Create Instance:
   - Image: **Ubuntu 22.04** (aarch64)
   - Shape: **VM.Standard.A1.Flex**, 2 OCPU, 12 GB (leave half the free quota headroom)
   - Boot volume: 100 GB
3. Networking: create the instance in a public subnet. After it exists, open the security list for ports 80, 443, and 22 (ingress rules in the VCN). Do **not** open 27017 or 3001.
4. Add your SSH key. Connect: `ssh ubuntu@<PUBLIC_IP>`

## 2. Install the stack

```bash
ssh ubuntu@<PUBLIC_IP>

# Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# MongoDB Community 7 (Arm)
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl enable --now mongod

# Nginx + certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# pm2 keeps the API alive and starts it on boot
sudo npm i -g pm2
```

Harden Mongo (local-only binding, auth on):

```bash
sudo mongosh --eval 'db.createUser({user:"bh_admin",pwd:"CHOOSE_A_STRONG_PASSWORD",roles:["root"]})'
```

Edit `/etc/mongod.conf`:

```yaml
net:
  bindIp: 127.0.0.1
  port: 27017
security:
  authorization: enabled
```

```bash
sudo systemctl restart mongod
```

## 3. Ship the app

From your machine:

```bash
git clone <YOUR_REPO_URL> && cd blackheritage
# keep .env OFF git; scp it up once
scp .env ubuntu@<PUBLIC_IP>:~/blackheritage/.env
# --exclude uploads matters: without it your local dev media is pushed over
# the live media folder, and any --delete run erases every uploaded image.
rsync -av --exclude node_modules --exclude .env --exclude .freebuff --exclude uploads ./ ubuntu@<PUBLIC_IP>:~/blackheritage/
```

On the VM:

```bash
cd ~/blackheritage
npm ci
npm run build        # builds client/dist and dist/index.cjs
mkdir -p uploads
```

Create `/home/ubuntu/blackheritage/.env` values for production:

```
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://bh_admin:CHOOSE_A_STRONG_PASSWORD@127.0.0.1:27017/blackheritage?authSource=admin
SESSION_SECRET=<64+ random chars>
FRONTEND_URL=https://blackhevents.com
PUBLIC_APP_URL=https://blackhevents.com
PAYSTACK_PUBLIC_KEY=pk_live_...
PAYSTACK_SECRET_KEY=sk_live_...
RESEND_API_KEY=re_...
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

Generate the session secret: `openssl rand -hex 32`.

## 4. pm2 service

```bash
cd ~/blackheritage
pm2 start dist/index.cjs --name bh-api
pm2 save
pm2 startup systemd   # run the command it prints
```

The server serves the built client from `client/dist` when `NODE_ENV=production` (Express static), so one process does both jobs. If your build does not wire static serving, keep Nginx `root` pointed at `~/blackheritage/client/dist` as configured below.

## 4b. Required production environment variables

Set these on the server (pm2 ecosystem file or systemd unit) — never committed to the repo:

```
NODE_ENV=production
PUBLIC_APP_URL=https://blackhevents.com
SESSION_SECRET=<64+ random chars, e.g. openssl rand -hex 48>
MONGODB_URI=<your connection string>
```

- `PUBLIC_APP_URL` — every email link and share URL is built from it. If it is missing, links silently point at localhost:5000.
- `SESSION_SECRET` — the server refuses to start in production without it (session cookies would be predictable).
- Payment keys: `PAYSTACK_SECRET_KEY` (or `FLUTTERWAVE_SECRET_KEY` + `FLUTTERWAVE_WEBHOOK_HASH`). The gateway with keys present wins. Switch to `sk_live_*`/live Flutterwave keys when real money starts; webhooks must be re-pointed at `https://blackhevents.com/api/payments/webhook` in the dashboard when you do.
- Optional: `RESEND_API_KEY` (transactional email), `GEMINI_API_KEY` (flyer extraction), `GOOGLE_CLIENT_ID/SECRET` (social login).

## 5. Cloudflare SSL and Nginx

Because you are using Cloudflare, you do not need Certbot renewals that can fail or get rate-limited. Cloudflare provides a free **Origin CA Certificate** valid for up to 15 years.

### A. Generate Cloudflare Origin Certificate

1. Log into your Cloudflare Dashboard -> select your domain.
2. Go to **SSL/TLS** > **Origin Server** > click **Create Certificate**.
3. Keep the defaults:
   - Private key type: RSA (2048)
   - Hostnames: `*.blackhevents.com`, `blackhevents.com`
   - Validity: 15 years
4. Copy the **Origin Certificate** and save it on your Oracle VM:
   ```bash
   sudo nano /etc/ssl/certs/cloudflare-origin.pem
   # Paste the certificate and save
   ```
5. Copy the **Private Key** and save it on your Oracle VM:
   ```bash
   sudo nano /etc/ssl/private/cloudflare-origin.key
   # Paste the private key and save
   sudo chmod 600 /etc/ssl/private/cloudflare-origin.key
   ```
6. In Cloudflare Dashboard, go to **SSL/TLS** > **Overview** and set the encryption mode to **Full (strict)**.

---

### B. Configure Nginx with Cloudflare Real IP

`/etc/nginx/sites-available/blackheritage`:

```nginx
# Restore real visitor IPs from Cloudflare proxy headers
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
real_ip_header CF-Connecting-IP;

# HTTP -> HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name blackhevents.com www.blackhevents.com *.blackhevents.com;
    return 301 https://$host$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name blackhevents.com www.blackhevents.com *.blackhevents.com;

    ssl_certificate /etc/ssl/certs/cloudflare-origin.pem;
    ssl_certificate_key /etc/ssl/private/cloudflare-origin.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 60m;   # uploads cap is 50MB

    # Built frontend
    root /home/ubuntu/blackheritage/client/dist;
    index index.html;

    # API + uploads proxy to Node
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # SPA fallback
    # NOTE: no $uri/ here. client/public/events/ is an image folder, so the
    # built dist contains a real events/ directory; with $uri/ nginx treats
    # the /events route as that directory, 301s to /events/, and 403s on the
    # missing directory index - the SPA route never loads. Without $uri/,
    # files inside (posters) still serve via $uri and every /events/* path
    # falls through to the app.
    location / {
        try_files $uri /index.html;
    }

    # Event pages MUST hit Node, not the static fallback: Express injects
    # per-event OG tags (WhatsApp/X preview cards) into the HTML shell.
    location ~ ^/(e/.+|events/.+)$ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Enable the configuration and reload Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/blackheritage /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### If /events already 403s on a live server (hotfix)

The deployed config predates the fix above. One line, then reload:

```bash
sudo sed -i 's|try_files \$uri \$uri/ /index.html;|try_files \$uri /index.html;|' /etc/nginx/sites-available/blackheritage
sudo nginx -t && sudo systemctl reload nginx
```

Verify with curl: https://blackhevents.com/events must answer 200, and a poster
like https://blackhevents.com/events/palmwine-music-festival.jpg must still serve.

---

## 6. Cloudflare DNS Configuration

In your Cloudflare Dashboard under **DNS** > **Records**, add the following records:

| Type | Name | Target / Content | Proxy Status | Note |
|---|---|---|---|---|
| **A** | `@` | `<YOUR_ORACLE_PUBLIC_IP>` | **Proxied (Orange Cloud)** | Apex domain (`blackhevents.com`) |
| **CNAME** | `www` | `@` | **Proxied (Orange Cloud)** | Web redirect |
| **CNAME** | `*` | `@` | **Proxied (Orange Cloud)** | Wildcard for organizer hubs (`*.blackhevents.com`) |
| **CNAME** | `cname` | `@` | **Proxied (Orange Cloud)** | White-label custom domain target |

### Gateway Wiring:
1. **Paystack Dashboard**: set webhook URL to `https://blackhevents.com/api/paystack/webhook`, switch to live keys.
2. **Resend**: add your domain, configure SPF/DKIM DNS records in Cloudflare, verify status.
3. **Google Cloud Console**: OAuth redirect URI set to `https://blackhevents.com/api/auth/google/callback`.

## 7. Ops

```bash
pm2 logs bh-api        # API logs
pm2 restart bh-api     # after every deploy: git pull && npm ci && npm run build
sudo certbot renew --dry-run
mongodump --uri="..." --out=~/backups/$(date +%F)   # cron this nightly
```

Free-tier watch-outs:

- The A1 quota is regional; if "out of capacity" appears, try another home region or retry off-peak.
- Idle Always Free VMs with low utilization can be stopped (roughly 7 days idle), and the instance is deleted about 90 days later. Converting the account to Pay As You Go stops idle reclamation, and real traffic solves it anyway.
- 200 GB block storage is the ceiling across everything, so keep `uploads/` pruned if media grows; move to object storage when revenue starts.

## 8. Media storage and backups

Uploads (event covers, galleries, vendor portfolios, organizer logos, avatars) live in `~/blackheritage/uploads/portfolio/`, and Nginx proxies `/uploads/` to Node. **That folder survives pm2 restarts and redeploys.** It disappears only if the boot volume is lost, the instance is reclaimed, or a deploy runs `rsync --delete` without `--exclude uploads`.

To move media off the VM, set all five of these in the production env and restart:

```
R2_ACCOUNT_ID=<cloudflare account id>
R2_BUCKET=blackheritage-media
R2_ACCESS_KEY_ID=<R2 API token id>
R2_SECRET_ACCESS_KEY=<R2 API token secret>
R2_PUBLIC_BASE_URL=https://cdn.blackhevents.com
```

Create the bucket, then an R2 API token with Object Read & Write scoped to that bucket. Do not use the `r2.dev` URL in production; it is rate limited. Connect a custom domain and keep it proxied through Cloudflare. If any one of the five is missing, storage stays on disk, so this is not a flag day: old `/uploads/portfolio/...` rows keep serving from the VM while new uploads go to R2.

Verify: `curl -s https://blackhevents.com/api/health` answers `OK (media: r2)` with the keys set, and `OK (media: disk)` without them.

### Backups

MongoDB, the app, and every uploaded image share one boot volume, so a nightly dump that stays on that same disk is not a backup:

```bash
sudo mkdir -p /var/backups/blackheritage
# crontab -e (03:15 nightly, 14-day local retention)
15 3 * * * mongodump --host 127.0.0.1 --username bh_admin --password '<pw>' --authenticationDatabase admin --db blackheritage --archive=/var/backups/blackheritage/db-$(date +\%F).archive --gzip && tar -czf /var/backups/blackheritage/uploads-$(date +\%F).tar.gz -C /home/ubuntu/blackheritage uploads && find /var/backups/blackheritage -type f -mtime +14 -delete
```

Then copy those files off the VM (rclone to R2, or `scp` to another machine). A dump sitting on the same volume as the database only counts as recovery if the volume survives.

### Warning: every boot re-seeds demo accounts

`registerRoutes()` calls `seedPlatform()` on startup with no production check. The seed creates demo logins with published passwords (`admin`/`admin123`, `tunde_organizer`/`demo1234`, `gate_staff`/`demo1234`) and re-promotes their roles on each run, so on this VM **every `pm2 restart` restores an admin account anyone can log into**. Deleting or demoting it does not stick. Guard the seed for production, then rotate those passwords and remove the demo rows.
