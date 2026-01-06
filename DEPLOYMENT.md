# Render build & run commands
# Build Command: npm install && npm run build
# Start Command: npm start

# Required Env Vars on Render:
# MONGODB_URI=...
# SESSION_SECRET=...
# PAYSTACK_SECRET_KEY=...
# RESEND_API_KEY=...

# Required Env Vars for Frontend (Vercel):
# VITE_PAYSTACK_PUBLIC_KEY=...

# Vercel Configuration (vercel.json)
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist/public" }
    }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://YOUR_RENDER_BACKEND_URL/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
