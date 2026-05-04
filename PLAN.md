# PLAN.md — AWS CLF Live Quiz: Kahoot-Style Real-Time Refactor

> **AI Copilot Directive:** This document is your source of truth. Read it in full before implementing any task. Cross-reference TODOs.md for your next task and update PROGRESS.md after each completion.

---

## 🚀 Deployment Status (as of 2026-05-04)

| Layer | Service | URL | Status |
|---|---|---|---|
| Frontend | Vercel | https://aws-clf-prac-app.vercel.app | ✅ Live |
| Backend API + WSS | EC2 t2.micro (ap-southeast-1b) | https://api.47.130.41.30.nip.io | ⏹ Stopped (intentional; run `./scripts/ec2-backend-lifecycle.sh start` before class) |
| Backend health | — | https://api.47.130.41.30.nip.io/health | ⏹ Offline until EC2 is started |
| CI/CD | Vercel (auto on push to master) | — | ✅ Active |
| TLS (frontend) | Vercel (`*.vercel.app`) | — | ✅ Auto |
| TLS (backend) | Let's Encrypt via nip.io | Expires 2026-07-27, auto-renews | ✅ Active (cert persists while stopped) |

**Offline UX:** When the EC2 backend is stopped, the Angular frontend degrades gracefully: Home disables live-session buttons and shows an amber "Server Offline" banner; `/join` and `/host` replace their forms with the same offline banner and a "Back to Home" button.

**Note on original S3+CloudFront plan:** S3 bucket `aws-clf-quiz-frontend` (ap-southeast-1) and OAC `E37IFEDVTLC7J6` remain provisioned. CloudFront activation pending AWS Support case (account verification). Can migrate frontend from Vercel to S3+CloudFront at any time.

**Current production branch:** `master` includes Phase 10 offline-backend UX
and repository security hardening. Vercel auto-deploys from `master`. The EC2
backend was intentionally stopped on 2026-05-04 to reduce idle compute costs.
Phase 8 still remains **In Progress** until P8-T7 is manually smoke-tested. See
§7 for EC2 reactivation steps.

---

## 1. Executive Summary

Transform the current self-paced solo quiz SPA into a **Kahoot-style live quiz platform** for AWS re/Start classroom sessions. A host (instructor) creates and controls quiz sessions while 20–30 scholars participate in real-time via their browsers. The existing solo practice mode is preserved and untouched.

**Target User Flow:**
1. Host visits `/host` → creates a session with a 6-character code → waits in lobby
2. Scholars visit `/join` → enter the code + a nickname → enter the waiting room
3. Host clicks **Start** → questions appear simultaneously for all players
4. Players answer within a countdown timer → scores awarded (Kahoot-style: speed + accuracy)
5. Between questions, a leaderboard snapshot is shown to everyone
6. Host can **Pause** (freeze timer) or **Skip to next** at any time
7. Host clicks **End Quiz** → final leaderboard shown to all

---

## 2. Current State Analysis

| Aspect | Current State | What Needs to Change |
|---|---|---|
| Architecture | Pure static SPA, no backend | Add Node.js + Socket.io backend |
| State | In-memory, resets on refresh | Server-side session state |
| Multiplayer | None | WebSocket-based real-time sync |
| Frontend Deployment | Vercel live on `master` auto-deploy; original S3+CloudFront plan retained as fallback | No change unless migrating away from Vercel |
| Backend Deployment | EC2 t2.micro live with nginx + PM2 + Let's Encrypt | Keep EC2 updated from `master` after backend changes |
| Quiz Data | Static JSON in `/public/quiz/` | Backend loads same JSON files |
| Routing | 4 solo pages | +6 new live-session pages |
| Auth | None | Simple session code + nickname (no accounts) |
| SSL | N/A | ACM on CloudFront (frontend) + Let's Encrypt on EC2 via nip.io (backend) |
| CI/CD | Vercel auto-deploys frontend on push to `master`; S3 workflow is fallback/reference | Preserve Vercel unless CloudFront migration is explicitly resumed |

**Existing routes to preserve (do not break):**
- `/` → `HomeComponent`
- `/quiz` → `QuizComponent`
- `/result` → `ResultComponent`
- `/review` → `ReviewAnswersComponent`

---

## 3. Target System Architecture

```
Scholars & Host (Browsers)
    │  HTTPS (Angular SPA)                │  WSS (WebSocket / Socket.io)
    ▼                                     ▼
┌───────────────────────────┐    ┌──────────────────────────────────────┐
│  CloudFront Distribution  │    │  EC2 t2.micro (free tier, start/stop)│
│  + AWS Shield Standard    │    │                                      │
│  (free DDoS, L3/L4)       │    │  ┌──────────────────────────────┐   │
│           │               │    │  │ nginx (port 443)              │   │
│           ▼               │    │  │  • TLS via Let's Encrypt      │   │
│   S3 Bucket (private)     │    │  │    (cert on nip.io subdomain  │   │
│   Angular SPA dist/       │    │  │     OR custom Route 53 domain)│   │
│   Origin Access Control   │    │  │  • limit_conn 120/IP          │   │
│   (S3 not public)         │    │  │  • proxy_pass → :3000         │   │
└───────────────────────────┘    │  └──────────────────────────────┘   │
           │                     │  ┌──────────────────────────────┐   │
   GitHub Actions CI/CD          │  │ Node.js 20 + Socket.io       │   │
   (ng build → s3 sync           │  │  • PM2 (auto-restart)        │   │
    → CF invalidation)           │  │  • express-rate-limit        │   │
           │                     │  │  • In-memory GameManager     │   │
           ▼                     │  └──────────────────────────────┘   │
   GitHub (master branch)        │  Elastic IP: FREE (instance running)│
                                 └──────────────────────────────────────┘
```

**Layer summary:**

| Layer | Service | Free Tier? | SSL | DDoS |
|---|---|---|---|---|
| Frontend hosting | S3 (private bucket) | Yes (5 GB free) | ACM via CloudFront | — |
| Frontend CDN | CloudFront | Yes (1 TB/mo free) | ACM (always free) | AWS Shield Standard |
| Backend compute | EC2 t2.micro | Yes (750 hrs/mo, 12 mo) | Let's Encrypt (certbot) | Security Group + nginx |
| Backend process | PM2 + nginx | Yes (no cost) | nginx TLS termination | `limit_conn` / `limit_req` |
| Static IP | Elastic IP | Free while instance runs | — | — |
| CI/CD | GitHub Actions | Yes (free public repo) | — | — |

---

## 4. Technology Stack Decisions

### Backend: Node.js + Express + Socket.io

**Why Node.js over serverless Lambda:**
- Lambda + API Gateway WebSocket requires DynamoDB for connection state (complex setup)
- Socket.io does not run on Lambda without significant adaptation
- For 20–30 users in short classroom sessions, t3.micro is massively over-specced (handles 10,000+ WebSocket connections)
- Node.js with in-memory state is simpler, faster, and easier to debug

**Why Socket.io over raw WebSocket:**
- Automatic reconnection handling (students losing WiFi will auto-reconnect)
- Room-based messaging built-in (each session is a Socket.io room)
- Fallback to long-polling if WebSocket is blocked on school networks

### State Storage: In-Memory (Node.js Map)

**Why not DynamoDB:**
- Sessions are ephemeral (classroom duration, ~1 hour)
- No need to persist quiz history across server restarts
- Eliminates AWS cost and latency overhead
- DynamoDB can be added later as Phase 2 enhancement

### Frontend: Angular 19 (existing, extended) — hosted on Vercel in production

- Add `socket.io-client` npm package
- Create a `SocketService` and `LiveQuizService`
- Add 6 new route pages; all existing pages untouched
- Current production: Vercel auto-builds and deploys from `master`
- Historical/fallback path: build output (`ng build --configuration production`) can be synced to S3 via GitHub Actions once CloudFront is unblocked

### Frontend Hosting: Vercel Current, S3 + CloudFront Fallback

**Current production decision:** Vercel is the active frontend host because the
AWS account is still blocked from creating CloudFront distributions until AWS
Support verifies the account. The S3 bucket and OAC remain provisioned so the
project can migrate to S3+CloudFront later.

**Original S3 + CloudFront rationale:**

