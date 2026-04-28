# CivicPulse

> **Real-time civic need reporting and volunteer coordination, powered by AI triage.**

---

## Overview

When a community faces a crisis — a flood, a medical emergency, a sudden shortage of essential supplies — the bottleneck is rarely the number of willing volunteers. It is the coordination gap between people who need help and people who can provide it.

CivicPulse closes that gap.

Citizens submit requests through a simple interface. An AI pipeline immediately parses each submission, classifies the type of need, assigns a priority score, and detects near-duplicate reports. Coordinators review a live dashboard and approve or escalate requests. A matching engine then surfaces the most relevant available volunteer based on proximity, skill, and availability. When the volunteer resolves the issue, coordinators verify the outcome — maintaining a complete, auditable record of every request from submission through resolution.

The result is a civic response infrastructure that is faster, more transparent, and more accountable than manual processes.

---

## Key Features

### For Citizens
- Submit civic needs through a clean, accessible form
- Receive real-time status updates as their request moves through the pipeline
- Avoid duplicate submissions — the AI automatically detects near-identical reports

### For Volunteers
- Get matched to requests that fit their skills, availability, and location
- Receive clear task assignments with full context on the need
- Mark tasks as resolved directly through the platform

### For Coordinators
- Review an AI-triaged dashboard of incoming requests, sorted by urgency
- Approve, reject, or escalate requests with a single action
- Verify volunteer resolutions or reopen tasks that require further attention
- Access a dashboard summary with system-wide metrics at a glance

### System-Wide
- AI-powered intake parses free-text submissions into structured, categorized data
- Priority scoring surfaces the most critical needs automatically
- Full audit trail across the entire request lifecycle
- RESTful API designed for extensibility and future integrations

---

## Architecture

```
┌──────────────────────┐        ┌──────────────────────────────────────┐
│   React Frontend     │◄──────►│         FastAPI Backend              │
│  (civicpulse/)       │  HTTP  │       (civicpulse-ai/)               │
└──────────────────────┘        │                                      │
                                │  ┌─────────────┐  ┌──────────────┐  │
                                │  │  AI Parser  │  │  Matching    │  │
                                │  │  (Gemini /  │  │  Engine      │  │
                                │  │  pipeline)  │  │              │  │
                                │  └──────┬──────┘  └──────┬───────┘  │
                                │         │                │           │
                                │         ▼                ▼           │
                                │  ┌────────────────────────────────┐  │
                                │  │        Firebase Firestore       │  │
                                │  │  (needs, volunteers, audit log) │  │
                                │  └────────────────────────────────┘  │
                                └──────────────────────────────────────┘
```

**Frontend** — A React application with Framer Motion for transitions and Lucide Icons for UI components. Communicates with the backend over a REST API.

**Backend** — FastAPI application serving all core business logic: request ingestion, AI triage, volunteer matching, status management, and resolution verification. Pydantic models enforce schema validation throughout.

**AI Parser** — A dedicated pipeline module that processes raw citizen submissions. It extracts structured fields (category, urgency level, location context) and flags potential duplicates before a request enters the coordinator queue.

**Database** — Firebase Firestore stores all application state: needs, volunteer profiles, assignment records, and the resolution audit trail. Firestore's real-time capabilities allow the coordinator dashboard to reflect live updates without polling.

**Matching Engine** — A backend service that, when triggered, scores and ranks available volunteers against open approved needs. Matching accounts for skill relevance and volunteer availability.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite |
| **UI / Animation** | Framer Motion, Lucide Icons |
| **Backend** | FastAPI, Uvicorn |
| **Data Validation** | Pydantic |
| **Database / Realtime** | Firebase Firestore |
| **Authentication** | Firebase Auth |
| **AI / Parsing** | Google Gemini API (via `ai_parser` pipeline) |
| **Language** | Python 3.11+ |

---

## Project Structure

```
Solution-Challenge/
│
├── civicpulse/                  # React frontend application
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Route-level views (citizen, coordinator, volunteer)
│   │   └── main.jsx
│   ├── index.html
│   └── package.json
│
├── civicpulse-ai/               # FastAPI backend
│   ├── api/
│   │   └── app.py               # Application entry point and route definitions
│   ├── ai_parser/               # AI intake and triage pipeline
│   ├── scripts/                 # Utility and seed scripts
│   ├── tests/                   # Backend test suite
│   └── requirements.txt
│
├── main.py                      # Top-level runner / dev entrypoint
├── .gitignore
└── README.md
```

---

## How It Works

