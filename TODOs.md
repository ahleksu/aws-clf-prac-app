# TODOs.md — Implementation Task List

> **AI Copilot Directive:** Work through tasks in phase order. Do NOT skip phases. Mark each item `[x]` in PROGRESS.md immediately upon completion. Read PLAN.md for architecture context before starting any phase. Prefix commit messages with the phase and task number (e.g. `feat(P1-T3): implement GameSession state machine`).

---

## Phase IAM — AWS Identity Setup (Prerequisite)

> Goal: Two IAM users configured — one for local CLI/AI agent work, one for GitHub Actions CI/CD. Both verified before any infrastructure work begins. See PLAN.md §12.5 for full details and account info.

- [x] **PIAM-T1:** Create IAM user `clf-quiz-admin-policy` (admin user; note: named after the policy by mistake — functionally correct).
  - **Acceptance:** User exists in IAM console. ✅ Done 2026-04-28.

- [x] **PIAM-T2:** Create customer managed policy `clf-quiz-admin-policy` using the JSON from PLAN.md §12.5 (with the `s3:PutPublicAccessBlock` line removed).
  - **Acceptance:** Policy created and visible in IAM → Policies. ✅ Done 2026-04-28.

- [x] **PIAM-T3:** Attach `clf-quiz-admin-policy` to `clf-quiz-admin-policy` user.
  - **Acceptance:** `aws iam list-attached-user-policies --user-name clf-quiz-admin-policy --profile clf-quiz` returns the policy. ✅ Verified.

- [x] **PIAM-T4:** Create IAM user `clf-quiz-github-actions` (CI/CD only user).
  - **Acceptance:** User exists in IAM console. ✅ Done 2026-04-28.

- [x] **PIAM-T5:** Create customer managed policy `clf-quiz-github-actions-policy` using the JSON from PLAN.md §12.5 (S3 sync + CloudFront invalidation only).
  - **Acceptance:** Policy created. ✅ Done 2026-04-28.

- [x] **PIAM-T6:** Attach `clf-quiz-github-actions-policy` to `clf-quiz-github-actions` user.
  - **Acceptance:** `aws iam list-attached-user-policies --user-name clf-quiz-github-actions --profile clf-quiz` returns the policy. ✅ Verified.

- [x] **PIAM-T7:** Generate access keys for both IAM users. Store `clf-quiz-github-actions` keys securely (password manager) — they go into GitHub Secrets in Phase 6-A4.
  - **Acceptance:** Both users have active access keys. ✅ Done 2026-04-28.

- [x] **PIAM-T8:** Configure local AWS CLI `clf-quiz` profile:
  ```bash
  aws configure set aws_access_key_id <KEY_ID> --profile clf-quiz
  aws configure set aws_secret_access_key <SECRET> --profile clf-quiz
  aws configure set region ap-southeast-1 --profile clf-quiz
  aws configure set output json --profile clf-quiz
  ```
  - **Acceptance:** `[profile clf-quiz]` appears in `~/.aws/config`. ✅ Done 2026-04-28.

- [x] **PIAM-T9:** Verify the profile resolves correctly:
  ```bash
  aws sts get-caller-identity --profile clf-quiz
  ```
  - **Acceptance:** Returns `arn:aws:iam::<REDACTED>:user/clf-quiz-admin-policy`. ✅ Verified.

- [x] **PIAM-T10:** Fix the missing `s3:PutBucketPublicAccessBlock` action in `clf-quiz-admin-policy`. ✅ 2026-04-29
  - Done via CLI: `aws iam create-policy-version` created v2 with the correct action. Verified: `NoSuchBucket` (not `AccessDenied`) returned on test call.

---

## Phase 0 — Project Scaffolding

> Goal: Get a running skeleton with an empty WebSocket handshake end-to-end.

- [ ] **P0-T1:** Create `backend/` directory with its own `package.json`, `tsconfig.json`, and `.env.example`.
  - **Acceptance:** `cd backend && npm install` succeeds with no errors.

- [ ] **P0-T2:** Install backend dependencies: `express`, `socket.io`, `cors`, `express-rate-limit`, `dotenv`; devDeps: `typescript`, `ts-node`, `nodemon`, `@types/express`, `@types/cors`, `@types/node`.
  - **Acceptance:** `backend/node_modules` populated; `backend/package.json` correct.

- [ ] **P0-T3:** Configure `backend/tsconfig.json` (target: ES2020, module: CommonJS, outDir: `dist/`, strict: true, esModuleInterop: true).

- [ ] **P0-T4:** Add `backend/package.json` scripts: `"dev": "nodemon --exec ts-node src/index.ts"`, `"build": "tsc"`, `"start": "node dist/index.js"`.

- [ ] **P0-T5:** Create `backend/src/index.ts` — minimal Express + Socket.io server on port 3000 with CORS enabled. Log `"Server listening on :3000"` on start.
  - **Acceptance:** `npm run dev` in `backend/` starts without error; `curl localhost:3000/health` returns `{ "status": "ok" }`.

- [ ] **P0-T6:** Copy quiz JSON files to `backend/quiz/` (copy `public/quiz/*.json` → `backend/quiz/*.json`).
  - **Files:** `all.json`, `cloud_concepts.json`, `cloud_tech.json`, `security_compliance.json`, `billing_support.json`.

- [ ] **P0-T7:** Create `src/environments/environment.ts` and `src/environments/environment.prod.ts` with `apiUrl` and `wsUrl` fields (see PLAN.md §14).

- [ ] **P0-T8:** Update `angular.json` to add `fileReplacements` under the production build configuration to swap `environment.ts` → `environment.prod.ts`.

