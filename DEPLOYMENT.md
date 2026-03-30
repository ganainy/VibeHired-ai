# Deployment Guide

This guide walks you through deploying VibeHired to Netlify (frontend) and Heroku (backend) with automatic deployment on every git push. Both platforms will automatically redeploy when you push changes to your repository.

## Prerequisites

- Node.js (v18+) installed locally
- Git repository set up and pushed to GitHub/GitLab/Bitbucket
- MongoDB Atlas account (free tier works)
- Netlify account (free tier works)
- Heroku account (free tier available, but consider paid tier for production)

## Part 1: MongoDB Atlas Setup

1. **Create a MongoDB Atlas Cluster**
   - Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Sign up or log in
   - Create a new cluster (free tier M0 is sufficient)
   - Wait for the cluster to be created (2-3 minutes)

2. **Configure Database Access**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and strong password (save these!)
   - Set user privileges to "Atlas admin" or "Read and write to any database"
   - Click "Add User"

3. **Configure Network Access**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - For Heroku deployment, click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"
   - Note: For production, consider restricting to specific IPs

4. **Get Connection String**
   - Go to "Database" in the left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `job-app-assistant` (or your preferred database name)
   - Example: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/job-app-assistant?retryWrites=true&w=majority`
   - **Save this connection string** - you'll need it for Heroku

## Part 2: Heroku Backend Deployment with Auto-Deploy

### Step 1: Create Heroku App

1. **Go to [Heroku Dashboard](https://dashboard.heroku.com)**
   - Sign up or log in

2. **Create a new app:**
   - Click "New" → "Create new app"
   - Enter an app name (e.g., `your-app-name-backend`)
   - Choose a region
   - Click "Create app"

3. **Note your Heroku app URL:**
   - It will be: `https://your-app-name-backend.herokuapp.com`
   - **Save this URL** - you'll need it for Netlify configuration

### Step 2: Configure Environment Variables

Set the required environment variables on Heroku:

1. **Go to your Heroku Dashboard:**
   - Select your app (e.g., `your-app-name-backend`)

2. **Navigate to Settings:**
   - Click on the **Settings** tab
   - Scroll down to the **Config Vars** section
   - Click **Reveal Config Vars** or **Edit Config Vars**