| Option | Monthly Cost | DDoS Protection | SSL | CI/CD | Notes |
|---|---|---|---|---|---|
| **Vercel** ← current production | $0 | Platform managed | Auto | Auto on `master` | Active because CloudFront is blocked pending account verification |
| **S3 + CloudFront** ← AWS fallback | **~$0.05–$1.50** | AWS Shield Standard | ACM (free) | GitHub Actions | Educational, AWS-native, most control once CloudFront is available |
| AWS Amplify Hosting | $0 (free tier) | CloudFront + Shield | Auto | Built-in | Easier but hides infrastructure |
| EC2 + nginx (static files) | $0 extra | EC2 security group only | Let's Encrypt | Manual | Single point of failure, no CDN |
| Netlify / GitHub Pages | $0 | CDN varies | Auto | Built-in | Not AWS; less relevant for re/Start |

S3 + CloudFront remains the AWS-native fallback because it:
1. Teaches students the proper AWS static hosting pattern relevant to CLF-C02
2. AWS Shield Standard (free) blocks Layer 3/4 volumetric attacks at edge
3. ACM provides free, auto-renewing TLS — no certificate expiry during demo
4. CloudFront caches assets globally so all 30 students get fast, parallel loads
5. GitHub Actions can deploy it with `aws s3 sync dist/ s3://bucket`

### Angular Socket.io Client: `socket.io-client` (direct, no wrapper)

**Why not ngx-socket-io:**
- ngx-socket-io lags behind socket.io versions
- Direct `socket.io-client` with an Angular service wrapper is cleaner and simpler

### Backend Compute: EC2 t2.micro (AWS Free Tier, Usually On)

**Cost note for stop/start:**

Stopping an EC2 instance pauses compute, but it does not necessarily eliminate
all costs. Attached storage remains, and static public IP/Elastic IP billing can
apply depending on AWS's current public IPv4 pricing and whether the instance is
stopped. Use `scripts/ec2-backend-lifecycle.sh` when the backend must be
temporarily stopped, but run the pre-demo start/health flow before class.

| Resource | EC2 t2.micro — stop/start | EC2 t2.micro — running during free tier |
|---|---|---|
| Compute | Paused while stopped | Covered by 750 hrs/month free tier for first 12 months |
| Storage/static IP | May still incur charges | May still incur current AWS public IPv4/static IP charges |
| Demo reliability | Medium (risk forgetting to start) | **High** |
| Operational burden | Must remember to start and verify health | Lower |

Default recommendation for classroom reliability: keep the backend running
during active teaching periods. For idle periods where temporary shutdown is
desired, use the idempotent lifecycle helper and verify `/health` before use.

**t2.micro specs vs. load for 30 users:**
- 1 GB RAM, 1 vCPU (burstable T2 credits)
- Node.js + Socket.io idle: ~60–80 MB RAM
- 30 concurrent WebSocket connections: ~120–130 MB RAM peak
- CPU: <5% under full 30-user load (I/O-bound, not CPU-bound)
- t2.micro handles this easily, even with T2 credit limits

### SSL on EC2 Backend: Let's Encrypt via nip.io (No Domain Required)

The Angular SPA is served over HTTPS (CloudFront + ACM). Browsers enforce **mixed content rules**: a WebSocket connection to `ws://` (plain HTTP) is blocked from an HTTPS page. EC2 must serve HTTPS.

Two paths to get HTTPS on EC2 without purchasing a domain:

**Option A — nip.io (free, recommended for free tier)**

nip.io is a public wildcard DNS service. Any IP address gets a free DNS name:
```
# If EC2 Elastic IP is 54.123.45.67:
api.54.123.45.67.nip.io → resolves to 54.123.45.67
```
certbot accepts this as a valid domain and issues a Let's Encrypt certificate:
```bash
sudo certbot --nginx -d api.54.123.45.67.nip.io
```
Angular `environment.prod.ts` sets `wsUrl: 'https://api.54.123.45.67.nip.io'`.
Cost: **$0**.

**Option B — Custom domain on Route 53 (~$0.75/month)**
Register `awsquiz.click` on Route 53 (~$3/year). Create A records in Route 53:
- `awsquiz.click` → CloudFront (frontend)
- `api.awsquiz.click` → EC2 Elastic IP (backend)

certbot issues cert for `api.awsquiz.click`. Clean URLs, professional look for scholars.
Cost: $0.25/month (domain) + $0.50/month (Route 53 hosted zone) = **$0.75/month**.

**Recommendation:** Start with nip.io (free). Upgrade to a Route 53 domain if you want clean URLs for students.

### Total Cost Breakdown

| Scenario | First 12 Months | After Free Tier Expires |
|---|---|---|
| **Free Tier (nip.io, no domain)** | **$0.00/mo** | ~$9.22/mo (EC2 t3.micro + CF + S3) |
| **Free Tier + custom domain** | **$0.75/mo** | ~$9.97/mo |
| **After free tier (no domain, EC2 t3.micro)** | — | **$8.72/mo** |

**Itemized (free tier, nip.io):**

| Resource | Service | Free Tier? | Monthly |
|---|---|---|---|
| Frontend S3 | 5 GB storage, 2K PUTs | Yes | $0.00 |
| Frontend CDN | CloudFront 1 TB transfer | Yes (12 mo) | $0.00 |
| Frontend SSL | ACM cert on CloudFront | Always free | $0.00 |
| Backend compute | EC2 t2.micro, started before class | Yes (12 mo) | $0.00 while within free-tier hours |
| Backend static IP | Elastic/static public IPv4 | Pricing depends on current AWS public IPv4 billing | Check AWS billing |
| Backend SSL | Let's Encrypt (certbot + nip.io) | Always free | $0.00 |
| CI/CD | GitHub Actions (public repo) | Always free | $0.00 |
| DDoS frontend | AWS Shield Standard on CF | Always free | $0.00 |
| **Total (12 months)** | | | **$0.00/mo** |

---

## 5. Repository File Structure

The new backend is a **separate Node.js project** inside the existing repo under `backend/`. The Angular frontend gains new pages under `src/app/pages/live/`.

```
aws-clf-prac-app/
├── .github/
│   └── workflows/
│       └── deploy-frontend.yml    ← NEW: GitHub Actions CI/CD (ng build → S3 sync → CF invalidation)
│
├── backend/                       ← NEW: Node.js backend
│   ├── src/
│   │   ├── index.ts               ← Express + Socket.io server entry
│   │   ├── game/
│   │   │   ├── types.ts           ← All shared TS interfaces
│   │   │   ├── GameManager.ts     ← Singleton: manages all sessions
│   │   │   └── GameSession.ts     ← Per-session state machine
│   │   ├── routes/
│   │   │   └── api.routes.ts      ← REST: GET /health, GET /session/:code
│   │   └── socket/
│   │       ├── hostHandlers.ts    ← Socket events for host
│   │       └── playerHandlers.ts  ← Socket events for players
│   ├── quiz/                      ← Copy of /public/quiz/*.json (5 files)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── ecosystem.config.js        ← PM2 config
│
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── quiz.model.ts         ← EXISTING (unchanged)
│   │   │   ├── quiz.service.ts       ← EXISTING (unchanged)
│   │   │   ├── live-quiz.model.ts    ← NEW: live session types
│   │   │   ├── socket.service.ts     ← NEW: Socket.io-client wrapper
│   │   │   └── live-quiz.service.ts  ← NEW: game state management
│   │   ├── pages/
│   │   │   ├── home/                 ← EXISTING (add "Live Session" card)
│   │   │   ├── quiz/                 ← EXISTING (unchanged)
│   │   │   ├── result/               ← EXISTING (unchanged)
│   │   │   ├── review-answers/       ← EXISTING (unchanged)
│   │   │   └── live/                 ← NEW directory
│   │   │       ├── host-dashboard/   ← Create session
│   │   │       ├── host-lobby/       ← Waiting room (host view)
│   │   │       ├── host-session/     ← Quiz control panel
│   │   │       ├── join/             ← Player: enter code + nickname
│   │   │       ├── player-lobby/     ← Player: waiting for host
│   │   │       ├── player-game/      ← Player: answer questions
│   │   │       └── leaderboard/      ← Final leaderboard (host + player)
│   │   ├── app.routes.ts             ← MODIFIED: add live routes
│   │   └── environments/
│   │       ├── environment.ts        ← NEW: dev API/WS URLs
│   │       └── environment.prod.ts   ← NEW: prod EC2 nip.io or Route 53 domain URLs
```

---

## 6. Extended Data Models

### Backend: `backend/src/game/types.ts`