- [ ] **P0-T9:** Install `socket.io-client` in the Angular project root: `npm install socket.io-client`.

- [ ] **P0-T10:** Create `src/app/core/socket.service.ts` — injectable Angular service wrapping `socket.io-client`. Methods: `connect(url: string)`, `disconnect()`, `emit(event, data)`, `on<T>(event): Observable<T>`, `off(event)`.
  - **Acceptance:** Service compiles; `ng build` passes.

---

## Phase 1 — Backend: Game Engine

> Goal: Full server-side game loop working in isolation (testable via Postman + wscat).

- [ ] **P1-T1:** Create `backend/src/game/types.ts` with all TypeScript interfaces from PLAN.md §6: `GameSession`, `LiveQuestion`, `LiveAnswer`, `PlayerState`, `PlayerAnswer`, `Ranking`, `QuestionPayload`, `SessionState`, `QuizDomain`.

- [ ] **P1-T2:** Create `backend/src/game/GameManager.ts` — singleton class.
  - `sessions: Map<string, GameSession>`
  - `createSession(hostSocketId, domain, questionCount, timePerQuestion): GameSession`
  - `getSession(code): GameSession | undefined`
  - `removeSession(code): void`
  - `generateCode(): string` — 6-char alphanumeric, crypto-random, uppercase
  - `cleanupOldSessions()` — remove sessions older than 4 hours; called by `setInterval` every 30 min

- [ ] **P1-T3:** Create `backend/src/game/GameSession.ts` — class implementing the session state machine.
  - Constructor: accepts `GameSession` config, loads questions from JSON file
  - `addPlayer(socketId, nickname): PlayerState | Error`
  - `removePlayer(socketId): void`
  - `getCurrentQuestion(): QuestionPayload` — strips correct answers before returning
  - `startQuiz(): void` — `state → 'active'`, emits first question
  - `submitAnswer(socketId, answers: string[]): { correct, pointsEarned, correctAnswers, explanation }`
  - `checkAllAnswered(): boolean`
  - `advanceQuestion(): void` — increment index, emit next question or end
  - `pause(): void` / `resume(): void` — toggle `state`
  - `endQuiz(): Ranking[]`
  - `getRankings(): Ranking[]` — sorted by score desc, assigns `rank` property
  - Implement scoring from PLAN.md §8.

- [ ] **P1-T4:** Create `backend/src/game/QuestionLoader.ts` — utility.
  - `loadQuestions(domain: QuizDomain): Promise<LiveQuestion[]>`
  - Reads from `backend/quiz/<domain>.json`
  - Shuffles questions using Fisher-Yates
  - Maps `Answer.status === 'correct'` to `correctAnswers[]` array; strips `status` from the returned `LiveAnswer` objects
  - Assigns letter labels A, B, C, D to each answer

- [ ] **P1-T5:** Create `backend/src/socket/hostHandlers.ts`.
  - Handle: `host:create` → call `GameManager.createSession()`, join socket to room `sessionCode`, emit `session:created`
  - Handle: `host:start` → validate host socket, call `session.startQuiz()`, start question timer
  - Handle: `host:next` → `session.advanceQuestion()`; if no more questions, call `endQuiz()`
  - Handle: `host:pause` → `session.pause()`, broadcast `game:paused` to room
  - Handle: `host:resume` → `session.resume()`, broadcast `game:resumed` with time remaining
  - Handle: `host:end` → `session.endQuiz()`, broadcast `game:ended` to room, remove session
  - Handle: `disconnect` → if host, broadcast `host:disconnected`, pause session

- [ ] **P1-T6:** Create `backend/src/socket/playerHandlers.ts`.
  - Handle: `player:join` → validate code exists and session is in `lobby` state, check nickname uniqueness, call `session.addPlayer()`, join socket to room, emit `session:joined` to player, broadcast `lobby:update` to host
  - Handle: `player:answer` → validate session is `active`, call `session.submitAnswer()`, emit `answer:result` to player, emit `question:stats` to host; if all answered, trigger auto-advance
  - Handle: `disconnect` → mark player `connected: false`, broadcast `lobby:update` to host

- [ ] **P1-T7:** Wire all socket handlers in `backend/src/index.ts`:
  ```typescript
  io.on('connection', (socket) => {
    registerHostHandlers(io, socket, gameManager);
    registerPlayerHandlers(io, socket, gameManager);
  });
  ```

- [ ] **P1-T8:** Create `backend/src/routes/api.routes.ts` — minimal REST API:
  - `GET /health` → `{ status: 'ok', sessions: number }`
  - `GET /session/:code` → `{ valid: boolean, playerCount: number, state: SessionState }` (for pre-join validation)

- [ ] **P1-T9:** Create `backend/.env.example`:
  ```
  PORT=3000
  CORS_ORIGIN=http://localhost:4200
  NODE_ENV=development
  ```

- [ ] **P1-T10:** Create `backend/ecosystem.config.js` for PM2:
  ```javascript
  module.exports = {
    apps: [{
      name: 'live-quiz-backend',
      script: './dist/index.js',
      env_production: { NODE_ENV: 'production', PORT: 3000 }
    }]
  };
  ```

- [ ] **P1-T11 (Validation):** Test the complete backend manually with `wscat` or a simple HTML test client:
  - Create a session, join as a player, start quiz, submit answer, advance, end.
  - **Acceptance:** All socket events fire correctly; scoring works; session cleanup works.

---

## Phase 2 — Frontend: Services & Routing

> Goal: Angular can connect to the backend and the new routes exist.

