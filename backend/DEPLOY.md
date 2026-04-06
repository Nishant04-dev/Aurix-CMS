# Backend HTTPS Setup — Run these commands on your server (65.2.78.201)

## Step 1 — Point DNS
In your domain registrar / Cloudflare:
Add A record:  api.aurixcloud.in → 65.2.78.201

Wait 1-2 minutes for DNS to propagate.

## Step 2 — Install Nginx + Certbot (if not already installed)
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

## Step 3 — Copy Nginx config
```bash
sudo cp /path/to/backend/nginx.conf /etc/nginx/sites-available/aurix-api
sudo ln -sf /etc/nginx/sites-available/aurix-api /etc/nginx/sites-enabled/aurix-api
sudo nginx -t
sudo systemctl reload nginx
```

## Step 4 — Get SSL certificate (free, auto-renews)
```bash
sudo certbot --nginx -d api.aurixcloud.in
```
Follow the prompts. Certbot will auto-fill the SSL paths in nginx.conf.

## Step 5 — Verify
```bash
curl https://api.aurixcloud.in/health
# Should return: {"status":"ok",...}
```

## Step 6 — Rebuild frontend
On your local machine:
```bash
npm run build
```
Then deploy the dist/ folder to app.aurixcloud.in.

That's it. The frontend will now call https://api.aurixcloud.in instead of http://65.2.78.201:25569.