```typescript
export type QuizDomain = 'all' | 'cloud_concepts' | 'cloud_tech' | 'security_compliance' | 'billing_support';
export type SessionState = 'lobby' | 'active' | 'paused' | 'between' | 'ended';

export interface GameSession {
  id: string;
  code: string;               // 6-char uppercase e.g. "CLF001"
  hostSocketId: string;
  hostToken: string;          // per-session host ownership token, kept in host tab sessionStorage
  domain: QuizDomain;
  questions: LiveQuestion[];
  currentQuestionIndex: number;
  state: SessionState;
  players: Map<string, PlayerState>; // key = socketId
  questionStartTime: number;  // Date.now() when question went live
  timePerQuestion: number;    // seconds, default 30
  totalQuestions: number;
  createdAt: Date;
  questionTimer?: NodeJS.Timeout;
}

export interface LiveQuestion {
  id: number;
  question: string;
  domain: string;
  type: 'single' | 'multiple';
  answers: LiveAnswer[];      // text only, no 'status' exposed to players
  correctAnswers: string[];   // evaluated server-side, never sent to players
  resource?: string;
}

export interface LiveAnswer {
  text: string;
  label: string;              // 'A', 'B', 'C', 'D'
}

export interface PlayerState {
  socketId: string;
  nickname: string;
  score: number;
  rank: number;
  answers: PlayerAnswer[];
  streak: number;
  connected: boolean;
}

export interface PlayerAnswer {
  questionId: number;
  submitted: string[];
  correct: boolean;
  timeMs: number;             // ms elapsed when answer was submitted
  pointsEarned: number;
}

export interface Ranking {
  nickname: string;
  score: number;
  rank: number;
  correctCount: number;
  streak: number;
}

export interface QuestionPayload {
  questionNumber: number;     // 1-based
  total: number;
  questionText: string;
  type: 'single' | 'multiple';
  answers: LiveAnswer[];      // NO correct answer info
  timeLimit: number;
  timeRemaining?: number;     // ms remaining when rehydrating after reconnect/refresh
  domain: string;
}
```

### Frontend: `src/app/core/live-quiz.model.ts`

```typescript
export interface LiveSession {
  sessionCode: string;
  role: 'host' | 'player';
  playerCount: number;
  state: 'lobby' | 'active' | 'paused' | 'between' | 'ended';
}

export interface PlayerProfile {
  nickname: string;
  score: number;
  rank: number;
  streak: number;
}

export interface AnswerResult {
  correct: boolean;
  pointsEarned: number;
  correctAnswers: string[];   // revealed after submission
  explanation: string;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  correctCount: number;
}
```

---

## 7. Socket.io Event Contract

All events use Socket.io rooms where the room name = session code (e.g. `"CLF001"`).

### Host → Server Events

| Event | Payload | Description |
|---|---|---|
| `host:create` | `{ domain, questionCount, timePerQuestion }` | Create new session |
| `host:start` | `{ sessionCode }` | Move from lobby → first question |
| `host:next` | `{ sessionCode }` | Advance to next question |
| `host:pause` | `{ sessionCode }` | Freeze timer; players see pause screen |
| `host:resume` | `{ sessionCode }` | Resume from pause |
| `host:end` | `{ sessionCode }` | End quiz; show final leaderboard |
| `host:reconnect` | `{ sessionCode, hostToken }` | Rehydrate the original host tab after refresh; rejects exposed/copied host links without the token |

### Player → Server Events

| Event | Payload | Description |
|---|---|---|
| `player:join` | `{ sessionCode, nickname }` | Join session lobby |
| `player:answer` | `{ sessionCode, answers: string[] }` | Submit answer for current question |

### Server → Host Events

| Event | Payload | Description |
|---|---|---|
| `session:created` | `{ sessionCode, hostToken }` | Confirms session creation and provides the per-tab host ownership token |
| `session:error` | `{ message }` | Any host-triggered error |
| `lobby:update` | `{ players: PlayerState[] }` | Player joined/left lobby |
| `question:stats` | `{ answered: number, total: number }` | Live answer count |
| `host:state` | `{ state, question, questionStats, timeRemaining, rankings, answerReveal }` | Rehydrate host UI after refresh/reconnect |
| `leaderboard:snapshot` | `{ rankings: Ranking[] }` | After each question |
| `game:ended` | `{ finalLeaderboard: Ranking[] }` | Quiz finished |

### Server → Player Events (room broadcast)

| Event | Payload | Description |
|---|---|---|
| `session:joined` | `{ sessionCode, playerCount, nickname, score, rank, streak, state }` | Join/rejoin confirmed |
| `player:state` | `{ score, rank, streak, answeredCurrentQuestion, timeRemaining }` | Rehydrate player state after refresh/reconnect |
| `session:error` | `{ message }` | Join error (bad code, dupe nick) |
| `lobby:update` | `{ playerCount }` | Someone else joined |
| `game:question` | `QuestionPayload` | New question; starts timer; may include server `timeRemaining` on reconnect |
| `game:paused` | `{}` | Host paused |
| `game:resumed` | `{ timeRemaining }` | Host resumed |
| `answer:result` | `{ correct, pointsEarned, correctAnswers, explanation, newScore, rank }` | After player submits |
| `leaderboard:show` | `{ rankings: Ranking[], myRank: number }` | Between questions |
| `game:ended` | `{ finalLeaderboard: Ranking[], myFinalRank }` | Quiz finished |
| `host:disconnected` | `{}` | Host left (show waiting message) |
| `host:reconnected` | `{}` | Host returned; clear disconnected overlay while session remains paused |

### Reactivating the Backend Server (EC2)

To prevent unwanted compute costs, the backend EC2 server (`i-042b91a08364b6e01`) is kept stopped. Before hosting a live classroom session, you must start the server.

**Option A: Using the AWS CLI (Integrated Script)**
1. Ensure your `clf-quiz` AWS CLI profile is valid and active.
2. From the project root, run the lifecycle script:
   `./scripts/ec2-backend-lifecycle.sh start`
3. The script will automatically trigger the instance and gracefully wait for the `/health` endpoint to return a 200 OK.

**Option B: Using the AWS Console (Manual)**
1. Log in to the AWS Console and navigate to **EC2 > Instances**.
2. Select the instance named `aws-clf-quiz-backend` (ID: `i-042b91a08364b6e01`).
3. Click **Instance state** > **Start instance**.
4. Wait approximately 2–3 minutes for the instance status checks to pass. PM2 and Nginx are configured to start automatically on system boot.
5. Verify the backend is up by visiting: `https://api.47.130.41.30.nip.io/health`

---

## 8. Scoring Algorithm

**Kahoot-inspired scoring (server-side only):**

```typescript
function calculatePoints(
  correct: boolean,
  timeMs: number,
  timeLimitMs: number,
  streak: number
): number {
  if (!correct) return 0;
  const BASE = 1000;
  const TIME_BONUS = Math.round(500 * (1 - timeMs / timeLimitMs));
  const STREAK_BONUS = Math.min(streak * 100, 500); // cap at 500
  return BASE + TIME_BONUS + STREAK_BONUS;
}
```

Maximum points per question: **2000** (instant correct answer, 5+ streak)
Minimum correct-answer points: **1000** (answered at time limit, no streak)

---

## 9. Angular Routes to Add

Add to `src/app/app.routes.ts` (below existing routes, above the `**` catch-all):

```typescript
// Live Session routes
{ path: 'host', component: HostDashboardComponent },
{ path: 'host/lobby/:code', component: HostLobbyComponent },
{ path: 'host/session/:code', component: HostSessionComponent },
{ path: 'join', component: JoinComponent },
{ path: 'play/:code', component: PlayerLobbyComponent },
{ path: 'play/:code/game', component: PlayerGameComponent },
{ path: 'leaderboard/:code', component: LeaderboardComponent },
```

---

## 10. Angular Services

### `SocketService` (`src/app/core/socket.service.ts`)

Thin wrapper around `socket.io-client`. Provides:
- `connect(url)` / `disconnect()`
- `emit(event, data)` — typed
- `on(event): Observable<T>` — returns RxJS Observable
- `off(event)` — cleanup

### `LiveQuizService` (`src/app/core/live-quiz.service.ts`)

Stateful service using Angular signals or RxJS BehaviorSubjects:
- `currentQuestion$` — active question for player view
- `players$` — player list for host lobby
- `rankings$` — leaderboard data
- `gameState$` — SessionState machine
- `myProfile$` — current player's score/rank
- Exposes methods: `createSession()`, `joinSession()`, `submitAnswer()`, `nextQuestion()`, etc.

