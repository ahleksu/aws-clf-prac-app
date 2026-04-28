# ☁️ AWS CLF-C02 Practice & Live Quiz App

A dual-mode quiz platform for AWS Certified Cloud Practitioner (CLF-C02) exam preparation:

- **Solo Practice Mode** — self-paced, domain-based quizzes with instant feedback and charts
- **Live Session Mode** *(in development)* — Kahoot-style real-time quiz for classroom review sessions

Built for **AWS re/Start scholars** preparing for the CLF-C02 exam.

> ⚖️ **Disclaimer:** This is a personal educational project, not affiliated with or endorsed by AWS or Amazon. Questions are inspired by publicly available resources.

---

## Live Demo

> The app frontend is hosted on **Vercel** with the real-time backend hosted on an **AWS EC2 t2.micro** instance. The live URL will be updated here once deployment is complete. See [Infrastructure Setup](#infrastructure-setup-first-time) to deploy your own instance.

*Live Session mode requires the backend to be running on EC2. See [Hosting a Live Session](#hosting-a-live-session) below.*

---

## Features

### Solo Practice Mode (Available Now)
- Domain-based quiz modes: Cloud Concepts, Security & Compliance, Cloud Technology, Billing & Support, or All Domains
- Single and multiple choice support
- Immediate answer feedback with explanations and AWS documentation links
- Progress bar and question navigation
- Skip detection for unanswered questions
- Review mode with filters and answer breakdown
- Donut and stacked bar charts in result summary
- Mobile responsive UI

### Live Session Mode (In Development)
- Host creates a session with a shareable 6-character code
- Up to 30 players join from their own devices (no accounts needed)
- Questions appear simultaneously for all players with a countdown timer
- Kahoot-style scoring: speed bonus + streak bonus + correctness
- Real-time leaderboard between questions
- Host controls: Start, Pause/Resume, Next Question, End Quiz
- Final leaderboard with podium display

---

## Architecture

```
Browsers (Scholars + Host)
    │  HTTPS (Angular SPA)                │  WSS (Socket.io / WebSocket)
    ▼                                     ▼
Vercel Edge Network                  EC2 t2.micro (free tier, always-on)
Global CDN                           nginx + PM2 + Let's Encrypt
    │                                     │
    ▼                                     ▼
Angular build artifacts              Node.js + Socket.io
(Static Site Hosting)                In-memory session state
```

**Solo mode:** Angular SPA served from Vercel — no backend required.

**Live mode:** Angular connects via WebSocket (`wss://`) to the EC2 backend. Vercel provides HTTPS and global CDN caching for the frontend. The EC2 backend uses Let's Encrypt (via nip.io) for valid TLS so browsers allow WebSocket connections.

**Cost: $0/month for the first 12 months** (all services within AWS Free Tier). After free tier: ~$9/month.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | Angular 19 (Standalone Components) |
| UI Components | PrimeNG 19 |
| CSS | TailwindCSS 4 |
| Charts | Chart.js 4 |
| Real-time (client) | socket.io-client |
| Frontend Hosting | Vercel |
| Backend Runtime | Node.js 20 |
| Backend Framework | Express 4 + Socket.io 4 |
| Process Manager | PM2 |
| Reverse Proxy | nginx |
| SSL | Let's Encrypt (certbot) |
| Backend Hosting | AWS EC2 t3.micro |

---

## Local Development

### Prerequisites
- Node.js 20+
- Angular CLI 19: `npm install -g @angular/cli`

### Run the Frontend (Solo Mode)

```bash
# Install dependencies
npm install

# Start dev server
ng serve
```

Open `http://localhost:4200`. Solo quiz mode is fully functional with no backend.

### Run the Backend (Live Mode)

```bash
cd backend
npm install
cp .env.example .env        # edit PORT, CORS_ORIGIN if needed
npm run dev
```

Backend starts on `http://localhost:3000`. The Angular dev environment points to this URL automatically.

### Run Both Together

Open two terminals:

```bash
# Terminal 1 — Frontend
ng serve

# Terminal 2 — Backend
cd backend && npm run dev
```

Navigate to `/host` to create a session, `/join` to join as a player.

---

## Hosting a Live Session (Instructor Guide)

> The EC2 backend is **always running** (do not stop it — see why in PLAN.md §4). No need to start/stop before sessions.

### Before the Session

1. **Run the pre-demo health check** from your laptop:
   ```bash
   ./scripts/pre-demo-check.sh
   ```
   Both checks (backend `/health` and frontend HTTP 200) must pass before you start.

2. **If the backend is down** (unlikely — PM2 auto-restarts on reboot), SSH in and restart:
   ```bash
   ssh -i your-key.pem ubuntu@<ELASTIC-IP>
   pm2 restart live-quiz-backend
   ```

3. **Share the app URL** with scholars: your Vercel URL + `/join` (e.g. `https://your-app.vercel.app/join`). Update this after deployment with your actual URL.

### During the Session

1. Open `<Vercel-URL>/host` on your screen
2. Select the domain and number of questions, click **Create Session**
3. Share the **6-character session code** with scholars (show on projector)
4. Wait until scholars have joined (you see them appear in the lobby)
5. Click **Start Quiz** — questions begin simultaneously for all
6. Use **Pause** to freeze timer and discuss a topic mid-question
7. Use **Next Question** to advance manually, or it auto-advances when everyone answers
8. Click **End Quiz** — final leaderboard shown to all

### After the Session

The EC2 instance stays running (free tier — no cost to keep it on). No action needed after the session. Sessions are auto-cleaned from memory after 4 hours of inactivity.

---

## Infrastructure Setup (First Time)

See [PLAN.md](PLAN.md) §13 for full step-by-step commands (Note: frontend steps differ for Vercel).

**Quick summary of Hybrid Deployment:**

| Step | What | Service |
|---|---|---|
| 1 | Launch EC2 **t2.micro** (not t3), Ubuntu 22.04 | EC2 (free tier) |
| 2 | Allocate Elastic IP, attach to t2.micro (free while running) | Elastic IP |
| 3 | Install Node.js 20, PM2, nginx, certbot | — |
| 4 | Issue Let's Encrypt cert via nip.io domain | Let's Encrypt (free) |
| 5 | Import GitHub repository to Vercel | Vercel (free) |
| 6 | Add API environment variable pointing to nip.io URL | Vercel |

**Estimated monthly cost (first 12 months):** ~$0.00/month
**After free tier expires:** ~$9.22/month (EC2 t3.micro)

---

## Implementation Progress

See [PROGRESS.md](PROGRESS.md) for the current implementation status and task tracker.

See [TODOs.md](TODOs.md) for the full granular task list organized by phase.

See [PLAN.md](PLAN.md) for the complete architecture, data models, WebSocket event contract, and AWS setup guide.

---

## Project Structure

```
aws-clf-prac-app/
├── src/                    # Angular 19 frontend
│   └── app/
│       ├── core/           # Services and models
│       └── pages/
│           ├── home/       # Landing page
│           ├── quiz/       # Solo quiz
│           ├── result/     # Solo results
│           ├── review-answers/ # Solo answer review
│           └── live/       # Live session pages (in development)
│               ├── host-dashboard/
│               ├── host-lobby/
│               ├── host-session/
│               ├── join/
│               ├── player-lobby/
│               ├── player-game/
│               └── leaderboard/
├── public/
│   └── quiz/               # Quiz data JSON files
│       ├── all.json
│       ├── cloud_concepts.json
│       ├── cloud_tech.json
│       ├── security_compliance.json
│       └── billing_support.json
├── backend/                # Node.js + Socket.io backend (in development)
│   └── src/
│       ├── game/           # Game engine (GameManager, GameSession)
│       ├── routes/         # REST API
│       └── socket/         # Socket.io event handlers
├── PLAN.md                 # Architecture and design document
├── TODOs.md                # Granular implementation tasks
└── PROGRESS.md             # Live implementation status tracker
```

---

## Contributing

Got a question that's wrong or an improvement to suggest?

- [File an issue](https://github.com/ahleksu/aws-clf-prac-app/issues)
- Open a pull request

---

## Contact

- [LinkedIn](https://www.linkedin.com/in/ahleksu)
- [YouTube](https://youtube.com/@ahleksu)
- Email: `ahleksu.dev@gmail.com`

---

## Support the Developer

If this helped you pass your CLF-C02 exam, consider supporting the project!

<a href="https://gcash-donations-qr.s3.ap-southeast-2.amazonaws.com/GCash-QR.jpg" target="_blank" rel="noopener noreferrer">
  <img src="public/ahleksu-notion-face.png" alt="Support via GCash" width="150" style="border-radius: 50%; display: block; margin: 0 auto;" />
</a>