```
1. SUBMIT       Citizen fills out a need request (type, description, location)
      │
      ▼
2. AI TRIAGE    ai_parser classifies the request, assigns a priority score,
                and checks for duplicate submissions
      │
      ▼
3. REVIEW       Coordinator sees the triaged request on the dashboard
                → Approve / Reject / Escalate
      │
      ▼
4. MATCH        POST /run-matching triggers the matching engine
                → Volunteer is selected based on skills, availability
      │
      ▼
5. RESOLVE      Volunteer accepts the task, completes it, marks as resolved
      │
      ▼
6. VERIFY       Coordinator reviews the resolution
                → Confirms closure or reopens the task
      │
      ▼
7. AUDIT        Full event trail stored in Firestore for every state transition
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and npm
- A Firebase project with Firestore enabled
- Google Cloud service account credentials (JSON key file)
- (Optional) Google Gemini API key for the AI parser

### Clone the Repository

```bash
git clone https://github.com/Sathvik-Tumati/Solution-Challenge.git
cd Solution-Challenge
```

### Backend Setup

```bash
cd civicpulse-ai

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Add your Firebase service account key
cp path/to/your/serviceAccount.json serviceAccount.json

# Configure environment variables (see section below)
cp .env.example .env

# Start the development server
uvicorn api.app:app --reload --port 8000
```

Backend runs at: `http://localhost:8000`  
Interactive API docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd civicpulse

# Install dependencies
npm install

# Configure environment variables (see section below)
cp .env.example .env

# Start the development server
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## Environment Variables

### Backend (`civicpulse-ai/.env`)

```env
GOOGLE_APPLICATION_CREDENTIALS=serviceAccount.json
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note:** Never commit `serviceAccount.json` or any `.env` file to version control. The `.gitignore` is already configured to exclude these.

### Frontend (`civicpulse/.env`)

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_API_BASE_URL=http://localhost:8000
```

> All Vite environment variables must be prefixed with `VITE_` to be accessible in the browser bundle.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/submit-need` | Submit a new citizen need |
| `GET` | `/needs` | Fetch all open, approved needs |
| `GET` | `/needs/all` | Fetch all needs (coordinator view) |
| `PATCH` | `/needs/{id}/status` | Update need status (approve, reject, escalate) |
| `POST` | `/needs/{id}/verify` | Coordinator verifies volunteer resolution |
| `POST` | `/run-matching` | Trigger the volunteer matching engine |
| `GET` | `/dashboard-summary` | System-wide stats and overview |

---

## Deployment

### Frontend

The React app builds to a static bundle and can be deployed to any static host:

```bash
cd civicpulse
npm run build
# Deploy the dist/ folder to Vercel, Netlify, or Firebase Hosting
```

### Backend

The FastAPI backend is designed for containerized deployment. Google Cloud Run is the recommended target:

```bash
# Build and deploy to Cloud Run
gcloud run deploy civicpulse-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

Alternatively, deploy to any platform that supports Python ASGI servers (Railway, Render, Fly.io).

### Firebase

Ensure the following are configured in your Firebase project before deploying:
- Firestore database created in production mode
- Appropriate Firestore security rules for each collection (`needs`, `volunteers`)
- Service account key securely injected as a Cloud Run secret or environment variable — never bundled into the container image

---

## Future Scope

- **Emergency services integration** — Direct escalation pathways to local police, fire, and medical services
- **NGO and authority onboarding** — Structured profiles for registered relief organizations with verified capacity data
- **Image upload for needs and resolutions** — Photo evidence at submission and closure for accountability
- **Offline and low-network support** — Progressive Web App (PWA) capabilities with request queuing for degraded connectivity
- **Relief resource inventory** — Track available supplies (food, medicine, shelter) across volunteer and NGO networks
- **Voice-based request submission** — Speech-to-text intake for users with limited literacy or mobile keyboard access
- **WhatsApp / SMS fallback** — Allow request submission and status updates over messaging channels via Twilio or similar
- **Community trust scoring** — Reputation system for volunteers based on resolution history and coordinator feedback

---

## Team

| Name | Role |
|---|---|
| Sathvik Tumati | Backend & AI Pipeline |
| *(Add team member)* | *(Role)* |
| *(Add team member)* | *(Role)* |
| *(Add team member)* | *(Role)* |

*Built for the Google Solution Challenge 2025.*

---

## License

This project is currently unlicensed. If you intend to fork or build on this work, please contact the authors.

---

*CivicPulse — because the speed of community response should never be limited by coordination overhead.*