---

## 11. Host Interface Components

### `HostDashboardComponent`

- Form: select domain, question count, time per question (15/20/30/45/60s)
- Question count validates on submit instead of silently clamping; valid range is 5 to `min(65, available questions for selected domain)`
- Invalid question counts show a PrimeNG Toast and inline hint
- Button: **Create Session**
- On success: navigate to `/host/lobby/:code`
- Displays the generated session code prominently

### `HostLobbyComponent`

- Shows session code in large font (scholars type this into `/join`)
- Live list of players who have joined (updates via `lobby:update`)
- Player count badge
- Button: **Start Quiz** (disabled until ≥1 player joined)
- Button: **Cancel Session**

### `HostSessionComponent`

- **Top bar:** question X of Y, session code, pause/resume button
- **Main area:** current question text + answer options (shown as labels A/B/C/D)
- **Live stats:** answer submission count / total players (e.g., "18/23 answered")
- **Controls:** NEXT QUESTION button (enabled after all answered OR timer expires)
- **END QUIZ** button (confirm dialog)
- **Side panel:** mini leaderboard (top 5, updates after each question)

### `LeaderboardComponent` (shared)

- Podium display for top 3
- Ranked list for all players
- "Back to Home" button
- Confetti animation on page load

---

## 12. Player Interface Components

### `JoinComponent`

- Input: session code (auto-uppercase, 6 chars)
- Input: nickname (max 20 chars)
- Button: **Join Game**
- Button: **Cancel Session** (clears join/player state and returns home)
- Error states: invalid code, duplicate nickname, session full/ended

### `PlayerLobbyComponent`

- "Waiting for host to start..." message
- Player's chosen nickname displayed
- Live player count ("You and 17 others are ready")
- Kahoot-style animated background

### `PlayerGameComponent`

- Countdown timer (circular progress, changes color: green → yellow → red)
- Question text (large, clear)
- Answer buttons (A/B/C/D colored like Kahoot: red, blue, yellow, green)
- After submission: show if correct/incorrect + points earned
- Leaderboard snapshot between questions (auto-shown after each question)

---

## 12.5. IAM Prerequisites: AWS Identity Setup (Do This Before §13)

**This section is a prerequisite for all AWS CLI commands in §13.** Complete it before any infrastructure work.

### Account Details (Recorded 2026-04-28)

| Field | Value |
|---|---|
| AWS Account ID | `<REDACTED>` |
| Region | `ap-southeast-1` (Singapore) |
| Local CLI profile | `clf-quiz` |
| Existing unrelated users | `carbotrackr-pipeline` (do not touch) |

### IAM Users Created

| IAM Username | Role | Local CLI Profile | Status |
|---|---|---|---|
| `clf-quiz-admin-policy` | Developer / AI agent infrastructure admin | `clf-quiz` | ✅ Created & verified |
| `clf-quiz-github-actions` | GitHub Actions CI/CD only | GitHub Secrets (Phase 6-A4) | ✅ Created |

> **Naming note:** The admin user was created with the name `clf-quiz-admin-policy` (same as the policy name). This is a minor naming inconsistency — functionally identical. No action needed.

### Policies Created & Attached

| Policy | Attached To | Status |
|---|---|---|
| `clf-quiz-admin-policy` | `clf-quiz-admin-policy` user | ✅ Attached & verified |
| `clf-quiz-github-actions-policy` | `clf-quiz-github-actions` user | ✅ Attached & verified |

### Known Policy Correction

The original `clf-quiz-admin-policy` JSON contained `s3:PutPublicAccessBlock` — **this action does not exist** in IAM. The correct action is `s3:PutBucketPublicAccessBlock`. The user removed this line during setup.

**Fix:** Go to IAM → Policies → `clf-quiz-admin-policy` → Edit JSON → add the correct action to the S3BucketManage statement:

```json
"s3:PutBucketPublicAccessBlock",
"s3:GetBucketPublicAccessBlock"
```

This is needed so the AWS CLI command in §13A-1 (`aws s3api put-public-access-block`) works without hitting an Access Denied error.

### Local AWS CLI Profile

The `clf-quiz` profile is configured at `~/.aws/credentials` and `~/.aws/config`. Verified with:

```bash
aws sts get-caller-identity --profile clf-quiz
# Returns: arn:aws:iam::<REDACTED>:user/clf-quiz-admin-policy
```

**Use for all AWS CLI commands in this project:**

```bash
export AWS_PROFILE=clf-quiz   # set once per terminal session
# OR pass --profile clf-quiz to every aws command
```

### GitHub Actions Credentials (Store Securely Now)

The `clf-quiz-github-actions` access key was generated. **Store it now** in a password manager or secure note — it goes into GitHub Secrets in Phase 6-A4. If lost, delete the key in IAM and regenerate.

The 4 GitHub Secrets to add (Settings → Secrets → Actions):

| Secret Name | Value | When to Add |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | `clf-quiz-github-actions` access key ID | Phase 6-A4 |
| `AWS_SECRET_ACCESS_KEY` | `clf-quiz-github-actions` secret key | Phase 6-A4 |
| `S3_BUCKET` | `aws-clf-quiz-frontend` | Phase 6-A4 |
| `CF_DISTRIBUTION_ID` | CloudFront distribution ID (after 6-A2) | Phase 6-A4 |

---

## 13. AWS Infrastructure Setup (Step-by-Step for AI Copilot)

**All services below are within the AWS Free Tier for the first 12 months.** No upfront commitment or reserved capacity purchase is needed.

This section covers two independent deployments:
- **13A** — S3 + CloudFront + ACM (frontend)
- **13B** — EC2 t2.micro + Elastic IP + nginx + Let's Encrypt (backend)

Do 13A first — you'll need the CloudFront domain to configure the Angular environment. Then do 13B.

---

### 13A. Frontend: S3 + CloudFront + ACM

#### 13A-1: Create S3 Bucket

> **Region note (2026-04-29):** The S3 bucket can be in any region — only ACM certificates for CloudFront must be in `us-east-1`. The bucket is created in `ap-southeast-1` (Singapore) for lower origin latency. This is already done.

```bash
# Bucket was created in ap-southeast-1 (not us-east-1 — see note above)
aws s3api create-bucket \
  --bucket aws-clf-quiz-frontend \
  --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1 \
  --profile clf-quiz

# Block all public access (CloudFront will access it via OAC)
aws s3api put-public-access-block \
  --bucket aws-clf-quiz-frontend \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --profile clf-quiz
```

**Status: ✅ Complete** — bucket `aws-clf-quiz-frontend` created in `ap-southeast-1`, all public access blocked.

#### 13A-2: Create CloudFront Distribution

> **UI change (2026-04-29):** The CloudFront console now has a plan-based wizard (Free / Pro / Business / Premium). The CLI `create-distribution` call is blocked on new accounts until AWS Support verifies the account. Use the console wizard instead.

**New console wizard steps (Free plan):**

**Step 1 — Choose a plan:** Select **Free** ($0/month, 1M req/100GB). Click Next.

**Step 2 — Get started:**
- Distribution name: `aws-clf-distribution`
- Distribution type: **Single website or app**
- Route 53 domain: leave blank (no custom domain)
- Click Next.

**Step 3 — Specify origin:**
- Origin type: **Amazon S3**
- S3 origin: `aws-clf-quiz-frontend.s3.ap-southeast-1.amazonaws.com`
- Origin path: leave blank
- ☑ **Allow private S3 bucket access to CloudFront** (Recommended) — this auto-configures OAC and updates the bucket policy
- Origin settings: Use recommended
- Cache settings: Use recommended cache settings tailored to serving S3 content
- Click Next.

