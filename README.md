# Gemini Reflection Journal

A secure, private, user-authenticated reflection journal and conversation assistant built with **Gemini 3.6 Flash**, **Firebase Authentication (Google Sign-In)**, and **Cloud Firestore**.

## Overview & Key Features

- **Federated Authentication**: Passwordless login using Google Sign-In through Firebase Auth. No user credentials or passwords are ever handled or stored by custom application code.
- **Strict Firestore Data Isolation**: Every journal reflection and multi-turn interaction is stored under `/users/{userId}/interactions/{interactionId}`. Firestore security rules ensure that authenticated users cannot access or read another user's reflections.
- **Multi-Turn AI Introspection**: Powered by the Gemini API with structured modes:
  - **Reflect**: Deep, introspective inquiry and emotional validation.
  - **Summarize**: Core takeaways, emotional themes, and synthesis.
  - **Brainstorm**: Concrete next steps, creative perspectives, and actionable experiments.
- **Resilient AI Fallback Ladder**: Built-in automated fallback ladder (`gemini-3.6-flash` &rarr; `gemini-3.1-flash-lite` &rarr; `gemini-flash-latest` &rarr; `gemini-3.7-flash`) with error recovery for status codes `503`, `429`, `404`, and `500`.
- **Zero-Crash Payload Hygiene**: Automatic undefined-stripping and transactional persistence with user feedback and retry escalation.

---

## Architecture & Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **User Identity** | Firebase Authentication | Secure login via Google Sign-In, eliminating credential storage risks. |
| **Backend Database** | Cloud Firestore | User-isolated document storage for reflections and multi-turn conversation turns. |
| **AI Processing Engine** | Gemini 3.6 Flash API | Generates replies, multi-turn dialogue, summaries, and brainstormed action items. |
| **Backend Service** | Express.js + Node.js | Server-side proxy shielding API keys and managing resilient model fallbacks. |
| **Frontend UI** | React 19 + Tailwind CSS | Responsive single-page application with Markdown rendering and history filters. |

---

## Prerequisites

1. **Google Cloud SDK (`gcloud`)** installed and initialized:
   ```bash
   gcloud init
   gcloud auth application-default login
   ```
2. **Node.js 20+** and npm or bun.
3. Enable required Google Cloud services:
   ```bash
   gcloud services enable \
     run.googleapis.com \
     secretmanager.googleapis.com \
     firestore.googleapis.com \
     identitytoolkit.googleapis.com
   ```

---

## Database Security Configuration

Deploy owner-bound security rules to ensure private user isolation. In your project's `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Deploy the rules via Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## Secret Management Setup

Create and manage your `GEMINI_API_KEY` securely in Google Cloud Secret Manager.

```bash
# 1. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 2. Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Cloud Run Deployment Flow

Build and deploy your containerized service to Google Cloud Run:

```bash
# Set your project variables
PROJECT_ID="YOUR_PROJECT_ID"
REGION="us-central1"
SERVICE_NAME="gemini-reflection-journal"

# Deploy container to Cloud Run with Secret Manager environment injection
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest" \
  --port 3000
```

---

## Required Campaign Labeling

Apply the mandatory resource label to register the service for automated challenge verification:

```bash
gcloud run services update <SERVICE_NAME> \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=<REGION>
```

---

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env`:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY to .env
   ```
3. Start the unified development server:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:3000`.

---

## Publishing Directly via GitHub

### Option 1: One-Click Export in Google AI Studio
1. In the Google AI Studio top-right toolbar or **Settings** menu, click **Export** (or the GitHub icon).
2. Select **GitHub**.
3. Authenticate with your GitHub account and choose or create your destination repository (e.g. `gemini-reflection-journal`).
4. Click **Confirm Export** — AI Studio will automatically push all committed project files directly to your GitHub repository.

### Option 2: Push via Git CLI
A local Git repository is already initialized on branch `main` with all files staged and committed. To publish to a new GitHub repository:

```bash
# 1. Create an empty repository on GitHub (e.g., https://github.com/<your-username>/<repo-name>)
# 2. Link your local repository to the GitHub remote
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPOSITORY_NAME>.git

# 3. Push to GitHub main branch
git branch -M main
git push -u origin main
```

---

## Deploying through GitHub Pages

The repository includes a pre-configured GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that builds and publishes the application directly to GitHub Pages.

### Step 1: Enable GitHub Pages with GitHub Actions
1. On GitHub, navigate to your repository.
2. Go to **Settings** &rarr; **Pages** (under the "Code and automation" section).
3. Under **Build and deployment** &gt; **Source**, select **GitHub Actions**.

### Step 2: Authorize Your GitHub Pages Domain in Firebase
To allow Google Sign-In and Cloud Firestore authentication on your GitHub Pages site:
1. Open the [Firebase Console](https://console.firebase.google.com/) for your project (`ai-studio-geminireflection-d96016f3-14fd-4777-b075-a9952b1201b2`).
2. Navigate to **Authentication** &rarr; **Settings** &rarr; **Authorized domains**.
3. Click **Add domain** and enter your GitHub Pages host:
   ```text
   <YOUR_GITHUB_USERNAME>.github.io
   ```

### Step 3: Configure the Backend API Endpoint (Optional / Recommended)
Because GitHub Pages hosts static frontends, the server-side Gemini API calls are securely processed by your deployed backend (e.g., Cloud Run):
1. In your GitHub repository, go to **Settings** &rarr; **Secrets and variables** &rarr; **Actions** &rarr; **Variables** tab.
2. Click **New repository variable**.
3. Name: `VITE_API_URL`
4. Value: Your deployed Cloud Run URL (e.g., `https://ais-dev-p3ls42y53x4qlksuo6bdud-819490054903.asia-southeast1.run.app`).
5. Save the variable.

### Step 4: Trigger the Deployment
Push to the `main` branch:
```bash
git push origin main
```
Or go to the **Actions** tab on GitHub, select **Deploy to GitHub Pages**, and click **Run workflow**.

Once complete, your app will be live at:
`https://<YOUR_GITHUB_USERNAME>.github.io/<YOUR_REPOSITORY_NAME>/`

