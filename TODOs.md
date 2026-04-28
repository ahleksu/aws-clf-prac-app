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

- [ ] **PIAM-T10:** Fix the missing `s3:PutBucketPublicAccessBlock` action in `clf-quiz-admin-policy`.
  - Go to IAM → Policies → `clf-quiz-admin-policy` → Edit JSON
  - In the `S3BucketManage` statement, add: `"s3:PutBucketPublicAccessBlock"` and `"s3:GetBucketPublicAccessBlock"`
  - Save. No need to detach/reattach — policy updates apply immediately.
  - **Acceptance:** `aws s3api put-public-access-block --bucket test-bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --profile clf-quiz` does NOT return `AccessDenied` (may return `NoSuchBucket` which is fine — that means the permission works).

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
  - PrimeNG Slider or InputNumber for question count (5–65, default 20)
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
  - Show brief "Reconnected!" toast

---

## Phase 5 — Integration Testing

> Goal: Full end-to-end flow works with host + multiple player tabs.

- [ ] **P5-T1:** Local multi-tab test — open host in Tab 1 (`/host`), open 3 player tabs (`/join`). Run through complete game loop:
  - Create session → players join → start → answer questions → leaderboard between → end → final leaderboard
  - **Acceptance:** All 3 player tabs show correct state transitions simultaneously

- [ ] **P5-T2:** Test pause/resume flow: host pauses mid-countdown, all player timers freeze; host resumes, timer continues.

- [ ] **P5-T3:** Test host disconnect: close host tab → players see "Host disconnected" → reopen host tab → session resumes.

- [ ] **P5-T4:** Test player disconnect/reconnect: close player tab mid-quiz → reopen → player rejoins with same score.

- [ ] **P5-T5:** Test edge cases:
  - Invalid session code on join page
  - Duplicate nickname rejection
  - Player joins after quiz has started (should be rejected with appropriate message)
  - All players disconnect → session auto-cleanup after TTL

- [ ] **P5-T6:** Mobile responsiveness check for player views (`/join`, `/play/:code`, `/play/:code/game`). Must be usable on a phone (scholars will likely use phones).

- [ ] **P5-T7:** Confirm existing solo quiz mode is 100% unaffected. Run through: home → quiz → result → review.

---

## Phase 6 — AWS Deployment (Free Tier)