**Step 4 — Enable security:**
- WAF is included at no cost in the Free plan
- "Use monitor mode": **leave unchecked** (monitor-only doesn't block threats)
- "Layer 7 DDoS" requires Business plan — leave off
- Click Next.

**Step 5 — Review and create:** Confirm then click **Create distribution**. Deployment takes 5–10 minutes.

**Post-creation steps (required — wizard doesn't expose these):**

1. **Default root object** → Distribution → General → Edit → Default root object: `index.html` → Save
2. **Custom error pages** → Distribution → Error pages → Create custom error response (do this twice):
   - Error code **403** → Response page path: `/index.html` → HTTP response code: **200**
   - Error code **404** → Response page path: `/index.html` → HTTP response code: **200**

These are **critical for Angular SPA routing** — without them, any direct URL or page refresh returns a raw 403/404 from S3 instead of the app.

**Note the distribution ID** (starts with `E`, e.g. `E1ABCDEF12345`) and the **CloudFront domain** (`dXXXXX.cloudfront.net`) — both needed for GitHub Secrets and `environment.prod.ts`.

#### 13A-3: Configure Route 53 (if using custom domain)

```
1. Register awsquiz.click (or similar) in Route 53 → Registered Domains
2. Create Hosted Zone for awsquiz.click
3. Create A record: awsquiz.click → ALIAS → CloudFront distribution domain
4. Create A record: api.awsquiz.click → A → EC2 Elastic IP
```

#### 13A-4: GitHub Actions CI/CD (`deploy-frontend.yml`)

Create `.github/workflows/deploy-frontend.yml`:

```yaml
name: Deploy Frontend to S3

on:
  push:
    branches: [master]
    paths:
      - 'src/**'
      - 'public/**'
      - 'angular.json'
      - 'package.json'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npx ng build --configuration production
        env:
          NODE_OPTIONS: '--max-old-space-size=4096'

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Sync to S3
        run: |
          aws s3 sync dist/aws-clf-prac-app/browser/ s3://${{ secrets.S3_BUCKET }} \
            --delete \
            --cache-control "public, max-age=31536000, immutable" \
            --exclude "index.html"
          aws s3 cp dist/aws-clf-prac-app/browser/index.html s3://${{ secrets.S3_BUCKET }}/index.html \
            --cache-control "no-cache, no-store, must-revalidate"

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CF_DISTRIBUTION_ID }} \
            --paths "/*"
```

**GitHub Secrets to add** (Settings → Secrets → Actions):
- `AWS_ACCESS_KEY_ID` — IAM user with S3 write + CloudFront invalidation permissions
- `AWS_SECRET_ACCESS_KEY` — same IAM user
- `S3_BUCKET` — bucket name (e.g. `aws-clf-quiz-frontend`)
- `CF_DISTRIBUTION_ID` — CloudFront distribution ID (starts with `E`)

**IAM Policy for the GitHub Actions user (minimal permissions):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::BUCKET_NAME",
        "arn:aws:s3:::BUCKET_NAME/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DIST_ID"
    }
  ]
}
```

---

### 13B. Backend: EC2 t2.micro (Free Tier, Start/Stop Managed)

#### 13B-1: Launch EC2 Instance

AWS Console → EC2 → Launch Instance:
```
Name:           live-quiz-backend
AMI:            Ubuntu Server 22.04 LTS (HVM), SSD — 64-bit x86
Instance type:  t2.micro  ← free tier eligible (NOT t3.micro, which is not free tier)
Key pair:       Create new → download .pem file → store safely
Storage:        20 GB gp2 (free tier: 30 GB)
Security Group: Create new → name: live-quiz-sg
  Inbound rules:
    SSH   (22)  — My IP only (your current IP)
    HTTP  (80)  — 0.0.0.0/0
    HTTPS (443) — 0.0.0.0/0
  Outbound: All traffic allowed
```

After launch → EC2 Console → Elastic IPs:
```
Allocate Elastic IP → Attach to the t2.micro instance
Note the Elastic IP address (e.g. 54.123.45.67)
```

#### 13B-2: Resolve the Domain Name for SSL (nip.io, free)

Let's Encrypt requires a resolvable domain name. Without a paid domain, use **nip.io**:

```
Your Elastic IP: 54.123.45.67
nip.io domain:  api.54.123.45.67.nip.io
                ↑ paste your actual Elastic IP here, dots replaced with dots (use dots, not dashes)
```

No DNS configuration needed — nip.io automatically resolves any `<anything>.<IP>.nip.io` to that IP.

**If you register a Route 53 domain (optional, $0.75/month):**
```
awsquiz.click       → A record → CloudFront distribution domain (ALIAS)
api.awsquiz.click   → A record → EC2 Elastic IP
```
Replace all `api.54.123.45.67.nip.io` references below with `api.awsquiz.click`.

#### 13B-3: Server Setup Commands

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@<ELASTIC-IP>

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # must be v20.x

# Install PM2 globally
sudo npm install -g pm2

# Install nginx and certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Clone the repo
git clone https://github.com/ahleksu/aws-clf-prac-app.git
cd aws-clf-prac-app/backend
cp -r ../public/quiz/ ./quiz/   # copy quiz JSON files to backend
npm install
npm run build

# Create nginx config (edit DOMAIN below to match your nip.io or Route 53 name)
sudo tee /etc/nginx/sites-available/live-quiz > /dev/null <<'NGINX'
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
limit_req_zone  $binary_remote_addr zone=req_limit_per_ip:10m rate=60r/m;

server {
    listen 80;
    server_name DOMAIN;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name DOMAIN;

    # Certificates managed by certbot
    ssl_certificate     /etc/letsencrypt/live/DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # All 30 students may share a NAT IP at the venue — keep limit generous
    limit_conn conn_limit_per_ip 120;

    # Rate-limit REST endpoints only
    location /health {
        limit_req zone=req_limit_per_ip burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket + general proxy (Socket.io)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

# Replace DOMAIN placeholder
export DOMAIN="api.54.123.45.67.nip.io"   # ← edit this
sudo sed -i "s/DOMAIN/$DOMAIN/g" /etc/nginx/sites-available/live-quiz

sudo ln -s /etc/nginx/sites-available/live-quiz /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Issue Let's Encrypt certificate
sudo certbot --nginx -d $DOMAIN
# Follow prompts. certbot auto-renews via systemd timer — no manual renewal needed.

# Start with PM2
cd ~/aws-clf-prac-app/backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # copy and run the command it prints
```

#### 13B-4: Verify Backend Is Working

```bash
# From EC2 (local)
curl http://localhost:3000/health
# → {"status":"ok","sessions":0}

# From your laptop
curl https://api.54.123.45.67.nip.io/health
# → {"status":"ok","sessions":0} — with valid TLS (no cert warnings)
```

#### 13B-5: Keep Backend Updated

```bash
# SSH into EC2, then:
cd ~/aws-clf-prac-app
git pull origin master
cd backend && npm install && npm run build
pm2 restart live-quiz-backend
```

Optional — auto-deploy backend on push via GitHub Actions (add `appleboy/ssh-action` step to a separate `deploy-backend.yml` workflow).

#### 13B-6: Temporarily Stop/Start Backend EC2

Use `scripts/ec2-backend-lifecycle.sh` from the local machine when the live
backend is not needed. The script is idempotent: starting an already-running
instance and stopping an already-stopped instance are safe no-ops.

```bash
# Check EC2 state and backend health.
./scripts/ec2-backend-lifecycle.sh status

# Stop backend compute when there is no demo/classroom session.
./scripts/ec2-backend-lifecycle.sh stop

# Start backend again before testing or class. This waits for EC2 checks and /health.
./scripts/ec2-backend-lifecycle.sh start

# Optional one-command stop/start cycle.
./scripts/ec2-backend-lifecycle.sh restart
```

Defaults:

```bash
AWS_PROFILE=clf-quiz
AWS_REGION=ap-southeast-1
INSTANCE_ID=i-042b91a08364b6e01
API_URL=https://api.47.130.41.30.nip.io
```

Stopping EC2 makes live quiz sessions unavailable. It pauses compute, but
attached storage/static IP costs may still apply. Run the pre-demo health check
after starting the instance and before any classroom session.

---

### 13C. Pre-Demo Reliability Checklist

Save as `scripts/pre-demo-check.sh`. Run it from the local machine before each
classroom session. If the backend EC2 instance was stopped to avoid idle compute
cost, run `./scripts/ec2-backend-lifecycle.sh start` first.

```bash
#!/usr/bin/env bash
# Usage: ./scripts/pre-demo-check.sh
set -euo pipefail

API="${API:-https://api.47.130.41.30.nip.io}"
FRONTEND="${FRONTEND:-https://aws-clf-prac-app.vercel.app}"

echo "=== Pre-Demo Health Check ==="

echo "[1] Backend API health..."
curl -sf "$API/health" && echo " — OK" || echo " — FAIL: backend unreachable"

echo "[2] Frontend reachability..."
STATUS=$(curl -o /dev/null -s -w "%{http_code}" "$FRONTEND")
[ "$STATUS" = "200" ] && echo "OK: HTTP $STATUS" || echo "FAIL: HTTP $STATUS"

echo "[3] PM2 process status (run on EC2 via SSH):"
echo "    ssh -i ~/Desktop/live-quiz-backend-key.pem ubuntu@47.130.41.30 'pm2 status'"

echo "[4] WebSocket smoke test (requires wscat: npm i -g wscat):"
echo "    wscat -c 'wss://${API#https://}/socket.io/?EIO=4&transport=websocket'"

echo ""
echo "=== Done. If all pass, start the session. ==="
```

