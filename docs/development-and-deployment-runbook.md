# 1PicDiary Development and Deployment Runbook

## Three ways the app runs

| Mode | Command or trigger | Address | Runtime | Purpose |
|---|---|---|---|---|
| Local development | `npm run dev` | `http://localhost:3000` | macOS Node.js | Daily development and hot reload |
| Local container | `docker run ...` | `http://localhost:8080` | Docker Linux | Verify the production image |
| Cloud Run | Manual deploy or GitHub push | `https://...run.app` | Cloud Run container | Hosted application |

The Dockerfile does not change how `npm run dev` works.

## 1. Start the local development server

From the project directory:

```bash
cd ~/Documents/personal_projects/1PicDiary/1PicDiary
npm install
npm run dev
```

Open:

```text
http://localhost:3001
```

Local development reads `.env.local`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
```

The Google OAuth client must include this authorized redirect URI:

```text
http://localhost:3000/api/auth/google/callback
```

Stop the server with `Control-C` in the terminal.

## 2. Check the code before deployment

Confirm which branch and files are about to be deployed:

```bash
git branch --show-current
git status
```

Run the project checks:

```bash
npm test
npm run lint
npm run build
```

Commit and push the intended version before production deployment:

```bash
git add .
git commit -m "describe the change"
git push origin main
```

Avoid deploying with unexpected uncommitted files. A local `gcloud run deploy --source .` uploads the current directory, including eligible uncommitted changes.

## 3. Build and check the production container locally

Build the image from the Dockerfile:

```bash
docker build -t 1picdiary .
```

Run it with the same local configuration, but override the OAuth callback to use port 8080:

```bash
docker run --rm \
  --env-file .env.local \
  -e GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback \
  -p 8080:8080 \
  1picdiary
```

Open:

```text
http://localhost:8080
```

To test Google OAuth in the local container, add this authorized redirect URI to the Google OAuth client:

```text
http://localhost:8080/api/auth/google/callback
```

Check the important flow:

1. The home page loads.
2. Google Photos connects successfully.
3. Subjects load from Supabase.
4. A large phone photo can be selected.
5. Text preview and composition work.
6. The diary saves to the correct Google Photos album.
7. The diary row appears in Supabase.

Stop the container with `Control-C`. Because `--rm` is set, Docker removes the stopped container automatically; the image remains available.

## 4. Deploy the current local directory manually

Use this when deploying directly from the Mac:

```bash
gcloud run deploy one-pic-diary \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

This uploads a snapshot of the current directory. It does not deploy a Git branch and does not read from GitHub.

For an existing service, Cloud Run retains its environment-variable and secret configuration unless the deployment command explicitly changes it. Verify the service under:

```text
Cloud Run → one-pic-diary → Edit and deploy new revision
                         → Container → Variables & Secrets
```

Expected regular environment variables:

```text
GOOGLE_CLIENT_ID
GOOGLE_REDIRECT_URI
SUPABASE_URL
```

Expected Secret Manager references:

```text
GOOGLE_CLIENT_SECRET → google-client-secret
SUPABASE_SECRET_KEY  → supabase-secret-key
```

## 5. Connect the existing Cloud Run service to GitHub

Do not start from **Create service**. That form rejects `one-pic-diary` because the service already exists.

Use:

1. Open **Cloud Run → Services**.
2. Select **one-pic-diary**.
3. Open the **Source** tab.
4. Click **Connect to repo**.
5. Select **Cloud Build** and authorize GitHub.
6. Grant access only to the 1PicDiary repository.
7. Select the repository.
8. Set the branch expression to `^main$`.
9. Select **Dockerfile** as the build type.
10. Set the Dockerfile location to `/Dockerfile` or the exact format shown by the form.
11. Save the trigger.

After connection:

```text
git push origin main
        ↓
Cloud Build reads GitHub main
        ↓
Dockerfile builds the image
        ↓
Cloud Run deploys a new one-pic-diary revision
```

Cloud Build sees only committed and pushed GitHub content. It cannot see local uncommitted changes.

## 6. Verify the production deployment

After Cloud Run reports success:

1. Open the service URL.
2. Confirm `GOOGLE_REDIRECT_URI` uses that exact hostname:

   ```text
   https://YOUR-CLOUD-RUN-URL/api/auth/google/callback
   ```

3. Confirm the same URI appears under the OAuth client's **Authorized redirect URIs**.
4. Leave **Authorized JavaScript origins** empty for the current server-side OAuth flow.
5. Repeat the phone workflow used during the local container check.
6. Review **Cloud Run → one-pic-diary → Logs** if a request fails.

## Recommended routine

```text
Develop with npm run dev
        ↓
Run tests, lint, and production build
        ↓
Build and check the Docker container locally
        ↓
Commit and push to main
        ↓
GitHub-triggered Cloud Run deployment
        ↓
Test the production URL on a phone
```