- [ ] **P2-T1:** Create `src/app/core/live-quiz.model.ts` with all frontend interfaces from PLAN.md §6: `LiveSession`, `PlayerProfile`, `AnswerResult`, `LeaderboardEntry`.

- [ ] **P2-T2:** Update `SocketService` (from P0-T10) to be fully functional:
  - Use `inject(PLATFORM_ID)` to skip socket init during SSR/prerender
  - Ensure `on<T>()` cleans up subscriptions when component destroys (use `takeUntilDestroyed`)
  - Store socket as private field; expose `connected$: Observable<boolean>`

- [ ] **P2-T3:** Create `src/app/core/live-quiz.service.ts` — stateful service using Angular signals:
  - `gameState = signal<SessionState>('lobby')`
  - `currentQuestion = signal<QuestionPayload | null>(null)`
  - `players = signal<PlayerState[]>([])`
  - `rankings = signal<LeaderboardEntry[]>([])`
  - `myProfile = signal<PlayerProfile>({ nickname: '', score: 0, rank: 0, streak: 0 })`
  - `sessionCode = signal<string>('')`
  - Methods: `createSession(config)`, `joinSession(code, nickname)`, `submitAnswer(answers)`, `nextQuestion()`, `pauseSession()`, `resumeSession()`, `endSession()`
  - All methods call `SocketService.emit()` and listen to corresponding server events

- [ ] **P2-T4:** Add all new live routes to `src/app/app.routes.ts` using lazy loading:
  ```typescript
  { path: 'host', loadComponent: () => import('./pages/live/host-dashboard/...') },
  { path: 'host/lobby/:code', loadComponent: () => import('./pages/live/host-lobby/...') },
  { path: 'host/session/:code', loadComponent: () => import('./pages/live/host-session/...') },
  { path: 'join', loadComponent: () => import('./pages/live/join/...') },
  { path: 'play/:code', loadComponent: () => import('./pages/live/player-lobby/...') },
  { path: 'play/:code/game', loadComponent: () => import('./pages/live/player-game/...') },
  { path: 'leaderboard/:code', loadComponent: () => import('./pages/live/leaderboard/...') },
  ```

- [ ] **P2-T5:** Update `src/app/pages/home/home.component.ts` and its template to add a **"Live Session"** card alongside the existing domain cards.
  - "Host a Session" button → navigates to `/host`
  - "Join a Session" button → navigates to `/join`
  - Keep all existing domain cards untouched

- [ ] **P2-T6 (Validation):** Run `ng serve`, confirm `/host` and `/join` routes resolve (even as empty pages). Confirm existing `/`, `/quiz`, `/result`, `/review` still work.

---

## Phase 3 — Frontend: Host Interface

> Goal: Host can create a session, see players join, and control the quiz.

- [ ] **P3-T1:** Create `src/app/pages/live/host-dashboard/host-dashboard.component.ts`.
  - PrimeNG Select for domain (all/cloud_concepts/cloud_tech/security_compliance/billing_support)
  - PrimeNG Slider or InputNumber for question count (default 20); validate 5 to `min(65, available questions for selected domain)` with toast/inline warning instead of silent clamping
  - PrimeNG Select for time per question (15/20/30/45/60 seconds, default 30)
  - **Create Session** button → calls `LiveQuizService.createSession()` → on `session:created`, navigate to `/host/lobby/:code`
  - Show loading state while creating

- [ ] **P3-T2:** Create `src/app/pages/live/host-lobby/host-lobby.component.ts`.
  - Display session code in very large text (font-size: 3rem+, bold, colored)
  - QR code or shareable URL (optional; can be plain text `<app-url>/join?code=ABC123`)
  - Live scrolling list of players who have joined (sourced from `LiveQuizService.players()` signal)
  - Player count badge
  - **Start Quiz** button — disabled until ≥1 player; calls `LiveQuizService.nextQuestion()` after `host:start`
  - **Cancel** button — calls `LiveQuizService.endSession()`, navigate to `/host`
  - Listen to `lobby:update` and update player list in real-time

- [ ] **P3-T3:** Create `src/app/pages/live/host-session/host-session.component.ts`.
  - **Header bar:** Question N of Total | Session Code badge | Pause/Resume toggle button
  - **Question display:** Large question text; answer options shown as colored A/B/C/D cards (no correct answer highlighted for host — reveal only after everyone answers)
  - **Progress tracker:** `answered: X / total: Y` with animated progress bar (updates from `question:stats` events)
  - **Side panel / drawer:** Mini leaderboard (top 5 players, updates after each question via `leaderboard:snapshot`)
  - **NEXT QUESTION button:** enabled after auto-advance OR manually by host; calls `LiveQuizService.nextQuestion()`
  - **END QUIZ button:** PrimeNG ConfirmDialog → calls `LiveQuizService.endSession()` → navigate to `/leaderboard/:code`
  - Correct answers revealed on host screen AFTER the timer ends or all players answer
  - Listen to `leaderboard:snapshot` and update side panel

- [ ] **P3-T4:** Create shared `src/app/pages/live/leaderboard/leaderboard.component.ts` (used by both host and player).
  - Podium visual for rank 1, 2, 3 (trophy icons using PrimeNG Icons)
  - Full ranked list below podium
  - "Back to Home" button
  - Input: `finalLeaderboard: LeaderboardEntry[]` and `myNickname: string`
  - Highlight the current player's row
  - Add a simple CSS confetti animation or use a lightweight confetti library

---

## Phase 4 — Frontend: Player Interface

> Goal: Players can join, answer in real-time, and see their results.