---

## 14. Angular Environment Configuration

### `src/environments/environment.ts` (development)

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  wsUrl: 'http://localhost:3000'   // Socket.io connects here; http:// is fine in dev
};
```

### `src/environments/environment.prod.ts` (production)

```typescript
export const environment = {
  production: true,
  // Replace with your actual backend URL after §13B-2 (nip.io) or §13B-1 Option B (Route 53)
  apiUrl: 'https://api.54.123.45.67.nip.io',
  wsUrl: 'https://api.54.123.45.67.nip.io'
};
```

**Critical — Mixed Content Rule:** The Angular SPA is served over HTTPS (CloudFront + ACM). Browsers enforce a hard rule: a page served over `https://` cannot initiate a WebSocket to `ws://` (unencrypted). This will silently fail in production. Both `apiUrl` and `wsUrl` **MUST** use `https://`. EC2 must have a valid TLS cert (Let's Encrypt via nip.io or custom domain) before the frontend can connect.

**Update `angular.json`** under `projects.aws-clf-prac-app.architect.build.configurations.production`:
```json
"fileReplacements": [
  {
    "replace": "src/environments/environment.ts",
    "with": "src/environments/environment.prod.ts"
  }
]
```

---

## 15. Session Lifecycle & Edge Cases

| Scenario | Handling |
|---|---|
| Player disconnects mid-game | Keep their state; rejoin with same code + nickname restores score, current question, answered status, and server time remaining. Refresh races replace the old socket by nickname even if its disconnect has not been observed yet. |
| Host disconnects | Broadcast `host:disconnected` to all players; session pauses automatically |
| Host reconnects | Re-emit `session:created`, `host:state`, and `host:reconnected` on reconnect with same code and valid `hostToken`; host can resume and player disconnected overlays clear on `host:reconnected`/`game:resumed` |
| Exposed host URL opened elsewhere | Reject `host:reconnect` unless the tab has the current per-session `hostToken`; copied `/host/session/:code` URLs cannot take over the active host session |
| Session cleanup | GameManager purges sessions older than 4 hours via `setInterval` |
| Duplicate nickname | Reject join with `session:error` message |
| Invalid session code | Reject join with `session:error` message |
| All players answer before timer | Auto-advance server-side; emit `leaderboard:show` |

---

## 16. Security Considerations

- **No auth tokens** — session codes are ephemeral and unguessable (crypto random)
- **Host validation** — host control events are processed only from the active host socket; host reconnects require a per-session `hostToken`
- **Input sanitization** — nicknames stripped of HTML, max 20 chars
- **Rate limiting** — 10 join attempts per IP per minute (express-rate-limit)
- **CORS** — backend `CORS_ORIGIN` env var is set to the CloudFront distribution URL in production
- **SSL** — nginx terminates TLS; Node.js runs on localhost:3000 only

---

## 17. Key Packages to Install

### Backend (`backend/package.json`)

```json
{
  "dependencies": {
    "express": "^4.18.3",
    "socket.io": "^4.7.5",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.2.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.12.7",
    "ts-node": "^10.9.2",
    "nodemon": "^3.1.0"
  }
}
```

### Frontend additions (`package.json` in repo root)

```bash
npm install socket.io-client
```

---

## 18. DDoS Protection & Demo Reliability

### Threat Model for This Use Case

The actual threat is not a DDoS attack from the internet — it's **demo failure from internal causes**. Prioritize accordingly.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| All 30 students refresh simultaneously | High | Medium | CloudFront serves cached assets at edge; no origin hit |
| Backend OOM (out of memory) | Very Low | High | 30 connections × ~4 KB state = 120 KB — trivial vs 512 MB RAM |
| TLS cert expired | Medium | High | certbot auto-renews; add a calendar reminder to verify monthly |
| WebSocket blocked by venue firewall | Medium | High | Socket.io falls back to HTTP long-polling automatically |
| Host browser disconnects mid-session | Medium | High | `host:disconnected` event pauses session; re-join restores it |
| EC2 instance crash / reboot | Low | High | PM2 configured as systemd service — auto-restarts on reboot |
| Rate-limit triggered on legitimate users | Low | High | Set burst limits to accommodate 30 simultaneous joins |
| Internet DDoS on backend | Very Low | High | EC2 Security Group + nginx `limit_conn` blocks basic L4 floods |
| Internet DDoS on frontend | Very Low | Low | CloudFront + AWS Shield Standard handles it at edge |

### nginx Rate Limits Tuned for 30 Users

The limit in §13B-3 allows **60 simultaneous connections per IP** which is deliberately generous. Adjust if your classroom shares one IP (e.g., all on school WiFi NAT):
```nginx
# If all 30 students share ONE IP (school NAT): raise limit significantly
limit_conn conn_limit_per_ip 200;  # 30 students × ~6 connections each (Socket.io polling)
```

### Socket.io Transport Fallback

Socket.io 4 automatically falls back from WebSocket to HTTP long-polling if:
- The venue firewall blocks WebSocket upgrade headers
- The connection drops and WebSocket reconnection fails

This fallback is transparent to users. Configure the Angular `SocketService` to allow both:
```typescript
const socket = io(environment.wsUrl, {
  transports: ['websocket', 'polling'],  // try WS first, fall back to polling
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 10
});
```

### CloudFront Cache Headers Strategy

Angular's build outputs hashed filenames for all assets (`main.XXXXXXXX.js`). The CI/CD workflow in §13A-4 sets:
- All assets (JS, CSS, fonts): `cache-control: public, max-age=31536000, immutable` — cached 1 year at edge
- `index.html`: `cache-control: no-cache, no-store` — always fetched fresh

This means when 30 students load the app simultaneously:
- `index.html` fetches from S3 (fast, small ~5 KB)
- All other assets are served from CloudFront edge cache — **zero S3/origin requests**
- No bandwidth spike to the backend

### Pre-Demo Verification Script

Save as `scripts/pre-demo-check.sh` (run from local machine before every session):
```bash
#!/bin/bash
set -e
API="https://api.awsquiz.click"
FRONTEND="https://awsquiz.click"

echo "Checking backend..."
curl -sf "$API/health" | python3 -m json.tool

echo "Checking frontend..."
STATUS=$(curl -o /dev/null -s -w "%{http_code}" "$FRONTEND")
[ "$STATUS" = "200" ] && echo "Frontend: OK ($STATUS)" || echo "Frontend: FAIL ($STATUS)"

echo "Done. If both pass, you're ready to demo."
```

---

## 19. Phase 8 — Live Session Feature Enhancements

Six targeted improvements to the live quiz experience, all implemented on a dedicated branch (`feature/phase-8-enhancements`) off `master`. None of these changes break existing solo quiz mode.

---

### 19.1 Full Per-Answer Reveal After Submission

**Problem:** After a player submits, they see only whether their pick was right and a single explanation. The host has no per-answer breakdown to facilitate classroom discussion. The backend already emits `question:reveal` (see `playerHandlers.ts`) but the payload is thin (`answerLabels[]` + one `explanation`) and the frontend never listens to it.

**Data already available:** Every answer object in the quiz JSON already carries its own `explanation` field and `status` (`'correct'` | `'skipped'`). `QuestionLoader.ts` currently strips both when building `LiveAnswer` — they must be preserved for the reveal pathway without being sent to players *before* they answer.

**Changes required:**

