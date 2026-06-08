# MIRROR X AI — Full Deployment Guide

> Deploy the complete 3-service stack to production.
> Written for someone who has never deployed before. Follow every step in order.

---

## What You're Deploying

| Service | Tech | Host | Cost |
|---|---|---|---|
| **Frontend** | React + Vite | Vercel | Free |
| **Backend** | Node.js + Express + Prisma | Render | Free |
| **AI Service** | Python + FastAPI | Render | Free |
| **Database** | PostgreSQL | Render | Free |

---

## Before You Start — What You Need

1. A **GitHub account** — [github.com](https://github.com)
2. A **Vercel account** — [vercel.com](https://vercel.com) (sign up with GitHub)
3. A **Render account** — [render.com](https://render.com) (sign up with GitHub)
4. Your **Gemini API key** — you already have it in `ai/.env`
5. Your code pushed to a GitHub repository

---

## STEP 0 — Push Your Code to GitHub

If your code is not on GitHub yet, do this first.

```bash
# Open a terminal in the project root folder (mirror-x-ai)
git init
git add .
git commit -m "initial deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mirror-x-ai.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

> ⚠️ Make sure `.env` files are in your `.gitignore`. Never push secrets to GitHub.

---

## STEP 1 — Deploy the Database on Render

The database must be deployed first because the backend needs its connection URL.

### 1.1 Create a PostgreSQL database

1. Go to [render.com](https://render.com) and log in
2. Click the **New +** button (top right)
3. Select **PostgreSQL**
4. Fill in these fields:
   - **Name:** `mirror-x-ai-db`
   - **Database:** `mirror_x_ai`
   - **User:** `mirror_x_ai_user` (Render auto-fills this)
   - **Region:** Choose the closest to you (e.g. `Oregon (US West)`)
   - **PostgreSQL Version:** `16`
   - **Plan:** Select **Free**
5. Click **Create Database**
6. Wait about 1–2 minutes for it to be ready

### 1.2 Copy the connection URL

1. Once created, click on your database name to open it
2. Scroll down to the **Connections** section
3. Find **External Database URL** — it looks like:
   ```
   postgresql://mirror_x_ai_user:ylkfLNimiDyGVtnLACqO2K7hygkF4m8s@dpg-d8ig04vlk1mc7384o9sg-a.oregon-postgres.render.com/mirror_x_ai
   ```
4. Click the **copy** icon next to it
5. **Save this URL somewhere safe** — you will need it in Step 2

---

## STEP 2 — Deploy the Backend (Node.js) on Render

### 2.1 Create a new Web Service

1. Click **New +** → **Web Service**
2. Connect your GitHub account if prompted
3. Select your `mirror-x-ai` repository
4. Click **Connect**

### 2.2 Configure the service

Fill in these fields exactly:

| Field | Value |
|---|---|
| **Name** | `mirror-x-ai-backend` |
| **Region** | Same as your database (e.g. Oregon) |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `chmod +x build.sh && ./build.sh` |
| **Start Command** | `node dist/server.js` |
| **Plan** | `Free` |

### 2.3 Add Environment Variables

Scroll down to **Environment Variables** and click **Add Environment Variable** for each one:

| Key | Value |
|---|---|
| `PORT` | `3001` |
| `DATABASE_URL` | *(paste the External Database URL you copied in Step 1.2)* |
| `JWT_SECRET` | *(type any long random string, e.g. `mirrorXai_super_secret_jwt_2025_production`)* |
| `AI_SERVICE_URL` | *(leave blank for now — you will fill this after Step 3)* |
| `NODE_ENV` | `production` |
| `CLOUDINARY_CLOUD_NAME` | *(your Cloudinary cloud name — see Phase 7 below)* |
| `CLOUDINARY_API_KEY` | *(your Cloudinary API key)* |
| `CLOUDINARY_API_SECRET` | *(your Cloudinary API secret)* |

> ⚠️ Do NOT use your local `localhost` DATABASE_URL here. You must use the Render External URL.

### 2.4 Deploy

Click **Create Web Service**. The first build takes 3–5 minutes.

Once deployed, you'll get a URL like:
```
https://mirror-x-ai-backend.onrender.com
```

**Copy this URL** — you will need it in Steps 3 and 4.

---

## STEP 3 — Deploy the AI Service (Python) on Render

### 3.1 Make sure you have a requirements.txt

In your `ai/` folder, check if `requirements.txt` exists. If not, run this locally:
```bash
cd ai
pip freeze > requirements.txt
```
Then commit and push to GitHub.

### 3.2 Create a new Web Service for AI

1. Click **New +** → **Web Service**
2. Select the same `mirror-x-ai` repository
3. Click **Connect**

### 3.3 Configure the service

| Field | Value |
|---|---|
| **Name** | `mirror-x-ai-ai` |
| **Region** | Same as backend |
| **Branch** | `main` |
| **Root Directory** | `ai` |
| **Runtime** | `Python 3` |
| **Build Command** | `chmod +x build.sh && ./build.sh` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port 8000` |
| **Plan** | `Free` |

> ⚠️ **IMPORTANT — Python version:** After creating the service, go to **Settings → Environment** and add this environment variable to force Python 3.11:
> | Key | Value |
> |---|---|
> | `PYTHON_VERSION` | `3.11.9` |
>
> Render's default is Python 3.14 which breaks pandas/numpy compilation. Python 3.11 has pre-built wheels for all packages.

### 3.4 Add Environment Variables

| Key | Value |
|---|---|
| `GEMINI_API_KEY` | *(your Gemini API key from `ai/.env`)* |
| `AI_SERVICE_PORT` | `8000` |
| `PYTHON_VERSION` | `3.11.9` |

### 3.5 Deploy

Click **Create Web Service**. Once deployed, you'll get a URL like:
```
https://mirror-x-ai-ai.onrender.com
```

**Copy this URL.**

---

## STEP 4 — Link Backend to AI Service

Now that the AI service is deployed, go back and update the backend's environment variable.

1. In Render, click on your **mirror-x-ai-backend** service
2. Click the **Environment** tab
3. Find `AI_SERVICE_URL`
4. Set its value to your AI service URL:
   ```
   https://mirror-x-ai-ai.onrender.com
   ```
5. Click **Save Changes**
6. The backend will automatically redeploy

---

## STEP 5 — Deploy the Frontend on Vercel

The frontend needs to know where the backend lives. You'll set this as an environment variable.

### 5.1 Import your project

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **Add New** → **Project**
3. Find your `mirror-x-ai` repository and click **Import**

### 5.2 Configure the project

Vercel will auto-detect this as a Vite project. Verify these settings:

| Field | Value |
|---|---|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |

> If Vercel doesn't auto-detect the root directory as `frontend`, click **Edit** and change it manually.

### 5.3 Add Environment Variables

Click **Environment Variables** and add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://mirror-x-ai-backend.onrender.com/api` |
| `VITE_WS_URL` | `https://mirror-x-ai-backend.onrender.com` |

### 5.4 Update your frontend API service

Before deploying, update `frontend/src/services/api.ts` to use the environment variable:

```typescript
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
  timeout: 90000,
})
```

And in `frontend/src/services/socket.ts`, update the socket URL:
```typescript
const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3001', {
  autoConnect: false,
})
```

Commit these changes and push to GitHub before deploying.

### 5.5 Deploy

Click **Deploy**. Vercel builds and deploys in 1–2 minutes.

You'll get a live URL like:
```
https://mirror-x-ai.vercel.app
```

---

## STEP 6 — Fix CORS (Backend Must Allow Vercel Domain)

The backend currently allows all origins (`cors: { origin: '*' }`). For production you should restrict it to your Vercel domain, but for now `*` will work. If you see CORS errors in the browser console, do this:

1. In Render, go to your backend service → **Environment**
2. Add this variable:
   | Key | Value |
   |---|---|
   | `FRONTEND_URL` | `https://mirror-x-ai.vercel.app` |
3. In `backend/src/server.ts`, update the CORS config:
   ```typescript
   app.use(cors({
     origin: process.env.FRONTEND_URL || '*',
     credentials: true,
   }))
   ```

---

## STEP 7 — Verify Everything Works

Open your Vercel URL and test:

- [ ] Login page loads
- [ ] Can register a new account
- [ ] Can log in
- [ ] Investigation page loads
- [ ] Can submit a URL for analysis
- [ ] Can upload an image
- [ ] Pipeline progress shows stages
- [ ] Results appear after analysis
- [ ] Chat/follow-up buttons work
- [ ] Can generate a report

---

## STEP 8 — Free Tier Limitations (Important)

Render's free tier has one major limitation: **services spin down after 15 minutes of inactivity**. The first request after a spin-down takes 30–60 seconds to respond.

**Solutions:**
- Accept the cold-start delay (fine for demos)
- Use a free uptime monitor like [UptimeRobot](https://uptimerobot.com) to ping your backend URL every 10 minutes, keeping it warm

---

## Your Final URLs

Once everything is deployed, you'll have:

| Service | URL |
|---|---|
| **Frontend (live app)** | `https://mirror-x-ai.vercel.app` |
| **Backend API** | `https://mirror-x-ai-backend.onrender.com` |
| **AI Service** | `https://mirror-x-ai-ai.onrender.com` |
| **Database** | Managed by Render (no direct URL needed) |

---

## Troubleshooting

### Backend build fails with Prisma error
Add this to the build command:
```
npm install --include=dev && npm run build && npx prisma generate && npx prisma migrate deploy
```
Make sure `DATABASE_URL` is set correctly in Render environment variables.

### Backend build fails with TypeScript errors (@types not found)
This happens because Render skips `devDependencies` by default. Use `--include=dev` in your build command as shown above. TypeScript, `@types/express`, `@types/bcrypt` etc. are all in devDependencies and must be installed for the build to succeed.

### AI service fails to start
- Check that `requirements.txt` is in the `ai/` folder
- Check that `app/main.py` exists and exports a FastAPI `app` object
- Check that `GEMINI_API_KEY` is set in environment variables

### Frontend shows "Network Error" or blank page
- Open browser DevTools → Console tab
- If you see CORS errors, go to Step 6
- If you see 404 errors, double-check `VITE_API_URL` is set correctly in Vercel

### "Cannot connect to database" on backend
- Make sure you used the **External** Database URL from Render (not the Internal one)
- The Internal URL only works between Render services in the same region

### Uploads not working in production
Render's free tier does not have persistent disk storage. Uploaded files are lost on redeploy. For a demo this is acceptable. For production, configure an AWS S3 bucket or Cloudinary and update the upload middleware to store files there instead of the local filesystem.