- [ ] **P4-T1:** Create `src/app/pages/live/join/join.component.ts`.
  - Input field for session code (auto-uppercase, 6 chars, trim whitespace)
  - Input field for nickname (max 20 chars, alphanumeric + spaces)
  - **Join** button → calls `LiveQuizService.joinSession()` → on `session:joined`, navigate to `/play/:code`
  - On `session:error`, show PrimeNG Toast with the error message
  - Support URL pre-fill: if `/join?code=ABC123` the code field auto-populates
  - Show loading state while joining

- [ ] **P4-T2:** Create `src/app/pages/live/player-lobby/player-lobby.component.ts`.
  - "Waiting for host to start..." message with animated pulse
  - Player's nickname displayed prominently
  - Live player count (updates from `lobby:update`)
  - Animated AWS-themed background (use TailwindCSS + CSS animations, no heavy libraries)
  - Listen for `game:question` event → navigate to `/play/:code/game`

- [ ] **P4-T3:** Create `src/app/pages/live/player-game/player-game.component.ts`.
  - **Timer:** circular countdown (use TailwindCSS or SVG stroke-dashoffset animation); color changes: green (>50%) → yellow (25–50%) → red (<25%)
  - **Question text:** large, readable
  - **Answer buttons:** 4 colored buttons (Kahoot: red=A, blue=B, yellow=C, green=D) using `p-button` with custom CSS
  - On answer click: disable all buttons, submit via `LiveQuizService.submitAnswer()`
  - On `answer:result`: show correct/incorrect feedback overlay with points earned
  - On `leaderboard:show`: display the between-question leaderboard slide (3-second auto-dismiss or tap to dismiss)
  - On `game:paused`: show pause overlay ("Host has paused the quiz")
  - On `game:resumed`: hide pause overlay, resume timer display
  - On `game:ended`: navigate to `/leaderboard/:code`
  - On `host:disconnected`: show "Host disconnected — waiting..." message
  - Timer logic: client-side countdown from `timeLimit`; server is source of truth for correctness (server checks server-side elapsed time)

- [ ] **P4-T4:** Handle reconnection in `PlayerGameComponent`.
  - On socket reconnect, emit `player:join` again with same code + nickname
  - Server re-adds player with existing score (match by nickname in session)
  - Browser refresh during an active question restores current question, answered state, score/rank/streak, and server `timeRemaining`
  - Host refresh emits `host:reconnected`/`host:state`; player "Host disconnected" overlay clears once the host returns or resumes
  - Show brief "Reconnected!" toast

---

## Phase 5 — Integration Testing

> Goal: Full end-to-end flow works with host + multiple player tabs.

- [x] **P5-T1:** Local multi-tab test — open host in Tab 1 (`/host`), open 3 player tabs (`/join`). Run through complete game loop:
  - Create session → players join → start → answer questions → leaderboard between → end → final leaderboard
  - **Acceptance:** All 3 player tabs show correct state transitions simultaneously. ✅ Verified after join/start loading-state fix.

- [x] **P5-T2:** Test pause/resume flow: host pauses mid-countdown, all player timers freeze; host resumes, timer continues. ✅ Verified manually by user.

- [x] **P5-T3:** Test host disconnect: close/refresh host tab → players see "Host disconnected" → reopen host tab → host UI rehydrates current question → session resumes and player disconnected overlay clears. ✅ Verified manually by user.

- [x] **P5-T4:** Test player disconnect/reconnect: close/refresh player tab mid-quiz → reopen → player rejoins with same score, current question, answered state, and server-synced remaining timer. ✅ Verified manually by user.

- [x] **P5-T5:** Test edge cases:
  - Invalid session code on join page
  - Duplicate nickname rejection
  - Player joins after quiz has started (should be rejected with appropriate message)
  - Duplicate/exposed host session URL without the current host token is rejected ✅ Verified manually by user
  - Host question-count validation warns for values below 5 or above selected-domain max without silently clamping ✅ Verified manually by user
  - All players disconnect → session auto-cleanup after TTL
  - ✅ Remaining edge cases verified 2026-04-29 with Socket.io client flow: invalid code, duplicate nickname, late new player rejection, disconnected nickname active rejoin, and all-players-disconnected/no-crash plus host-end cleanup. TTL cleanup remains covered by the existing `GameManager` 4h cleanup interval.

- [x] **P5-T6:** Mobile responsiveness check for player views (`/join`, `/play/:code`, `/play/:code/game`). Must be usable on a phone (scholars will likely use phones). ✅ Verified 2026-04-29 in headless Edge at 375px; fixed scoped box sizing so player views do not horizontally overflow.

- [x] **P5-T7:** Confirm existing solo quiz mode is 100% unaffected. Run through: home → quiz → result → review. ✅ Verified 2026-04-29 in headless Edge with a 65-question skipped run carrying state into review.

---

## Phase 6 — AWS Deployment (Free Tier)