| Layer | Change |
|---|---|
| `backend/src/game/types.ts` | Expand `QuestionRevealPayload` to include `answers: RevealAnswer[]` where `RevealAnswer = { label, text, isCorrect, explanation }` |
| `backend/src/game/QuestionLoader.ts` | Store per-answer explanation in `LiveQuestion.answers` (add optional `explanation?: string` to `LiveAnswer`) |
| `backend/src/game/GameSession.ts` | `buildRevealPayload()` — assembles `RevealAnswer[]` from the current question's answer data |
| `backend/src/socket/playerHandlers.ts` | Already emits `question:reveal` on line 93; update the payload to use `buildRevealPayload()` |
| `backend/src/socket/hostHandlers.ts` | Also broadcast `question:reveal` to the room on host-side timer-expiry / `host:next` so the host screen gets the reveal too |
| `src/app/core/live-quiz.model.ts` | Add `RevealAnswer` and updated `QuestionRevealPayload` frontend types |
| `src/app/core/live-quiz.service.ts` | Add `revealPayload = signal<QuestionRevealPayload \| null>(null)` ; listen to `question:reveal` socket event; clear on new question |
| `src/app/pages/live/player-game/` | After answer submission, when `revealPayload()` is non-null, display all four answers with: green = correct, red = player's wrong pick, gray = unchosen wrong; show each answer's own `explanation` text below its button |
| `src/app/pages/live/host-session/` | Show same per-answer reveal panel in the host view after timer ends or all players answer |

**Security note:** `LiveAnswer.explanation` must NOT be included in `QuestionPayload` (the pre-answer broadcast). It is only sent in the post-answer `question:reveal` event.

---

### 19.2 Fix totalQuestions Count Display in Host Session

**Problem:** The host session header shows the wrong total question count (e.g. "Question 3 of 390") instead of the selected count (e.g. "Question 3 of 20").

**Investigation path:**
1. `QuestionLoader.ts` correctly slices to `questionCount` before returning.
2. `GameManager.ts` sets `totalQuestions: questions.length` — should be correct post-slice.
3. Check `HostDashboardComponent` — the question-count input field's default value or the validator's upper bound may be set to the full domain question count and that value may be passed to the backend unintentionally.
4. Check `HostSessionComponent` template — confirm it displays `currentQuestion()?.total` from `QuestionPayload`, not a stale raw count.

**Fix:** Trace the `questionCount` value from the dashboard form through `host:create` → `GameManager.createSession()` → `GameSession.data.totalQuestions` → `QuestionPayload.total`. Identify the point of divergence and fix it. Also verify the dashboard input default is 20 (not the full domain count).

---

### 19.3 QR Code + Shareable Link in Host Lobby

**Problem:** The host lobby shows only the text session code. During a classroom demo where the host shares their screen, scholars need a scannable QR code and a clickable link — typing a 6-char code into `/join` is error-prone.

**Implementation:**

```typescript
// Install: npm install qrcode @types/qrcode
import QRCode from 'qrcode';

const joinUrl = `${environment.frontendBaseUrl}/join?code=${sessionCode}`;
QRCode.toDataURL(joinUrl, { width: 220, margin: 2 })
  .then(url => this.qrCodeDataUrl = url);
```

- `environment.ts`: add `frontendBaseUrl: 'http://localhost:4200'`
- `environment.prod.ts`: add `frontendBaseUrl: 'https://aws-clf-prac-app.vercel.app'`
- `HostLobbyComponent`: QR code displayed as `<img>` (220×220 px min) above the session code
- Below QR: full clickable URL with a copy-to-clipboard button (PrimeNG Clipboard or native `navigator.clipboard`)
- Both elements must be large and legible on a projected screen

---

### 19.4 CSV Export of Session Results (Host Only)

**Problem:** After a classroom session ends, the host has no way to save the results for grading or review.

**Implementation (client-side only, no backend changes):**

```
Columns: Rank, Nickname, Score, Correct Answers, Total Questions, Accuracy %, Streak
Filename: quiz-results-<sessionCode>-<YYYY-MM-DD>.csv
```