3. **Add the following environment variables:**
   - Click **Add** for each variable and enter:
   
   | Key | Value | Notes |
   |-----|-------|-------|
   | `MONGODB_URI` | `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/job-app-assistant?retryWrites=true&w=majority` | Replace with your MongoDB connection string from Part 1 |
   | `JWT_SECRET` | `your-super-secret-jwt-key-min-32-chars` | Generate a strong random string (min 32 chars): `openssl rand -base64 32` |
   | `ENCRYPTION_KEY` | `your-encryption-key-min-32-chars` | Generate a strong random string (min 32 chars): `openssl rand -base64 32` |
   | `GEMINI_API_KEY` | `AIza...` | Required for all AI features. Get from [Google AI Studio](https://makersuite.google.com/app/apikey) |
   | `APIFY_API_KEY` | `apify_api_...` | Required for LinkedIn profile scraping. Get from [Apify Console](https://console.apify.com/account/integrations) |
   | `SMTP_HOST` | `smtp.gmail.com` | SMTP server for password-reset and verification emails |
   | `SMTP_PORT` | `587` | SMTP port |
   | `SMTP_USER` | `your-gmail@gmail.com` | Gmail address used to send emails |
   | `SMTP_PASS` | `xxxx xxxx xxxx xxxx` | 16-character Google App Password (not your Gmail password) |
   | `FRONTEND_URL` | `https://your-netlify-app.netlify.app` | Set a placeholder for now, update after Netlify deployment. Supports comma-separated origins. |
   | `PUPPETEER_EXECUTABLE_PATH` | `/app/.apt/usr/bin/google-chrome-stable` | Recommended for PDF generation in Heroku/container environments when using system Chrome |
   | `NODE_ENV` | `production` | Set to production mode |
   | `CLOUDINARY_CLOUD_NAME` | `your-cloud-name` | Your Cloudinary cloud name (from Cloudinary Dashboard) |
   | `CLOUDINARY_API_KEY` | `your-api-key` | Your Cloudinary API key (from Cloudinary Dashboard) |
   | `CLOUDINARY_API_SECRET` | `your-api-secret` | Your Cloudinary API secret (from Cloudinary Dashboard) |

4. **Save each variable:**
   - Click **Add** after entering each key-value pair
   - Your app will automatically restart after each config var is added

**Note:** The `PORT` variable is automatically set by Heroku - you don't need to add it.

### Step 2.1: Chrome for PDF Rendering (Puppeteer)

Cover letter/CV PDF endpoints use Puppeteer. If your deployment does not include Puppeteer's bundled Chrome, install system Chrome and set:

- `PUPPETEER_EXECUTABLE_PATH=/app/.apt/usr/bin/google-chrome-stable`

For Heroku, the common setup is adding a Google Chrome buildpack before the Node.js buildpack, then redeploying.

### Step 3: Connect GitHub Repository for Auto-Deploy

1. **Go to the Deploy tab:**
   - In your Heroku app dashboard, click the **Deploy** tab

2. **Connect to GitHub:**
   - Under "Deployment method", click **Connect to GitHub**
   - Authorize Heroku to access your GitHub account if prompted
   - Search for your repository name
   - Click **Connect** next to your repository

3. **Enable Automatic Deploys:**
   - Scroll down to "Automatic deploys"
   - Select the branch you want to deploy (usually `main` or `master`)
   - Optionally check "Wait for CI to pass before deploy" (if you have CI/CD)
   - Click **Enable Automatic Deploys**

4. **Manual Deploy (First Time):**
   - Scroll to "Manual deploy"
   - Select your branch (usually `main`)
   - Click **Deploy Branch**
   - Wait for the build to complete

5. **Verify deployment:**
   - Once deployed, click **View** or visit `https://your-app-name-backend.herokuapp.com`
   - You should see: "Job App Assistant Backend is Running!"

### Step 4: Verify Heroku Configuration

The project is already configured for Heroku deployment:

- ✅ `Procfile` is at the root directory with `web: npm start`
- ✅ Root `package.json` has `heroku-postbuild` script that builds the server
- ✅ Root `package.json` has `start` script that runs the server

**How it works:**
1. Heroku detects `package.json` and `Procfile` at the root
2. Runs `npm install` (installs all workspace dependencies)
3. Runs `heroku-postbuild` (builds the server TypeScript code)
4. Runs `web: npm start` from Procfile (starts the server)

## Part 3: Netlify Frontend Deployment with Auto-Deploy

### Step 1: Deploy via Netlify Dashboard

1. **Go to [Netlify](https://app.netlify.com)**
   - Sign up or log in

2. **Add a new site:**
   - Click "Add new site" → "Import an existing project"
   - Connect to your Git provider (GitHub, GitLab, or Bitbucket)
   - Authorize Netlify to access your repositories
   - Select your repository

3. **Configure build settings:**
   - Netlify auto-detects settings from `netlify.toml` in the repository root. The file already sets:
   - **Base directory:** `client`
   - **Build command:** `npm run build`
   - **Publish directory:** `dist` (relative to base)
   - No manual changes needed here.

4. **Set environment variables:**
   - Before deploying, click "Show advanced" → "New variable"
   - Add the following:
     - **Key:** `VITE_BACKEND_URL`
     - **Value:** `https://your-app-name-backend.herokuapp.com/api`
     - Replace `your-app-name-backend` with your actual Heroku app name
   - Click "Add variable"

5. **Deploy:**
   - Click "Deploy site"
   - Wait for the build to complete
   - Your site will be live at: `https://random-name.netlify.app`

6. **Update site name (optional):**
   - Go to Site settings → General → Site details
   - Click "Change site name"
   - Choose a custom name: `your-app-name.netlify.app`

### Step 2: Verify Auto-Deploy is Enabled

Netlify automatically enables auto-deploy when you connect a Git repository:

1. **Go to Site settings:**
   - In your Netlify dashboard, select your site
   - Go to **Site settings** → **Build & deploy**

2. **Verify Continuous Deployment:**
   - Under "Continuous Deployment", you should see your connected repository
   - The branch should be set to `main` (or `master`)
   - Every push to this branch will trigger a new deployment

### Step 3: Update Heroku CORS Configuration

After you have your Netlify URL, update Heroku:

1. **Go to your Heroku Dashboard:**
   - Visit [Heroku Dashboard](https://dashboard.heroku.com)
   - Select your app
   - Go to **Settings** → **Config Vars**

2. **Update the `FRONTEND_URL` variable:**
   - Find `FRONTEND_URL` in the list
   - Click **Edit** (or the pencil icon)
   - Update the value to your actual Netlify URL: `https://your-netlify-app.netlify.app`
   - Click **Save**

**Alternative: Using Heroku CLI**
```bash
heroku config:set --app your-app-name-backend FRONTEND_URL="https://your-netlify-app.netlify.app"
```
Replace `your-app-name-backend` with your actual Heroku app name.

This will allow your Netlify frontend to make API requests to your Heroku backend.

## Part 4: Automatic Deployment Workflow

Once configured, both platforms will automatically redeploy on every git push:

### How Auto-Deploy Works

**Heroku:**
- When you push to your connected branch (e.g., `main`), Heroku automatically:
  1. Detects the push
  2. Starts a new build
  3. Deploys the updated backend
  4. Restarts the app

**Netlify:**
- When you push to your connected branch (e.g., `main`), Netlify automatically:
  1. Detects the push
  2. Starts a new build
  3. Deploys the updated frontend
  4. Makes it live

### Daily Workflow

1. **Make your changes locally:**
   ```bash
   # Test locally first
   npm run dev
   ```

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

3. **Both platforms automatically deploy:**
   - Heroku: Check the "Activity" tab in your Heroku dashboard
   - Netlify: Check the "Deploys" tab in your Netlify dashboard
   - You'll see build progress and completion status

4. **Verify deployment:**
   - Wait for builds to complete (usually 2-5 minutes)
   - Test your changes on the live sites

## Part 5: Verify Deployment

### Test Frontend

1. **Visit your Netlify URL:**
   - Open: `https://your-app.netlify.app`
   - The app should load

2. **Test registration:**
   - Try creating a new account
   - Check browser console for any errors

3. **Test API connection:**
   - After logging in, try accessing features
   - Check Network tab in browser DevTools
   - API calls should go to your Heroku backend

### Test Backend

1. **Check Heroku logs:**
   - Go to Heroku Dashboard → Your App → More → View logs
   - Or use CLI: `heroku logs --tail --app your-app-name-backend`
   - Look for "MongoDB Connected Successfully"
   - Look for server running message

2. **Test API endpoint:**
   - Visit: `https://your-app-name-backend.herokuapp.com`
   - Replace `your-app-name-backend` with your actual Heroku app name
   - Should see: "Job App Assistant Backend is Running!"

3. **Test API route:**
   - Visit: `https://your-app-name-backend.herokuapp.com/api/auth/register`
   - Should see an error (expected - needs POST request)
   - This confirms the route is accessible

## Part 6: Managing Environment Variables

### Backend (Heroku)

**Using Heroku Dashboard (Recommended):**

1. **Go to your Heroku Dashboard:**
   - Visit [Heroku Dashboard](https://dashboard.heroku.com)
   - Select your app
   - Go to **Settings** → **Config Vars**

2. **Manage config vars:**
   - **Add a variable:** Click **Add**, enter the key and value, then click **Add**
   - **Edit a variable:** Click **Edit** (or pencil icon) next to the variable, update the value, then click **Save**
   - **Remove a variable:** Click **Delete** (or trash icon) next to the variable

**Note:** Your app automatically restarts when you add, edit, or remove config vars.

**Alternative: Using Heroku CLI**
```bash
# Update a single variable
heroku config:set --app your-app-name-backend KEY="new-value"

# Update multiple variables
heroku config:set --app your-app-name-backend KEY1="value1" KEY2="value2"

# View all variables
heroku config --app your-app-name-backend

# Remove a variable
heroku config:unset --app your-app-name-backend KEY
```
Replace `your-app-name-backend` with your actual Heroku app name.

### Frontend (Netlify)

1. **Go to Netlify Dashboard:**
   - Select your site
   - Go to **Site settings** → **Environment variables**

2. **Update variables:**
   - Edit existing variables or add new ones
   - Click "Save"

3. **Redeploy:**
   - Changes require a new deployment
   - Go to **Deploys** → **Trigger deploy** → **Deploy site**
   - Or push a new commit to trigger automatic deployment

## Part 7: Rollback Procedures

If something goes wrong, you can quickly rollback to a previous version.

### Backend Rollback (Heroku)

1. **Go to Heroku Dashboard:**
   - Select your app
   - Go to **Activity** tab

2. **Find the previous successful release:**
   - Browse through your release history

3. **Rollback:**
   - Click the three dots (⋯) next to the release you want
   - Select "Rollback to this release"
   - Confirm the rollback

**Alternative: Using Heroku CLI**
```bash
# List recent releases
heroku releases --app your-app-name-backend

# Rollback to a specific release
heroku rollback v123 --app your-app-name-backend

# Rollback to the previous release
heroku rollback --app your-app-name-backend
```
Replace `your-app-name-backend` with your actual Heroku app name.

### Frontend Rollback (Netlify)

1. **Go to Netlify Dashboard:**
   - Select your site
   - Go to **Deploys** tab

2. **Find the previous successful deploy:**
   - Browse through your deploy history

3. **Rollback:**
   - Click the three dots (⋯) next to the deploy you want
   - Select "Publish deploy"
   - Confirm the rollback

## Part 8: Database Migrations

### Username Migration (One-Time Setup)

**When to run:** This migration should be run **once** when deploying the username feature for the first time or if you have existing users without usernames.

**What it does:** Automatically generates usernames for all existing users based on their email addresses.

#### Run the Migration on Heroku

```bash
# Run migration on Heroku
heroku run npm run migrate:usernames --app your-app-name-backend

# View output
heroku logs --tail --app your-app-name-backend
```
Replace `your-app-name-backend` with your actual Heroku app name.

#### How Usernames Are Generated

- Takes the part before `@` from the email address
- Converts to lowercase
- Replaces special characters with hyphens
- Ensures 3-30 character length
- Handles duplicates by adding number suffixes (e.g., `john-doe`, `john-doe1`)

#### Safety Features

- **Idempotent:** Safe to run multiple times - only affects users without usernames
- **Unique:** Automatically handles duplicate usernames
- **No data loss:** Only adds usernames, doesn't modify existing data

## Part 9: Interview Buddy Companion (Production)

The Interview Buddy overlay is a desktop capability and cannot run inside Netlify/Heroku.
In production, the hosted website launches a locally installed Electron app via the `vibehired://` protocol.

### Step 1: Build desktop installers

From the repository root:

```bash
cd electron
npm install
```

Build Windows installer (NSIS `.exe`):

```bash
npm run dist:win
```

Build macOS installer (`.dmg`) on macOS:

```bash
npm run dist:mac
```

Output files are generated under `electron/release/`.

### Step 2: Host installers publicly

Upload installer artifacts to a public URL users can access, for example:

- GitHub Releases
- S3 / CloudFront
- Cloudflare R2

Use either:

- A single download page URL (recommended)
- A direct installer URL if you only support one platform

### Step 3: Configure Netlify environment variable

In Netlify Dashboard:

1. Site settings
2. Environment variables
3. Add/update:

| Key | Value |
|---|---|
| `VITE_COMPANION_DOWNLOAD_URL` | Public URL from Step 2 |

Example:

```text
VITE_COMPANION_DOWNLOAD_URL=https://github.com/your-org/interview-buddy/releases/latest
```

### Step 4: Redeploy frontend

Trigger a Netlify deploy after setting the variable:

- Push a commit to the connected branch, or
- Deploys -> Trigger deploy -> Deploy site

### Step 5: Verify end-to-end flow on hosted site

1. Open `/interview-buddy` on the production website.
2. Click **Launch Interview Buddy**.
3. If companion is not installed, the page should show a download button using `VITE_COMPANION_DOWNLOAD_URL`.
4. Install the companion app.
5. Click **Launch Interview Buddy** again and confirm the desktop overlay opens.

### Notes

- The NSIS installer registers the `vibehired://` protocol automatically on Windows.
- The manual script `npm run register-protocol` is only for unpacked/dev builds.
- Browser-only hosting cannot provide OS-level overlay, global shortcuts, or screen-share exclusion.

## Troubleshooting

### Frontend Issues

**Build fails:**
- Check Netlify build logs in the Deploys tab
- Ensure all dependencies are in `package.json`
- Verify Node.js version (should be 18+)
- Check `netlify.toml` configuration

**API calls fail:**
- Check `VITE_BACKEND_URL` environment variable in Netlify
- Verify CORS is configured correctly in Heroku
- Check browser console for CORS errors
- Ensure `FRONTEND_URL` in Heroku matches your Netlify URL exactly

**Routes not working:**
- Verify `netlify.toml` has redirect rules
- Check that SPA redirect is configured (should redirect `/*` to `/index.html`)

### Backend Issues

**Build fails:**
- Check Heroku build logs in the Activity tab
- Ensure `Procfile` exists at the root directory
- Verify TypeScript compiles: test locally with `npm run build:server`
- Check that all dependencies are in `server/package.json`

**MongoDB connection fails:**
- Verify `MONGODB_URI` is set correctly in Heroku Dashboard (Settings → Config Vars)
- Check MongoDB Atlas network access (should allow 0.0.0.0/0)
- Verify database user credentials
- Check Heroku logs for connection errors

**CORS errors:**
- Check `FRONTEND_URL` is set correctly in Heroku Dashboard (Settings → Config Vars)
- Verify the URL matches your Netlify domain exactly (no trailing slash)
- Check server logs for CORS errors
- Ensure CORS middleware is configured correctly

**App crashes:**
- Check Heroku logs: Go to Dashboard → Your App → More → View logs
- Verify all environment variables are set in Heroku Dashboard (Settings → Config Vars)
- Check for missing dependencies
- Verify TypeScript build completed successfully

### Common Commands

**Heroku:**
```bash
# View logs
heroku logs --tail --app your-app-name-backend

# View config vars
heroku config --app your-app-name-backend

# Restart app
heroku restart --app your-app-name-backend

# Open app
heroku open --app your-app-name-backend

# Check app status
heroku ps --app your-app-name-backend
```
Replace `your-app-name-backend` with your actual Heroku app name.

**Netlify:**
- View build logs: Go to Deploys tab → Select deploy → View logs
- Environment variables: Site settings → Environment variables
- Trigger deploy: Deploys → Trigger deploy → Deploy site

## Environment Variables Summary

### Heroku (Backend)

**Set these in Heroku Dashboard:** [Dashboard](https://dashboard.heroku.com) → Your App → Settings → Config Vars

- `MONGODB_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - Secret key for JWT tokens (min 32 chars)
- `ENCRYPTION_KEY` - Secret key for encrypting stored data (min 32 chars)
- `GEMINI_API_KEY` - Google Gemini API key (required for all AI features)
- `APIFY_API_KEY` - Apify API token (required for LinkedIn profile scraping)
- `SMTP_HOST` - SMTP server hostname (e.g. `smtp.gmail.com`)
- `SMTP_PORT` - SMTP port (e.g. `587`)
- `SMTP_USER` - Email address used to send password-reset and verification emails
- `SMTP_PASS` - SMTP password / Google App Password
- `FRONTEND_URL` - Your Netlify app URL; supports comma-separated origins
- `NODE_ENV` - Set to `production`
- `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Your Cloudinary API key
- `CLOUDINARY_API_SECRET` - Your Cloudinary API secret
- `PORT` - Automatically set by Heroku (don't add manually)

### Netlify (Frontend)

**Set these in Netlify Dashboard:** Site settings → Environment variables

- `VITE_BACKEND_URL` - Your Heroku backend URL + `/api`
  - Example: `https://your-app-name-backend.herokuapp.com/api`
  - Replace `your-app-name-backend` with your actual Heroku app name
- `VITE_PAYMENTS_ENABLED` - Controls whether Stripe checkout and upgrade CTAs are shown
  - Set to `false` while Stripe is in sandbox mode / not ready for users
  - Set to `true` (or remove the variable entirely) when ready to enable payments

## Best Practices

1. **Test before deploying:**
   - Always test changes locally first
   - Run `npm run build:server` and `npm run build:client` to catch build errors
   - Test API endpoints locally

2. **Use meaningful commit messages:**
   - Write clear, descriptive commit messages
   - Makes it easier to track changes and rollback if needed

3. **Monitor deployments:**
   - Check build logs after each deployment
   - Monitor for errors or unusual behavior
   - Test critical features after deployment

4. **Use feature branches:**
   - Create branches for new features
   - Test thoroughly before merging to main
   - Main branch should always be deployable

5. **Keep dependencies updated:**
   - Regularly update npm packages
   - Test updates in a development environment first
   - Update one package at a time to identify issues

## Next Steps

1. **Set up custom domain (optional):**
   - Netlify: Site settings → Domain management
   - Heroku: Settings → Domains

2. **Enable HTTPS:**
   - Both Netlify and Heroku provide HTTPS by default
   - No additional configuration needed

3. **Set up monitoring:**
   - Consider adding error tracking (Sentry, etc.)
   - Set up uptime monitoring
   - Configure alerts for failed deployments

4. **Optimize performance:**
   - Enable Netlify CDN caching
   - Optimize images and assets
   - Consider Heroku add-ons for performance

## Support

If you encounter issues:
1. Check the logs (Heroku Activity tab and Netlify Deploys tab)
2. Verify all environment variables are set correctly
3. Ensure MongoDB Atlas is accessible
4. Check CORS configuration
5. Verify build processes complete successfully
6. Review the troubleshooting section above
