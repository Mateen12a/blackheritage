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
rsync -av --exclude node_modules --exclude .env --exclude .freebuff ./ ubuntu@<PUBLIC_IP>:~/blackheritage/
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

## 5. Nginx

`/etc/nginx/sites-available/blackheritage`:

```nginx
server {
    listen 80;
    server_name blackhevents.com www.blackhevents.com;

    client_max_body_size 60m;   # uploads cap is 50MB

    # Built frontend
    root /home/ubuntu/blackheritage/client/dist;
    index index.html;

    # API + uploads proxy to Node
    location /api/ { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; }
    location /uploads/ { proxy_pass http://127.0.0.1:3001; }

    # SPA fallback
    location / { try_files $uri /index.html; }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/blackheritage /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# HTTPS, free, auto-renews
sudo certbot --nginx -d blackhevents.com -d www.blackhevents.com
```

## 6. Point DNS and wire the gateways

1. At your registrar: `blackhevents.com` A record -> the VM public IP. The IP is static while the instance runs; reserve it if you stop the instance.
2. Paystack dashboard: set the webhook to `https://blackhevents.com/api/paystack/webhook`, switch to live keys.
3. Resend: add `blackhevents.africa`, add the DKIM/SPF DNS records, wait for "verified".
4. Google Cloud Console: OAuth client with redirect `https://blackhevents.com/api/auth/google/callback`. Put the client id/secret in `.env`.
5. MongoDB Atlas: once the VM runs its own Mongo, you can cancel Atlas or keep it as a backup target.

## 7. Ops

```bash
pm2 logs bh-api        # API logs
pm2 restart bh-api     # after every deploy: git pull && npm ci && npm run build
sudo certbot renew --dry-run
mongodump --uri="..." --out=~/backups/$(date +%F)   # cron this nightly
```

Free-tier watch-outs:

- The A1 quota is regional; if "out of capacity" appears, try another home region or retry off-peak.
- Idle Always Free VMs with low utilization can be reclaimed; pm2 keeps the process up, and real traffic solves it anyway.
- 200 GB block storage is the ceiling across everything, so keep `uploads/` pruned if media grows; move to object storage when revenue starts.