> Goal: Angular SPA on S3 + CloudFront (HTTPS via ACM); Node.js backend on EC2 t2.micro (HTTPS via Let's Encrypt + nip.io). Total cost: **$0/month** for the first 12 months. See PLAN.md §13 for full commands.

**Order matters:** Do Part A (frontend) first so you have the CloudFront URL to wire into `environment.prod.ts`. Then Part B (backend) so you know your EC2 Elastic IP for the nip.io domain. Then Part C (wire them together).

---

### Part A — Frontend (Pivoted: Vercel instead of S3+CloudFront)

> **Architecture pivot (2026-04-29):** CloudFront blocked on new account (AWS Support case open). Frontend deployed to Vercel — equivalent free HTTPS hosting with SPA routing via `vercel.json`. S3 bucket and OAC remain provisioned for future revert if desired.

- [x] **P6-A1:** S3 bucket `aws-clf-quiz-frontend` (ap-southeast-1, private). ✅ 2026-04-29
- [x] **P6-A2:** **Replaced by Vercel.** Frontend live at `https://aws-clf-prac-app.vercel.app`. ✅ 2026-04-29
  - `vercel.json`: Angular build command, `dist/aws-clf-prac-app/browser` output, catch-all SPA rewrite.
  - `.vercelignore`: excludes `backend/` and `scripts/` so Vercel only sees the Angular root.
- [x] **P6-A3:** ACM/Route53 — Skipped. Vercel provides free HTTPS on `*.vercel.app`. ✅ 2026-04-29
- [x] **P6-A4:** GitHub Secrets — N/A for Vercel. Vercel CI/CD auto-deploys on push to master. ✅ 2026-04-29
- [x] **P6-A5:** `.github/workflows/deploy-frontend.yml` kept for reference (S3 path). ✅ 2026-04-29

---

### Part B — Backend: EC2 t2.micro (Free Tier, Always-On)

- [x] **P6-B1:** EC2 t2.micro `i-042b91a08364b6e01`, Ubuntu 22.04, SG `sg-0f43142600ef6bc09`. ✅ 2026-04-29
- [x] **P6-B2:** Elastic IP `47.130.41.30` attached. Instance always-on. ✅ 2026-04-29
- [x] **P6-B3:** Node.js v20.20.2, PM2 6.0.14, nginx, certbot installed. ✅ 2026-04-29
- [x] **P6-B4:** Repo cloned, quiz JSON copied, `npm run build` → `dist/index.js`. ✅ 2026-04-29
- [x] **P6-B5:** nip.io domain: `api.47.130.41.30.nip.io`. ✅ 2026-04-29
- [x] **P6-B6:** nginx: rate limiting + WebSocket proxy + HTTP→HTTPS redirect. ✅ 2026-04-29
- [x] **P6-B7:** Let's Encrypt cert issued; expires 2026-07-27; auto-renewal verified. ✅ 2026-04-29
- [x] **P6-B8:** PM2 running (24.8 MB); systemd startup configured; `pm2 save` done. ✅ 2026-04-29
  - Verified: `curl https://api.47.130.41.30.nip.io/health` → `{"status":"ok","sessions":0}`

---

### Part C — Integration ✅ COMPLETE

- [x] **P6-C1:** `environment.prod.ts` → `https://api.47.130.41.30.nip.io`; EC2 `CORS_ORIGIN` → `https://aws-clf-prac-app.vercel.app`. ✅ 2026-04-29
- [x] **P6-C2:** `scripts/pre-demo-check.sh` created with live URLs. ✅ 2026-04-29
- [x] **P6-C3:** End-to-end confirmed: Vercel frontend connects to EC2 backend over WSS. ✅ 2026-04-29
- [x] **P6-C4:** Load capacity accepted — 30 WS connections ≈ 130 MB vs 1 GB EC2 RAM. ✅ Accepted
- [x] **P6-C5:** README updated by user; all phases marked complete. ✅ 2026-04-29

---

## Operations — Backend EC2 Lifecycle

> Goal: Allow the classroom backend EC2 instance to be stopped when idle and
> started again safely before demos, without duplicating work or breaking the
> production health checks.

- [x] **OPS-T1:** Add idempotent EC2 lifecycle helper at `scripts/ec2-backend-lifecycle.sh`.
  - Supports `status`, `start`, `stop`, and `restart`.
  - Defaults to profile `clf-quiz`, region `ap-southeast-1`, instance `i-042b91a08364b6e01`, and API `https://api.47.130.41.30.nip.io`.
  - `start` waits for EC2 `instance-running`, EC2 status checks, and backend `/health`.
  - `stop` no-ops if already stopped and waits for `instance-stopped`.
  - **Acceptance:** Running the same action repeatedly does not fail solely because the instance is already in the requested state.

- [ ] **OPS-T2:** Before classroom use after a stop, run:
  - `./scripts/ec2-backend-lifecycle.sh start`
  - `./scripts/pre-demo-check.sh`
  - Confirm `https://api.47.130.41.30.nip.io/health` returns `{"status":"ok"}`.

---

## Phase 7 — CLF-C02 Question Bank Audit & Upgrade

> Goal: Every question in `public/quiz/` and `backend/quiz/` strictly aligns with the official CLF-C02 Exam Guide. Every question has a `referenceUrl` pointing to official AWS documentation. Deploy updated JSON to EC2.

**Exam domains (source: official CLF-C02 Exam Guide):**
| Domain | Weight |
|---|---|
| 1. Cloud Concepts | 24% |
| 2. Security and Compliance | 30% |
| 3. Cloud Technology and Services | 34% |
| 4. Billing, Pricing, and Support | 12% |

- [ ] **P7-T1:** Audit `public/quiz/cloud_concepts.json` — rewrite outdated/inaccurate questions; add `referenceUrl` to every question; ensure coverage of all Domain 1 task statements (Well-Architected Framework, CAF, migration strategies, cloud economics).
- [ ] **P7-T2:** Audit `public/quiz/security_compliance.json` — rewrite/update; add `referenceUrl`; ensure coverage of all Domain 2 task statements (shared responsibility, IAM, GuardDuty, Shield, WAF, Macie, compliance tools).
- [ ] **P7-T3:** Audit `public/quiz/cloud_tech.json` — rewrite/update; add `referenceUrl`; ensure coverage of all Domain 3 task statements (EC2, Lambda, ECS, RDS, DynamoDB, S3 storage classes, VPC, Route 53, SageMaker, Kinesis, SNS, SQS, Amplify, IoT Core, etc.).
- [ ] **P7-T4:** Audit `public/quiz/billing_support.json` — rewrite/update; add `referenceUrl`; ensure coverage of all Domain 4 task statements (pricing models, Reserved/Spot/Savings Plans, Cost Explorer, Budgets, Organizations, Support plans, Trusted Advisor).
- [ ] **P7-T5:** Regenerate `public/quiz/all.json` as a clean merge of all four domain files (no duplicates); validate JSON schema integrity.
- [ ] **P7-T6:** SSH into EC2 → `git pull origin master` in `~/aws-clf-prac-app` → `cp -r public/quiz/ backend/quiz/` → `pm2 restart live-quiz-backend` → verify `/health` still returns `{"status":"ok"}`.
- [ ] **P7-T7:** Smoke-test live app — load a session with each domain, confirm questions render and answers evaluate correctly.

---

## Phase 8 — Live Session Feature Enhancements

> **Branch:** `feature/phase-8-enhancements` (created from `master`)
> **Goal:** Six targeted UX and feature improvements to the live quiz session experience. P8-T1 through P8-T6 are implemented and deployed to `master`; P8-T7 remains a user-run manual smoke test before Phase 8 is marked complete. User requested deploying these changes to `master` on 2026-04-30 before P8-T7 completion.

---

- [x] **P8-T1:** Full per-answer reveal after submission (Backend + Frontend).
  - **Backend:** Expand `QuestionRevealPayload` in `types.ts` to `{ answers: RevealAnswer[], explanation: string }` where `RevealAnswer = { label: string; text: string; isCorrect: boolean; explanation: string }`.
  - **Backend:** Update `QuestionLoader.ts` to preserve `explanation` on `LiveAnswer` objects (add optional `explanation?: string` field).
  - **Backend:** Add `buildRevealPayload()` to `GameSession.ts`; update `playerHandlers.ts` (already emits `question:reveal` line 93) to use the new payload; also broadcast `question:reveal` from `hostHandlers.ts` on timer-expiry and `host:next`.
  - **Frontend:** Add `RevealAnswer` type and updated `QuestionRevealPayload` to `live-quiz.model.ts`.
  - **Frontend:** Add `revealPayload = signal<QuestionRevealPayload | null>(null)` to `LiveQuizService`; listen to `question:reveal` socket event; clear on new question.
  - **Frontend `PlayerGameComponent`:** When `revealPayload()` is non-null, show all four answer buttons color-coded (green = correct, red = player's wrong pick, gray = unchosen wrong) each with its own `explanation` text below.
  - **Frontend `HostSessionComponent`:** Show the same per-answer reveal panel in the host view after timer ends or all players answer.
  - **Acceptance:** Submitting a wrong answer shows all four options with their correct/incorrect status and individual explanations. Host screen shows the same reveal.

- [x] **P8-T2:** Fix `totalQuestions` count display in `HostSessionComponent`.
  - Trace `questionCount` from dashboard form → `host:create` payload → `GameManager.createSession()` → `GameSessionData.totalQuestions` → `QuestionPayload.total` → host session header template.
  - Identify and fix the point where the count diverges from the user-selected value (likely the dashboard input default or validation upper-bound being passed as `questionCount`).
  - Verify `HostDashboardComponent` question-count input defaults to `20` and passes the actual form value (not the max/upper-bound) to `createSession()`.
  - **Acceptance:** Host session header shows "Question N of 20" (or whatever was selected), not the full domain question count.

- [x] **P8-T3:** QR code + shareable link in `HostLobbyComponent`.
  - Add `frontendBaseUrl` to `src/environments/environment.ts` (`'http://localhost:4200'`) and `environment.prod.ts` (`'https://aws-clf-prac-app.vercel.app'`).
  - Install `qrcode` and `@types/qrcode` in the Angular project root (`npm install qrcode @types/qrcode`).
  - In `HostLobbyComponent`, generate a QR code data URL for `${environment.frontendBaseUrl}/join?code=${sessionCode}` using `QRCode.toDataURL()`.
  - Display QR code as `<img>` at minimum 220×220 px above the session code.
  - Below the QR: show the full join URL as a copyable text element with a copy-to-clipboard button (use `navigator.clipboard.writeText()`; show brief "Copied!" toast on success).
  - Both elements must be large and legible when screen-shared on a projector.
  - **Acceptance:** Host lobby shows QR code + URL; scanning the QR on a phone navigates to `/join?code=<code>` with the code pre-filled.

- [x] **P8-T4:** CSV export of session results in `LeaderboardComponent` (host view only).
  - Add `isHost = input<boolean>(false)` and `sessionCode = input<string>('')` inputs to `LeaderboardComponent`.
  - When `isHost()` is `true`, render a "Download Results CSV" PrimeNG `p-button` with a download icon.
  - `downloadCsv()`: build CSV string with header row `Rank,Nickname,Score,Correct,Total Questions,Accuracy %,Streak`; fill rows from `finalLeaderboard`; create a `Blob('text/csv')`; trigger `<a download>` click.
  - Filename: `quiz-results-<sessionCode>-<YYYY-MM-DD>.csv`.
  - Wire `isHost` and `sessionCode` inputs from `HostSessionComponent` navigation to `/leaderboard/:code` — use `LiveQuizService` signal or route state to determine host context.
  - Extend `LeaderboardEntry` in `live-quiz.model.ts` to include `correctCount: number` and `streak: number` if not already present; propagate from `Ranking` through `game:ended` payload.
  - **Acceptance:** On the final leaderboard as host, clicking "Download Results CSV" downloads a valid CSV with one row per player.

- [x] **P8-T5:** Scoring mode toggle — `'speed'` vs `'points'` (Backend + Frontend).
  - **Backend `types.ts`:** Add `export type ScoringMode = 'speed' | 'points'`; add `scoringMode: ScoringMode` to `GameSessionData`.
  - **Backend `GameSession.ts`:** `calculatePoints()` branches on `this.data.scoringMode`: `'speed'` uses existing formula; `'points'` returns flat `1000` if correct, `0` if not.
  - **Backend `hostHandlers.ts`:** Read `scoringMode` from `host:create` payload; default to `'speed'`. Echo `scoringMode` back in `session:created` response.
  - **Frontend `live-quiz.model.ts`:** Add `ScoringMode` type export.
  - **Frontend `live-quiz.service.ts`:** Add `scoringMode = signal<ScoringMode>('speed')`; set from `session:created` event.
  - **Frontend `HostDashboardComponent`:** Add PrimeNG `SelectButton` with `[{ label: '⚡ Speed Scoring', value: 'speed' }, { label: '📋 Points Only', value: 'points' }]`; default `'speed'`; pass to `createSession()`.
  - **Frontend `HostSessionComponent`:** Show scoring mode badge in the header bar.
  - **Acceptance:** Selecting "Points Only" in the dashboard results in flat 1000 pts per correct answer; no time or streak bonus; host session header shows the active mode.

- [x] **P8-T6:** "Waiting for Host Action" UX state in `PlayerGameComponent`.
  - Replace the ad-hoc `submitted: boolean` and `showLeaderboard: boolean` flags with a single `playerViewState: 'answering' | 'answered' | 'leaderboard' | 'waiting' | 'paused'` property.
  - Update all `effect()` blocks and event listeners to set `playerViewState` correctly per the transition table in PLAN.md §19.6.
  - Template becomes a `@switch` on `playerViewState`:
    - `'answering'`: timer + answer buttons
    - `'answered'`: disabled buttons with answer reveal; frozen timer; result panel stays visible with correct/incorrect state and points
    - `'leaderboard'`: between-question leaderboard card overlays the answered review instead of replacing it
    - `'waiting'`: no timer; compact top-right "Waiting for host to advance..." status card with score/rank/streak while the answered review remains visible
    - `'paused'`: "⏸ Quiz Paused by Host" overlay (existing)
  - After the leaderboard card is dismissed, set `playerViewState = 'waiting'` (the fix).
  - On `game:question`, reset to `'answering'` (already happens via the `currentQuestion` effect).
  - Preserve answer feedback after submission and while waiting: correct/incorrect result, points earned, selected answer, correct answer, color-coded revealed options, and per-answer explanations must remain visible.
  - Store submitted answer labels separately from active selection state so `Your answer` stays accurate after `answer:result`, `leaderboard:show`, and `waiting` transitions.
  - Use compact rounded answer-letter badges in player and host reveal/review surfaces with white letters on a dark background; avoid circular chips that read like decorative icons.
  - Keep correct/wrong reveal icons in a dedicated trailing column on player answer buttons; icons must stay right-aligned and vertically centered, not wrap below answer text.
  - **Acceptance:** After submitting and the leaderboard slide is dismissed, player sees the answer review plus a compact top-right "Waiting for host..." card with their current score — no frozen timer, no blank state.

- [ ] **P8-T7 (Validation):** Build and smoke-test all Phase 8 changes.
  - `ng build --configuration production` — must pass with no new errors.
  - `cd backend && npm run build` — must pass with no new errors.
  - Local multi-tab test: host creates session with "Points Only" mode → player joins → answers question → verify flat scoring → leaderboard shows → player sees "Waiting for host..." → host advances → player game resumes → end quiz → host downloads CSV.
  - Verify QR code resolves to correct join URL when scanned.
  - Verify per-answer reveal shows on both player and host screens.
  - Verify host session header shows correct question total.
  - Manual validation handoff: user will run the local smoke test before this task is marked complete.
  - Commit after smoke passes: `docs(P8-T7): smoke test passed; phase 8 complete`
  - Branch was merged/deployed to `master` by explicit user request before this validation task was complete.
  - **Do NOT mark Phase 8 complete until the user-run smoke test passes.**

---

## Phase 9 — Live Session UX + Instructor Answer Key

> **Branch:** create from `master`, recommended
> `feature/phase-9-live-session-ux-answer-key`.
> **Goal:** Fix live-session cancel/recovery UX and add an instructor-only
> answer-key lookup workflow with question IDs, explanations, and resource
> links. See PLAN.md §20.
> **Important:** P8-T7 is still pending user smoke validation. Do not mark Phase
> 8 complete as part of Phase 9 work.

- [x] **P9-T1:** Lobby Back-to-Home / Cancel UX.
  - Add host dashboard **Cancel Session** action to abandon setup, clear stale
    host live-session state, and navigate to `/` without submitting the form.
  - Add join form **Cancel Session** action to abandon code/nickname entry,
    clear stale player live-session state, and navigate to `/` without
    submitting the form.
  - Add host lobby **Cancel Session / Back to Home** action.
  - Add player lobby **Leave Lobby / Back to Home** action.
  - Host cancel confirms intent, ends/cancels the session, clears host token,
    role, session code, cached live state, and navigates to `/`.
  - Player leave clears nickname/session cache, intentionally removes the
    player from the lobby if the quiz has not started, updates host player
    counts, and navigates to `/`.
  - Do not break active-game accidental reconnect behavior.
  - **Acceptance:** Host/player can leave waiting lobbies cleanly; returning to
    `/join` or `/host` starts fresh without stale nickname/token/session state.

- [x] **P9-T2:** Missing/ended session fallback.
  - Validate `/host/lobby/:code`, `/host/session/:code`, `/play/:code`, and
    `/play/:code/game` on route entry using backend session state.
  - Convert missing/ended/invalid session responses and socket `session:error`
    events into a clear "Session no longer exists" view.
  - Add **Back to Home** button to the fallback view.
  - Clear stale live service/sessionStorage state when the fallback appears.
  - **Acceptance:** Stale host/player URLs never spin forever; they show a
    stable error state and a working route home.

- [x] **P9-T3:** Secured instructor answer-key endpoint.
  - Add a backend-only read endpoint, e.g.
    `GET /api/instructor/questions?domain=all&q=&id=`.
  - Protect it with `INSTRUCTOR_KEY` via `Authorization: Bearer <key>` or
    `x-instructor-key`; unauthorized requests return no question data.
  - Return stable question key, numeric ID, domain, type, question text,
    answer labels/text/status/explanations, correct labels, and
    `resource`/`referenceUrl` when present.
  - Use a composite `questionKey` such as `<domainSlug>:<id>` if numeric IDs
    are not globally unique.
  - **Security note:** Current solo mode still exposes full JSON under
    `public/quiz/`; this endpoint improves instructor workflow but true answer
    secrecy requires a later public-quiz sanitization refactor.
  - **Acceptance:** Unauthorized requests get 401/403; authorized requests can
    filter/search across all domains and include answer explanations + links.
  - **Operator workflow:** Set `INSTRUCTOR_KEY` in `backend/.env`, restart the
    backend, verify unauthenticated requests are denied, then verify Bearer or
    `x-instructor-key` requests return filtered data. Do not update EC2 until
    this branch passes P9-T7 and is merged.

- [x] **P9-T4:** Instructor answer-key UI.
  - Add a route such as `/instructor/answer-key`.
  - Prompt for instructor key and store it in `sessionStorage` only.
  - Provide filters/search by domain, numeric ID, composite key, and question
    text.
  - Render a dense instructor-facing list/table with expandable answers,
    explanations, correct/skipped status, and clickable resource links.
  - **Acceptance:** Instructor can search for a displayed live question ID/key
    and see the answer key, explanations, and official resource link quickly.

- [x] **P9-T5:** Question ID/key display in live session.
  - Add `questionId` and `questionKey` to backend `QuestionPayload`,
    `QuestionRevealPayload`, and frontend live models.
  - Display `Question N of M · ID <questionKey>` in the host live-session
    header only.
  - Strip `questionId`/`questionKey` from player `game:question` and
    `question:reveal` payloads.
  - Hide `questionId`/`questionKey` from player live-session headers and
    player reveal/review panels so only the instructor can use the answer-key
    lookup.
  - Keep IDs visible before answering but continue hiding correct answers and
    explanations until reveal.
  - **Acceptance:** The instructor can read an ID/key from the host screen and
    find that exact question in the instructor answer-key page; players do not
    see that key.

- [x] **P9-T6:** Resource links in live answer reveal.
  - Preserve source JSON `resource` through the backend reveal payload.
  - Render a `View AWS reference` link in host and player post-answer reveal
    panels when a resource is available.
  - Use `target="_blank"` and `rel="noopener noreferrer"` for external links.
  - Do not add resource links to pre-answer payloads unless explicitly approved
    later.
  - **Acceptance:** After answers reveal, host and player can open the source
    link for the current question when the JSON provides one.

- [x] **P9-T7 (Validation):** ✅ Completed 2026-04-30 by user smoke validation.
  - `npm run build -- --configuration production` passes.
  - `cd backend && npm run build` passes.
  - Manual UX smoke: host/player lobby leave flows clear state and route home.
  - Manual stale-route smoke: missing host/player session URLs show fallback,
    not an endless spinner.
  - Manual instructor smoke: unauthorized answer-key endpoint denied;
    authorized answer-key UI searches by host-displayed live question key.
  - Manual key-visibility smoke: host session header shows `· ID <key>`;
    player session header does not show question IDs or keys; player socket
    payloads for `game:question` and `question:reveal` do not include IDs/keys.
  - Manual reveal smoke: resource links appear post-answer where available.
  - Deploy if requested: push `master` for Vercel and update EC2 backend via
    `git pull origin master`, backend build, PM2 restart, and `/health` check.

---

## Optional Enhancements (Post-V1)

These are nice-to-haves. Do NOT implement until Phase 6 is complete and tested.

- [ ] **OPT-1:** Add QR code for session join URL (use `qrcode` npm package in Angular)
- [ ] **OPT-2:** Add session replay — DynamoDB logging of question results for post-session review
- [ ] **OPT-3:** Add host ability to skip a question (mark all as skipped, no points awarded)
- [ ] **OPT-4:** Add "show correct answer" overlay for host between questions (educational mode)
- [ ] **OPT-5:** Add player streak counter display on player game screen
- [ ] **OPT-6:** PWA manifest so players can "Add to Home Screen" on mobile
- [ ] **OPT-7:** AWS Amplify migration (replace EC2 with Amplify Gen2 + AppSync for fully managed WebSocket)