- Add `isHost: boolean` and `sessionCode: string` inputs to `LeaderboardComponent`
- When `isHost === true`, render a "Download Results CSV" button (PrimeNG `p-button` with download icon)
- `downloadCsv()` method: build CSV string from `finalLeaderboard`, create a `Blob`, trigger `<a download>` click
- The `LeaderboardComponent` already receives `finalLeaderboard: LeaderboardEntry[]`; extend `LeaderboardEntry` to include `correctCount` and `streak` if not already present (check `Ranking` interface — they're there; pass them through)
- Host navigates to `/leaderboard/:code` from `HostSessionComponent` on `game:ended`; wire the `isHost` input via route data or service signal

---

### 19.5 Scoring Mode Toggle (Speed vs Points-Only)

**Problem:** Speed-based scoring rewards fast typists over knowledgeable learners. Instructors want a flat "1 point per correct answer" option for pure knowledge assessment.

**Two scoring modes:**

| Mode | Formula | Max per question |
|---|---|---|
| `'speed'` (default) | `BASE(1000) + TIME_BONUS(0–500) + STREAK_BONUS(0–500)` | 2000 |
| `'points'` | Flat 1000 per correct answer, no time or streak bonus | 1000 |

**Backend changes:**
- `backend/src/game/types.ts`: Add `ScoringMode = 'speed' | 'points'`; add `scoringMode: ScoringMode` to `GameSessionData`
- `backend/src/game/GameSession.ts`: `calculatePoints()` branches on `this.data.scoringMode`
- `backend/src/socket/hostHandlers.ts`: Read `scoringMode` from `host:create` payload; default to `'speed'`
- `session:created` response: echo back `scoringMode` so the host UI can display it

**Frontend changes:**
- `src/app/core/live-quiz.model.ts`: Add `ScoringMode` type
- `src/app/core/live-quiz.service.ts`: Add `scoringMode = signal<ScoringMode>('speed')`; set from `session:created`
- `HostDashboardComponent`: PrimeNG `SelectButton` with options `[{ label: 'Speed Scoring', value: 'speed' }, { label: 'Points Only', value: 'points' }]`; include in `createSession()` call
- `HostSessionComponent`: Show active mode badge in header bar (e.g. "⚡ Speed" or "📋 Points Only")

---

### 19.6 "Waiting for Host Action" UX State (Player Game)

**Problem:** After a player submits their answer, the between-question leaderboard card auto-dismisses, and the player is left staring at a frozen timer with no indication of what happens next. This is confusing — it looks like the app has hung.

**State machine for `PlayerGameComponent`:**

```typescript
type PlayerViewState = 'answering' | 'answered' | 'leaderboard' | 'waiting' | 'paused';
```

| State | Timer | Answer Buttons | Overlay |
|---|---|---|---|
| `answering` | Counting down | Active | — |
| `answered` | Frozen (shows time when submitted) | Disabled; answer reveal shown | Answer result feedback |
| `leaderboard` | Hidden | Hidden | Between-question leaderboard card |
| `waiting` | Hidden | Hidden | "⏳ Waiting for host..." + player's current score/rank |
| `paused` | Hidden | Hidden (or frozen) | "⏸ Quiz Paused by Host" |

**UI requirement:** `answered`, `leaderboard`, and `waiting` must preserve the
same answer-review surface after a player submits. The player should continue to
see whether their answer was correct, points earned, the selected answer, the
correct answer, color-coded revealed options, and per-answer explanations while
the leaderboard overlay is shown and after it is dismissed. Do not replace the
answered screen with a blank waiting state.

The player's submitted answer labels must be stored separately from the active
selection state so the result panel can accurately show "Your answer" after the
answer result arrives and after the state moves to `leaderboard` or `waiting`.
The waiting-for-host UI should be a compact status card at the top right of the
player view, not a large block below the answer review.

In the player answer grid, reveal icons for correct and selected-wrong answers
must stay in a dedicated trailing column on the right side of the answer button.
They must not wrap under the answer text or letter badge on long answer labels.

**Transitions:**
```
new question arrives (game:question)     → 'answering'
player submits answer (answer:result)    → 'answered'
leaderboard:show received                → 'leaderboard'
leaderboard card dismissed               → 'waiting'      ← THE FIX
game:question received while waiting     → 'answering'
game:paused while waiting/answering      → 'paused'
game:resumed                             → restore previous non-paused state
game:ended                               → navigate to /leaderboard/:code
```

**Implementation:** Replace the ad-hoc `submitted`, `showLeaderboard`, and disconnected boolean flags with a single `playerViewState: PlayerViewState` property. This makes the template a simple `@switch` on state, eliminating impossible combinations. Use compact rounded answer-letter badges with white letters on a dark background rather than circular chips in reveal/review panels so the answer labels read like structured quiz controls instead of decorative icons.

---

## 20. Phase 9 — Live Session UX + Instructor Answer Key

> **Status:** T1–T7 complete on `feature/phase-9-live-session-ux-answer-key`.
> Production builds pass and manual smoke validation was confirmed on
> 2026-04-30. Ready to merge to `master` and update EC2.

**Goal:** Improve live-session recovery/cancel UX and give the instructor a
controlled way to look up answer keys, explanations, and resource links while
teaching.

### 20.1 Lobby Cancel / Back-To-Home UX

**Problem:** Host and player waiting lobbies do not provide a clear way back to
the home screen. Leaving should be intentional and should clear session-local
identity state rather than preserving nicknames, host tokens, or stale session
codes.

**Requirements:**
- Add a visible **Cancel Session** action on the host dashboard setup form so a
  host can abandon lobby setup and return home before creating a room.
- Add a visible **Cancel Session** action on the join form so a player can
  abandon code/nickname entry and return home.
- Add a visible **Back to Home** / **Cancel Session** action on the host lobby.
- Add a visible **Back to Home** / **Leave Lobby** action on the player lobby.
- Host dashboard cancel should clear any stale host live-session state and
  navigate to `/` without submitting the create-session form.
- Join form cancel should clear local code/nickname entry, cached player
  live-session state, and navigate to `/` without submitting the join form.
- Host cancel should confirm intent, emit the existing end/cancel flow, clear
  the host `hostToken`, session code, role, cached live state, and navigate to
  `/`.
- Player lobby leave should intentionally invalidate that nickname for the
  current browser: emit a leave/disconnect pathway as needed, remove the player
  from the lobby if the quiz has not started, clear nickname/session cache, and
  navigate to `/`.
- Host lobby player counts must update after an intentional player leave.
- Do not break refresh/reconnect during an active quiz; intentional lobby leave
  is different from accidental disconnect/reconnect.

### 20.2 Missing / Ended Session Fallback UX

**Problem:** Stale `/host/lobby/:code`, `/host/session/:code`,
`/play/:code`, and `/play/:code/game` routes can leave users in an endless
loading state when the session no longer exists.

**Requirements:**
- On route entry, validate the session code using the existing
  `GET /session/:code` endpoint or a small live-session service helper.
- If the backend returns missing/ended/invalid, show a clear "Session no longer
  exists" state with a **Back to Home** button.
- Clear stale `sessionStorage`/service state for host token, role, nickname,
  session code, current question, reveal payload, and rankings.
- Handle `session:error` from socket events the same way: stop spinners, show
  the fallback state, and provide navigation home.

### 20.3 Secure Instructor Answer Key

**Problem:** The instructor needs a way to search all questions across domains,
view answer keys, explanations, and resource links, and use a question ID shown
in the live session to quickly find the matching answer key while teaching.

**Security boundary:**
- Add a backend-only, instructor-protected read endpoint. Do not put answer-key
  data into a public Angular bundle or into pre-answer live-session payloads.
- Use an environment secret such as `INSTRUCTOR_KEY` and require it via
  `Authorization: Bearer <key>` or `x-instructor-key`.
- Unauthorized requests must return `401`/`403` and no question data.
- Important limitation: the current solo quiz mode still ships full quiz JSON
  under `public/quiz/`, so answer secrecy is not absolute until Phase 7 or a
  later refactor removes correct-answer metadata from public static JSON. This
  Phase 9 endpoint is still useful as an instructor workflow and avoids adding
  more answer-key exposure to live-session payloads.

**Endpoint shape:**
- `GET /api/instructor/questions?domain=all&q=&id=` returns a filtered list.
- Include: stable question key, numeric ID, domain, type, question text,
  answers with labels/status/explanations, correct answer labels, and
  `resource`/`referenceUrl` when available.
- Prefer a stable composite key such as `<domainSlug>:<id>` because numeric
  IDs may not be globally unique across domain files.

**Local endpoint setup and smoke test:**
1. Add a non-production secret to `backend/.env`:
   ```bash
   INSTRUCTOR_KEY=<strong-local-instructor-key>
   ```
2. Start or restart the backend so `dotenv` loads the key.
3. Confirm unauthenticated requests are denied:
   ```bash
   curl -i 'http://localhost:3000/api/instructor/questions?domain=all&id=cloud_concepts:15'
   ```
   Expected result: `401 Unauthorized` when `INSTRUCTOR_KEY` is configured, or
   `503` when the key is missing.
4. Confirm authenticated requests return data:
   ```bash
   curl -s \
     -H "Authorization: Bearer $INSTRUCTOR_KEY" \
     'http://localhost:3000/api/instructor/questions?domain=all&id=cloud_concepts:15'
   ```
   The endpoint also accepts `x-instructor-key: <key>`.

**Instructor UI workflow:**
1. Open `/instructor/answer-key`.
2. Enter the same instructor key. The browser stores it in `sessionStorage`
   only.
3. Search by the host-displayed composite key, such as `cloud_concepts:15`, or
   by domain, numeric ID, or question text.
4. Expand the result to view correct labels, answer explanations, and the AWS
   resource link when present.

**Production deployment note:** P9-T7 manual smoke validation passed on
2026-04-30. Phase 9 was merged to `master`, pushed for Vercel, and deployed to
EC2. `INSTRUCTOR_KEY` is configured in the EC2 backend environment, PM2 was
restarted with the updated environment, and unauthenticated/authenticated
endpoint checks passed against `https://api.47.130.41.30.nip.io`.

**Frontend instructor view:**
- Add an instructor-only page such as `/instructor/answer-key`.
- Prompt for the instructor key and store it in `sessionStorage` only.
- Provide search by question ID/key, domain, and text.
- Render answer explanations and clickable resource links.
- Keep this page utilitarian and dense: table/list, filters, expandable answer
  detail, no marketing/hero layout.

### 20.4 Live Question ID / Key Display

**Problem:** During a live session, the instructor cannot easily map the shown
question back to the answer-key data.

**Requirements:**
- Add `questionId` and preferably `questionKey` to `QuestionPayload`,
  `QuestionRevealPayload`, and relevant frontend model types.
- Display the key only in the host live-session header, e.g.
  `Question 2 of 5 · ID cloud_concepts:15`.
- Do not send or display `questionId` or `questionKey` in player live-session
  question/reveal payloads, headers, or reveal/review panels. Players should
  not see the lookup key during the game; the key is for the instructor to use
  with the answer-key endpoint.
- Do not reveal correct answers before submission; ID/key metadata is safe to
  send pre-answer to the host only, but player payloads must be sanitized.
- Ensure CSV/export or final session data can still correlate answers to
  question IDs if later analytics are added.

### 20.5 Resource Links In Reveal / Review

**Problem:** Correct/incorrect answer reveal panels show explanations but do
not expose the source/resource link, so students cannot verify the explanation.

**Requirements:**
- Preserve `resource` from source JSON through the backend reveal pathway.
- Add `resource` or `resourceUrl` to the post-answer reveal payload, not as a
  correct-answer hint before answering unless explicitly desired later.
- In host and player reveal/review panels, render a clear clickable link when
  available: `View AWS reference`.
- Links must use `target="_blank"` and `rel="noopener noreferrer"`.
- If a question has no resource link yet, show no link or a subtle "Reference
  pending" note in instructor-only surfaces. Phase 7 remains responsible for
  auditing/filling missing official AWS references.

### 20.6 Phase 9 Validation

- `npm run build -- --configuration production` passes.
- `cd backend && npm run build` passes.
- Host dashboard cancel clears setup/live host state and returns home without
  creating a session.
- Join form cancel clears code/nickname entry and player live-session state,
  then returns home without joining a lobby.
- Host lobby cancel ends the lobby/session, clears host token/state, and
  returns home.
- Player lobby leave removes the waiting player, clears nickname/session state,
  updates host lobby count, and returns home.
- Stale host/player URLs for missing sessions show a fallback with **Back to
  Home**, never an endless spinner.
- Unauthorized answer-key endpoint requests return no data.
- Authorized answer-key search can find a live question by host-displayed
  `questionKey`.
- Host session header shows `· ID <questionKey>`; player session header does
  not show question IDs or keys, and player `game:question` /
  `question:reveal` payloads do not include them.
- Live reveal panels include clickable resource links when source JSON provides
  them.

---

## 21. Out of Scope (This Version)

- User accounts / authentication
- Persistent quiz history / analytics dashboard
- Full CRUD admin panel for question management (Phase 9 only adds a secured
  read-only instructor answer-key view unless explicitly expanded)
- Team mode (individual scoring only)
- Custom question creation in-browser
- Mobile app (PWA might be added later)
- Video/audio of host

These can be addressed in a v2 roadmap after v1 is stable in production.