> Goal: Angular SPA on S3 + CloudFront (HTTPS via ACM); Node.js backend on EC2 t2.micro (HTTPS via Let's Encrypt + nip.io). Total cost: **$0/month** for the first 12 months. See PLAN.md §13 for full commands.

**Order matters:** Do Part A (frontend) first so you have the CloudFront URL to wire into `environment.prod.ts`. Then Part B (backend) so you know your EC2 Elastic IP for the nip.io domain. Then Part C (wire them together).

---

### Part A — Frontend: S3 + CloudFront

- [ ] **P6-A1:** Create a **private** S3 bucket in `us-east-1`. Block all public access (CloudFront will access via Origin Access Control).
  - Name suggestion: `aws-clf-quiz-frontend`
  - **Acceptance:** Direct browser navigation to S3 URL returns 403.

- [ ] **P6-A2:** Create a CloudFront distribution (origin: S3 bucket, OAC not OAI).
  - Viewer protocol: **Redirect HTTP to HTTPS**
  - Add custom error page: **404 → `/index.html` → HTTP 200** (critical for Angular SPA routing — without this, any direct URL or page refresh returns 403/404)
  - Default root object: `index.html`
  - Cache policy: `CachingOptimized` (for all assets)
  - Apply the auto-generated S3 bucket policy when prompted (it grants CloudFront OAC read access)
  - **Acceptance:** Upload a test `<h1>Works</h1>` as `index.html` to S3. Navigate to CloudFront domain (`dXXXXX.cloudfront.net`) — it shows the page over HTTPS with a valid green lock. No AWS console login needed to view it.

- [ ] **P6-A3:** Request an ACM certificate for your CloudFront domain (optional, if you have a Route 53 domain).
  - ACM must be requested in `us-east-1` for CloudFront use.
  - Skip if using the default `dXXXX.cloudfront.net` URL (it already has HTTPS — no custom cert needed).
  - If using Route 53 domain: create A ALIAS record `awsquiz.click → CloudFront distribution`.

- [ ] **P6-A4:** Create IAM user `github-actions-deploy` with the minimal S3 + CloudFront policy from PLAN.md §13A-4. Generate Access Key ID and Secret.
  - Add 4 GitHub repository secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `CF_DISTRIBUTION_ID`.

- [ ] **P6-A5:** Create `.github/workflows/deploy-frontend.yml` using the template in PLAN.md §13A-4.
  - Important: the `s3 sync` command targets `dist/aws-clf-prac-app/browser/` (Angular 19 build output path). Verify this matches your actual `ng build` output.
  - **Acceptance:** Push a trivial change to `src/` on `master` → GitHub Actions run passes → CloudFront domain reflects the change (allow 1–2 minutes for cache invalidation).

---

### Part B — Backend: EC2 t2.micro (Free Tier, Always-On)

- [ ] **P6-B1:** Launch EC2 **t2.micro** (NOT t3.micro — t2.micro is what's free tier eligible) with Ubuntu 22.04 LTS. Create security group `live-quiz-sg`:
  - Inbound: SSH (22) from My IP, HTTP (80) from 0.0.0.0/0, HTTPS (443) from 0.0.0.0/0
  - **Acceptance:** Instance starts successfully in EC2 console with status "running".

- [ ] **P6-B2:** Allocate an Elastic IP and associate it with the t2.micro instance. Note the IP (e.g. `54.123.45.67`).
  - Elastic IP is **free** while the instance is running — do NOT stop the instance between sessions to avoid billing.
  - **Acceptance:** `ping 54.123.45.67` responds from your laptop.

- [ ] **P6-B3:** SSH in. Install Node.js 20, PM2, nginx, certbot. Full commands in PLAN.md §13B-3.
  - **Acceptance:** `node -v` outputs `v20.x`; `pm2 -v` works; `sudo nginx -t` passes.

- [ ] **P6-B4:** Clone repo on EC2. Copy quiz JSON files. Build backend.
  ```bash
  git clone https://github.com/ahleksu/aws-clf-prac-app.git
  cd aws-clf-prac-app/backend
  cp -r ../public/quiz/ ./quiz/
  npm install && npm run build
  ```
  - **Acceptance:** `ls dist/index.js` exists.

- [ ] **P6-B5:** Determine your nip.io backend domain from your Elastic IP:
  - Elastic IP `54.123.45.67` → nip.io domain: `api.54.123.45.67.nip.io`
  - Verify DNS resolves: `nslookup api.54.123.45.67.nip.io` → should return `54.123.45.67`
  - This is the value you will use everywhere as your backend domain.

- [ ] **P6-B6:** Configure nginx with the template from PLAN.md §13B-3. Replace `DOMAIN` with your nip.io domain. Enable the site, remove default site, test config, reload nginx.
  - **Acceptance:** `curl http://54.123.45.67` → nginx responds (even if 502 since Node.js not running yet).

- [ ] **P6-B7:** Run certbot to issue Let's Encrypt cert for the nip.io domain:
  ```bash
  sudo certbot --nginx -d api.54.123.45.67.nip.io
  ```
  certbot will automatically update the nginx config with SSL directives.
  - **Acceptance:** `curl https://api.54.123.45.67.nip.io/` responds (502 is OK at this point — TLS is working, Node.js just not started). No `curl` SSL errors.
  - Verify auto-renewal: `sudo certbot renew --dry-run` passes.

- [ ] **P6-B8:** Start backend with PM2 and configure systemd startup:
  ```bash
  cd ~/aws-clf-prac-app/backend
  pm2 start ecosystem.config.js --env production
  pm2 save
  pm2 startup   # copy and run the printed sudo command
  ```
  - **Acceptance:** `curl https://api.54.123.45.67.nip.io/health` returns `{"status":"ok","sessions":0}` with valid TLS.

---

### Part C — Wire Together & End-to-End Test

- [ ] **P6-C1:** Update `src/environments/environment.prod.ts` with your actual nip.io backend URL:
  ```typescript
  apiUrl: 'https://api.54.123.45.67.nip.io',
  wsUrl:  'https://api.54.123.45.67.nip.io'
  ```
  Also update backend `.env` on EC2: set `CORS_ORIGIN` to your CloudFront domain URL (e.g., `https://dXXXXX.cloudfront.net`). Restart PM2 after editing `.env`.
  - Push the environment change to `master` — GitHub Actions will rebuild and redeploy to S3/CloudFront.
  - **Acceptance:** GitHub Actions run succeeds. CloudFront URL serves the updated `environment.prod.ts`.

- [ ] **P6-C2:** Create `scripts/pre-demo-check.sh` using the template in PLAN.md §13C. Update the two URL variables. Run it and confirm all checks pass.

- [ ] **P6-C3:** Full end-to-end test from two real devices on separate networks:
  - Device 1 (laptop): open `https://dXXXXX.cloudfront.net/host` → create session (5 questions, 30s)
  - Device 2 (phone on mobile data, NOT same WiFi): open `/join` → enter code + nickname
  - Complete full game loop: lobby → start → 5 questions → leaderboard → end
  - Open browser DevTools on Device 2 — confirm **no** "mixed content" or WebSocket errors in console
  - **Acceptance:** All state transitions sync in under 1 second. Valid TLS on both URLs.

- [ ] **P6-C4:** Open 10 browser tabs on `/join` simultaneously. Join with Player01–Player10. Verify:
  - EC2 CPU stays below 30% (check via EC2 console Monitoring tab)
  - All 10 tabs receive questions simultaneously
  - Leaderboard is consistent across all tabs
  - **Acceptance:** No timeouts, no WebSocket disconnects during the test.

- [ ] **P6-C5:** Update README.md "Hosting a Live Session" section with actual CloudFront URL and nip.io backend domain. Remove Vercel references. Update PROGRESS.md to mark all phases complete.

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
