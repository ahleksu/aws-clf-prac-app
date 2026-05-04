# PROGRESS.md — Implementation Status

> **AI Copilot Directive:** Update this file immediately after completing each task. Mark tasks `[x]` as you go. Record blockers in the Blockers section. Add decisions made during implementation to the Decisions Log.

---

## Phase Status Overview

| Phase | Name | Status | Tasks Done | Notes |
|---|---|---|---|---|
| IAM | AWS Identity Setup | **Complete** | 10 / 10 | All done including PIAM-T10 policy fix |
| P0 | Project Scaffolding | **Complete** | 10 / 10 | |
| P1 | Backend: Game Engine | **Complete** | 11 / 11 | Smoke-tested with multi-client script |
| P2 | Frontend: Services & Routing | **Complete** | 6 / 6 | Production build passes; warnings only |
| P3 | Frontend: Host Interface | **Complete** | 4 / 4 | Angular + backend builds pass; warnings only |
| P4 | Frontend: Player Interface | **Complete** | 4 / 4 | Angular + backend builds pass; warnings only |
| P5 | Integration Testing | **Complete** | 7 / 7 | P5-T1 through P5-T7 verified; production builds pass with existing Angular budget/selector warnings |
| P6 | AWS Deployment (Hybrid: Vercel + EC2) | **Complete** ✅ | 14 / 14 | Frontend: https://aws-clf-prac-app.vercel.app · Backend: https://api.47.130.41.30.nip.io |
| OPS | Backend EC2 Lifecycle | **Active** | 1 / 2 | Idempotent helper added for EC2 status/start/stop/restart; start-before-demo check remains an operator task |
| P7 | CLF-C02 Question Bank Audit | **Not Started** | 0 / 7 | Comprehensive audit + EC2 redeploy; see TODOs.md |
| P8 | Live Session Feature Enhancements | **In Progress** | 6 / 7 | T1–T6 implemented and deployed to master/EC2 by user request; production builds pass; T7 pending user-run local smoke test |
| P9 | Live Session UX + Instructor Answer Key | **Complete** | 7 / 7 | T1–T7 complete; merged/pushed to `master`, Vercel triggered, EC2 backend updated, instructor endpoint verified 2026-04-30 |
| P10 | Cost Management & UX Fallbacks | **Complete** | 4 / 4 | ServerHealthService + offline banners on Home, Join, HostDashboard |
---

## Phase IAM — AWS Identity Setup

- [x] PIAM-T1: Create IAM user `clf-quiz-admin-policy` (admin user) — ✅ 2026-04-28
- [x] PIAM-T2: Create `clf-quiz-admin-policy` customer managed policy — ✅ 2026-04-28
- [x] PIAM-T3: Attach `clf-quiz-admin-policy` to admin user — ✅ Verified via CLI
- [x] PIAM-T4: Create IAM user `clf-quiz-github-actions` — ✅ 2026-04-28 (legacy S3/CloudFront deploy user; currently unused while Vercel is active)
- [x] PIAM-T5: Create `clf-quiz-github-actions-policy` — ✅ 2026-04-28
- [x] PIAM-T6: Attach `clf-quiz-github-actions-policy` to github-actions user — ✅ Verified via CLI
- [x] PIAM-T7: Generate access keys for both users — ✅ 2026-04-28 (`clf-quiz-github-actions` key is no longer needed for active frontend deployment)
- [x] PIAM-T8: Configure `clf-quiz` AWS CLI profile — ✅ 2026-04-28
- [x] PIAM-T9: Verified profile with `aws sts get-caller-identity` → `<REDACTED>:user/clf-quiz-admin-policy` — ✅
- [x] PIAM-T10: Fix policy: add `s3:PutBucketPublicAccessBlock` and `s3:GetBucketPublicAccessBlock` to `clf-quiz-admin-policy` — ✅ 2026-04-29 (created policy v2 via CLI; verified with NoSuchBucket response, not AccessDenied)

---

## Phase 0 — Project Scaffolding

- [x] P0-T1: Create `backend/` with `package.json`, `tsconfig.json`, `.env.example`
- [x] P0-T2: Install backend dependencies
- [x] P0-T3: Configure `backend/tsconfig.json`
- [x] P0-T4: Add `dev`, `build`, `start` scripts to `backend/package.json`
- [x] P0-T5: Create `backend/src/index.ts` — minimal Express + Socket.io server (verified `/health` returns `{status:"ok",sessions:0}`)
- [x] P0-T6: Copy quiz JSON files to `backend/quiz/`
- [x] P0-T7: Create Angular environment files (`environment.ts`, `environment.prod.ts`)
- [x] P0-T8: Update `angular.json` for production file replacements
- [x] P0-T9: Install `socket.io-client` in Angular project
- [x] P0-T10: Create `src/app/core/socket.service.ts` (verified `ng build --configuration production` passes)

---

## Phase 1 — Backend: Game Engine

- [x] P1-T1: Create `backend/src/game/types.ts`
- [x] P1-T2: Create `backend/src/game/GameManager.ts` (crypto-random codes, 4h cleanup)
- [x] P1-T3: Create `backend/src/game/GameSession.ts` (state machine, scoring, multi-correct logic)
- [x] P1-T4: Create `backend/src/game/QuestionLoader.ts` (Fisher-Yates shuffle, strips `status` field)
- [x] P1-T5: Create `backend/src/socket/hostHandlers.ts` (host events + disconnect → pause)
- [x] P1-T6: Create `backend/src/socket/playerHandlers.ts` (join, answer, disconnect)
- [x] P1-T7: Wire socket handlers in `backend/src/index.ts`
- [x] P1-T8: Create `backend/src/routes/api.routes.ts` (`/health`, `/session/:code`)
- [x] P1-T9: Create `backend/.env.example` (already done in P0)
- [x] P1-T10: Create `backend/ecosystem.config.js` (PM2)
- [x] P1-T11: Manual backend validation — node-based smoke test exercised full loop:
  - 1 host + 2 players, 3 questions, scoring verified (Bob: 1000 base + 500 time + 100 streak = 1600)
  - Auto-advance when all answered, timer expiry, manual `host:next`, `game:ended` final leaderboard
  - Pause/resume timeRemaining preserved across pause
  - Edge cases: invalid code → `session:error`, late join rejected

---

## Phase 2 — Frontend: Services & Routing

- [x] P2-T1: Create `src/app/core/live-quiz.model.ts`
- [x] P2-T2: Update `SocketService` to be fully functional
- [x] P2-T3: Create `src/app/core/live-quiz.service.ts`
- [x] P2-T4: Add live routes to `app.routes.ts` (lazy-loaded)
- [x] P2-T5: Update `HomeComponent` to add "Live Session" card
- [x] P2-T6: Smoke test — new routes resolve, existing routes unaffected

---

## Phase 3 — Frontend: Host Interface

- [x] P3-T1: Create `HostDashboardComponent`
- [x] P3-T2: Create `HostLobbyComponent`
- [x] P3-T3: Create `HostSessionComponent`
- [x] P3-T4: Create `LeaderboardComponent` (shared)

---

## Phase 4 — Frontend: Player Interface

- [x] P4-T1: Create `JoinComponent`
- [x] P4-T2: Create `PlayerLobbyComponent`
- [x] P4-T3: Create `PlayerGameComponent`
- [x] P4-T4: Handle reconnection in `PlayerGameComponent`

---

## Phase 5 — Integration Testing

- [x] P5-T1: Multi-tab end-to-end full game loop — ✅ Verified manually after fixing join/start loading-state navigation
- [x] P5-T2: Pause/resume flow test — ✅ Verified manually by user
- [x] P5-T3: Host disconnect/reconnect test — ✅ Verified manually by user after reconnect fix
- [x] P5-T4: Player disconnect/reconnect test — ✅ Verified manually by user after reconnect fix
- [x] P5-T5: Edge cases — ✅ Verified invalid join code, duplicate nickname rejection, late new player rejection after start, disconnected nickname active rejoin, and all-players-disconnected/no-crash + host-end cleanup. Prior partial checks for host question-count validation and duplicate/exposed host URL rejection remain verified.
- [x] P5-T6: Mobile responsiveness (player views) — ✅ Verified `/join`, `/play/:code`, and `/play/:code/game` at 375px in headless Edge; fixed content-box overflow in player live views.
- [x] P5-T7: Existing solo quiz mode regression check — ✅ Verified home → quiz → result → review in headless Edge with a 65-question run.

---

## Phase 6 — AWS Deployment (Hybrid: Vercel + EC2 t2.micro)

**Part A — Frontend (S3 + CloudFront)**
- [x] P6-A1: Create private S3 bucket (`aws-clf-quiz-frontend`, ap-southeast-1, all public access blocked) — ✅ 2026-04-29
- [ ] P6-A2: Create CloudFront distribution (OAC, 404→/index.html, redirect HTTP→HTTPS) — 🔄 In progress via console (CLI blocked — new account needs verification). OAC `E37IFEDVTLC7J6` pre-created. Distribution wizard completed through Review step; pending post-creation config: default root object `index.html`, custom error pages 403/404→/index.html→200.
- [ ] P6-A3: ACM cert + Route 53 A record — **Skipped**: using default `*.cloudfront.net` URL (Free plan includes TLS cert automatically; no custom domain for now)
- [x] P6-A4: GitHub Secrets — N/A for Vercel. No S3/CloudFront deploy secrets are required while Vercel is active. ✅ 2026-04-29
- [x] P6-A5: Removed obsolete `.github/workflows/deploy-frontend.yml`; Vercel owns frontend CI/CD. ✅ 2026-05-04

**Part B — Backend (EC2 t2.micro, start/stop managed)**
- [x] P6-B1: Launch EC2 **t2.micro** Ubuntu 22.04 LTS + security group `live-quiz-sg` — ✅ 2026-04-29
  - Instance: `i-042b91a08364b6e01` | AMI: `ami-0b63ddeab4f8a92db` | AZ: `ap-southeast-1b`
  - Key pair: `live-quiz-backend-key` → saved to `~/Desktop/live-quiz-backend-key.pem` (chmod 400)
  - SG: `sg-0f43142600ef6bc09` — SSH (22) from `112.211.118.223/32`, HTTP (80) + HTTPS (443) from `0.0.0.0/0`
- [x] P6-B2: Allocate Elastic IP + associate to instance — ✅ 2026-04-29
  - Elastic IP: **`47.130.41.30`** | Allocation: `eipalloc-0e5258b8bb2dc5b04`
  - nip.io backend domain: **`api.47.130.41.30.nip.io`**
- [x] P6-B3: Install Node.js 20 (v20.20.2), PM2 (6.0.14), nginx, certbot on EC2 — ✅ 2026-04-29
- [x] P6-B4: Clone repo, copy quiz JSON, build backend — ✅ 2026-04-29 (`dist/index.js` confirmed)
- [x] P6-B5: nip.io domain: `api.47.130.41.30.nip.io` — ✅ 2026-04-29
- [x] P6-B6: nginx configured with rate limiting + WebSocket proxy; production config applied — ✅ 2026-04-29
- [x] P6-B7: Let's Encrypt cert issued for `api.47.130.41.30.nip.io`; expires 2026-07-27; auto-renewal verified (`certbot renew --dry-run` passed) — ✅ 2026-04-29
- [x] P6-B8: PM2 started (`live-quiz-backend`, 24.8MB RAM); systemd startup configured; `pm2 save` complete — ✅ 2026-04-29
  - **Verified:** `curl https://api.47.130.41.30.nip.io/health` → `{"status":"ok","sessions":0}` with valid TLS from public internet

**Part C — Integration**
- [x] P6-C1: Update `environment.prod.ts` with nip.io URL; update backend `CORS_ORIGIN` to Vercel URL; push triggered Vercel redeploy — ✅ 2026-04-29
- [x] P6-C2: `scripts/pre-demo-check.sh` created; FRONTEND URL set to `https://aws-clf-prac-app.vercel.app` — ✅ 2026-04-29
- [x] P6-C3: End-to-end confirmed live — frontend loads at Vercel URL, connects to EC2 backend over WSS — ✅ 2026-04-29
- [x] P6-C4: Load test deferred; EC2 t2.micro well within capacity for 30-user classroom load (30 WS connections ≈ 130 MB RAM vs 1 GB available) — ✅ Accepted
- [x] P6-C5: README.md updated by user with production URLs; PROGRESS.md marked complete — ✅ 2026-04-29

---

## Operations — Backend EC2 Lifecycle

- [x] OPS-T1: Added `scripts/ec2-backend-lifecycle.sh` idempotent helper for backend EC2 `status`, `start`, `stop`, and `restart`.
  - Defaults: AWS profile `clf-quiz`, region `ap-southeast-1`, instance `i-042b91a08364b6e01`, API `https://api.47.130.41.30.nip.io`.
  - `start` waits for EC2 running state, EC2 status checks, and backend `/health`.
  - `stop` safely no-ops if already stopped.
- [ ] OPS-T2: Before each classroom session after stopping EC2, run `./scripts/ec2-backend-lifecycle.sh start` and `./scripts/pre-demo-check.sh`.

---

## Phase 7 — CLF-C02 Question Bank Audit

- [ ] P7-T1: Audit `public/quiz/cloud_concepts.json` — rewrite outdated questions, add `referenceUrl`, cover all Domain 1 task statements
- [ ] P7-T2: Audit `public/quiz/security_compliance.json` — rewrite/update, add `referenceUrl`, cover all Domain 2 task statements
- [ ] P7-T3: Audit `public/quiz/cloud_tech.json` — rewrite/update, add `referenceUrl`, cover all Domain 3 task statements
- [ ] P7-T4: Audit `public/quiz/billing_support.json` — rewrite/update, add `referenceUrl`, cover all Domain 4 task statements
- [ ] P7-T5: Regenerate `public/quiz/all.json` as clean merge of all four domains; validate JSON schema integrity
- [ ] P7-T6: SSH EC2 → `git pull` → `cp -r public/quiz/ backend/quiz/` → `pm2 restart live-quiz-backend` → verify `/health`
- [ ] P7-T7: Smoke-test live app — load session per domain, confirm questions render and answers evaluate correctly

---

## Phase 8 — Live Session Feature Enhancements

> Branch: `feature/phase-8-enhancements` (off master)

- [x] P8-T1: Full per-answer reveal after submission (Backend + Frontend — `QuestionRevealPayload` expansion, `PlayerGameComponent` + `HostSessionComponent` UI)
- [x] P8-T2: Fix `totalQuestions` count display in `HostSessionComponent` (added `[min]`/`[max]` bounds on `p-inputnumber`; backend now echoes `totalQuestions` in `session:created`; service tracks `totalQuestions` signal)
- [x] P8-T3: QR code + shareable link in `HostLobbyComponent` (`qrcode` npm, `frontendBaseUrl` env var, copy-to-clipboard)
- [x] P8-T4: CSV export on `LeaderboardComponent` (host-only; client-side; columns: Rank/Nickname/Score/Correct/Total/Accuracy/Streak)
- [x] P8-T5: Scoring mode toggle `'speed' | 'points'` (Backend `GameSession.calculatePoints()` + Frontend `HostDashboardComponent` SelectButton + host header badge)
- [x] P8-T6: "Waiting for Host Action" UX state in `PlayerGameComponent` (`playerViewState` union type replaces ad-hoc booleans; follow-up restored persistent answer-review UI across answered/leaderboard/waiting, preserves submitted answer labels, uses compact top-right waiting card, replaced circular answer chips with dark rounded badges + white letters, and right-aligns reveal icons in a trailing answer-button column)
- [ ] P8-T7: Build validation ✅ (both `ng build --configuration production` and `cd backend && npm run build` pass) + local multi-tab smoke test (PENDING user validation)

---

## Phase 9 — Live Session UX + Instructor Answer Key

- [x] P9-T1: Host dashboard cancel, join form cancel, host lobby cancel, and player lobby leave actions clear relevant live-session state and route home; backend `player:leave` removes the player from a `lobby`-state session and updates host counts.
- [x] P9-T2: Live host/player routes call `LiveQuizService.validateSession()` against `GET /session/:code` on entry and render a shared `SessionMissingComponent` with Back to Home when the session is missing or ended.
- [x] P9-T3: Backend `GET /api/instructor/questions` requires `INSTRUCTOR_KEY` via Bearer or `x-instructor-key`; returns question key/ID/domain/answers/correct labels/explanations/resource. Rate-limited; 401 when unauthorized; 503 when not configured. PLAN.md now documents local setup, curl checks, UI workflow, and the post-validation EC2 deployment note.
- [x] P9-T4: `/instructor/answer-key` page prompts for key (sessionStorage-only), searches by domain/ID/text, and renders dense expandable answers + clickable resource links.
- [x] P9-T5: `LiveQuestion` now carries `domainSlug`/`questionKey`; `QuestionPayload` and `QuestionRevealPayload` expose `questionId`/`questionKey` for host/instructor use; the host session header displays `· ID <questionKey>` for answer-key lookup, while player question/reveal payloads and UI must hide question IDs/keys.
- [x] P9-T6: Reveal payload includes source `resource`; host and player reveal panels render `View AWS reference` links with `target="_blank" rel="noopener noreferrer"`.
- [x] P9-T7: Production builds pass (`npm run build -- --configuration production` and `cd backend && npm run build`). Manual UX smoke confirmed by user 2026-04-30: lobby leave, stale fallback, instructor auth/search, host-only live key lookup, and reveal resource links.

---

## Phase 10 — Cost Management & UX Fallbacks

- [x] P10-T1: Add backend reactivation guide to `PLAN.md` (CLI + Console) — ✅ Already present in PLAN.md §7 (lines 471–486); CLI script + console steps documented
- [x] P10-T2: Create `ServerHealthService` (HTTP `/health` check with timeout) — ✅ `src/app/core/server-health.service.ts`; signal-based (`null`=checking, `true`=online, `false`=offline); 5 s timeout
- [x] P10-T3: Update `HomeComponent` (UX fallback + disabled buttons) — ✅ Amber offline banner + disabled Host/Join buttons when offline; spinner while checking
- [x] P10-T4: Update direct route fallback logic in `JoinComponent` & `HostDashboardComponent` — ✅ Both components call `checkHealth()` on init and gate form content behind `isOnline() === true`; offline replaces form with amber banner + Back to Home; spinner while checking

--- 

## Blockers

> Record any blockers here. Include: what the blocker is, when it was encountered, and how it was resolved (or if it's still open).

| Date | Task | Blocker | Status | Resolution |
|---|---|---|---|---|
| 2026-04-28 | P5-T1 | Player Join and Host Start buttons stayed in loading state even though socket events succeeded | Resolved | Fixed Angular `effect()` dependency tracking in `JoinComponent` and `HostLobbyComponent` by reading signals before local loading guards |
| 2026-04-28 | P5-T3/P5-T4 | Refreshing a player during an active question reset the timer and showed a duplicate join error; refreshing the host left players stuck on the host-disconnected overlay after resume | Resolved | Active rejoin now replaces stale sockets by nickname, rehydrated questions include server `timeRemaining`, initial connect no longer shows reconnect toast, `host:state` rehydrates host UI, and `host:reconnected`/`game:resumed` clears player disconnected overlays |
| 2026-04-28 | P5-T5 | Host dashboard question count silently clamped invalid input; exposed host URLs could be opened in another tab/device | Resolved | Dashboard now validates against 5 to `min(65, available domain questions)` with toast/inline warning; host reconnect now requires a per-session `hostToken` and rejects duplicate active host sockets. Verified manually by user. |
| 2026-04-29 | P5-T6 | Player live views could horizontally overflow on phone-width screens because padded `width: min(100%, ...)` containers used default content-box sizing | Resolved | Added scoped `box-sizing: border-box` rules to `/join`, player lobby, and player game views; verified 375px `scrollWidth` equals viewport width. |
| 2026-04-29 | P6-A2 | `aws cloudfront create-distribution` returned `AccessDenied: Your account must be verified before you can add new CloudFront resources` | Resolved (workaround) | New AWS accounts require manual verification for CloudFront. Worked around by using the new CloudFront console wizard (Free plan → Single website → Amazon S3 origin → OAC auto-configured). CLI OAC `E37IFEDVTLC7J6` was pre-created and usable. Post-creation manual steps required: set default root object to `index.html`; add custom error pages 403/404→/index.html→HTTP 200. |
| 2026-04-29 | P6-A1 | PLAN.md specified bucket in `us-east-1` but user correctly questioned why not Singapore | Resolved | S3 bucket can be in any region — only ACM certs for CloudFront must be in `us-east-1`. Bucket created in `ap-southeast-1` (Singapore) for lower origin latency. PLAN.md §13A-1 updated to reflect this. |

---

## Decisions Log

> Record any architectural or implementation decisions made during development that deviate from or extend PLAN.md.

| Date | Task | Decision | Rationale |
|---|---|---|---|
| 2026-04-28 | PIAM-T2 | Removed `s3:PutPublicAccessBlock` from admin policy (IAM validation rejected it); correct action is `s3:PutBucketPublicAccessBlock` — to be added in PIAM-T10 | AWS IAM does not recognize `s3:PutPublicAccessBlock`; the public access block API maps to `s3:PutBucketPublicAccessBlock` |
| 2026-04-28 | PIAM-T1 | Admin IAM username is `clf-quiz-admin-policy` (matches policy name) due to input error during creation | Functionally identical; renaming would require recreating the user and reconfiguring the CLI profile — not worth the effort |
| 2026-04-28 | P3-T3 | Raised Angular production initial bundle error budget from `1MB` to `1.25MB` while keeping the warning at `500kB` | PrimeNG live-session controls pushed the existing app ~15kB over the hard error threshold; the warning still flags bundle growth without blocking production builds |
| 2026-04-28 | P5-T5 | Added a per-session host ownership token for `host:reconnect` | Prevents exposed/copied host session URLs from taking over an active lobby/session while still allowing the original host tab to refresh and rehydrate |
| 2026-04-28 | P5-T5 | Host dashboard validates question count on submit instead of relying on PrimeNG min/max clamping | PrimeNG `p-inputnumber` silently coerced invalid values; toast/inline validation is clearer and respects the selected domain’s available question count |
| 2026-04-29 | P6-A1 | S3 bucket created in `ap-southeast-1` instead of `us-east-1` as originally documented in PLAN.md §13A-1 | PLAN.md §13A-1 incorrectly specified `us-east-1` for the S3 bucket — only ACM certificates for CloudFront require `us-east-1`. S3 origin can be in any region; Singapore (`ap-southeast-1`) gives lower origin latency for the target classroom audience. PLAN.md updated to reflect this. |
| 2026-04-29 | P6-A2 | CloudFront distribution creation must be done via console (new plan-based wizard) rather than CLI | New AWS account verification requirement blocks all CloudFront CLI API calls. Console wizard uses a new 5-step flow: Choose plan (Free) → Get started → Specify origin → Enable security → Review and create. OAC is now configured automatically by checking "Allow private S3 bucket access to CloudFront". Post-creation manual steps still required: set default root object `index.html` and add custom error pages. PLAN.md §13A-2 updated to reflect new console flow. |
| 2026-04-29 | P6-A3 | Skipped ACM/Route53 setup | Free plan on the new CloudFront console includes a TLS certificate automatically for the `*.cloudfront.net` domain. No custom domain or ACM cert needed for this deployment. |
| 2026-04-29 | P6-A (frontend) | **Pivoted frontend hosting from S3+CloudFront to Vercel** | CloudFront account verification blocked by AWS Support case (account too new). Vercel provides equivalent free HTTPS hosting with automatic SPA routing support via `vercel.json`. Backend remains on EC2 t2.micro (unchanged). `vercel.json` created specifying Angular build command, `dist/aws-clf-prac-app/browser` output dir, and catch-all rewrite to `index.html` for SPA routing. S3 bucket and OAC remain provisioned — can revert to S3+CloudFront once AWS Support resolves the case. |
| 2026-04-30 | OPS-T1 | Added an idempotent EC2 lifecycle helper instead of relying on manual console stop/start | `scripts/ec2-backend-lifecycle.sh` lets the operator stop backend compute when idle and start it again with EC2 waiters plus `/health` verification. Stopping EC2 makes the live backend unavailable until `start` succeeds. |
| 2026-04-30 | P8 deploy | User requested promoting Phase 8 changes to `master` before the P8-T7 manual smoke test is marked complete | Vercel and the EC2 backend need the latest UI/backend changes on `master`; Phase 8 remains **In Progress (6/7)** until the user-run multi-tab smoke test passes. |
| 2026-04-30 | P9 planning | Added Phase 9 as a new live-session UX + instructor answer-key work package | The user requested clean lobby cancellation, stale-session fallback, instructor answer-key lookup, live question IDs, and resource links in reveal panels. The answer-key endpoint should be protected by `INSTRUCTOR_KEY`, but current solo mode still exposes full quiz JSON under `public/quiz/`, so true answer secrecy requires a later public-quiz sanitization refactor. |
| 2026-05-04 | Security | Hardened root `.gitignore` to catch `.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key` | Root `.gitignore` previously had no catch-all for env/secret files; backend `.gitignore` was the only guard. Redacted the AWS account ID from `PLAN.md`, `TODOs.md`, and `PROGRESS.md`, then rewrote Git history so the exact account ID is replaced with `<REDACTED>` in historical docs. Local scans found no committed `.env`, private key files, AWS access key IDs, or private-key blocks. |
| 2026-05-04 | P10 deploy | EC2 backend intentionally stopped after Phase 10 offline-UX work was deployed | Phase 10 adds graceful degradation so the frontend handles a stopped backend without broken spinners. EC2 stopped via `./scripts/ec2-backend-lifecycle.sh stop`. Frontend offline banners are live on Vercel. Run `./scripts/ec2-backend-lifecycle.sh start` and `./scripts/pre-demo-check.sh` before classroom use. |
| 2026-05-04 | Frontend CI/CD | Removed obsolete S3/CloudFront GitHub Actions workflow | Vercel is the active frontend deploy path from `master`, so `.github/workflows/deploy-frontend.yml` and its S3/CloudFront secret requirements were removed from the repo and docs. |

---

## Current Working Session

> Keep this section updated so you can pick up exactly where you left off after a context reset.

**PROJECT STATUS: ✅ FRONTEND LIVE · ⏹ BACKEND STOPPED (intentional)**

| Resource | URL / Info |
|---|---|
| Frontend (Vercel) | https://aws-clf-prac-app.vercel.app |
| Backend API + WSS (EC2) | https://api.47.130.41.30.nip.io — **currently stopped** |
| Health check | https://api.47.130.41.30.nip.io/health |
| EC2 SSH | `ssh -i ~/Desktop/live-quiz-backend-key.pem ubuntu@47.130.41.30` |

**To reactivate backend before class:**
```bash
./scripts/ec2-backend-lifecycle.sh start   # waits for EC2 ready + /health 200
./scripts/pre-demo-check.sh                # verifies frontend + backend
```
See PLAN.md §7 (EC2 Reactivation) for the Console-based alternative.

**Last pushed work:** Phase 10 offline UX + security-history cleanup
- Phase 10: `ServerHealthService` + amber offline banners on Home, Join, HostDashboard
- Security: root `.gitignore` hardened with `.env`/`*.pem`/`*.key` catch-alls; AWS account ID redacted from current docs and historical docs
- EC2 backend stopped after deployment; offline banners are live on Vercel

**Next tasks:**
- **P8-T7** — User-run local multi-tab smoke test still pending. Do NOT mark Phase 8 complete without confirmation.
- **P7** — CLF-C02 question bank audit (0/7). Start only after P8-T7 passes.

**Files modified in last session:**
- `src/app/core/server-health.service.ts` (new)
- `src/app/pages/home/home.component.ts/.html`
- `src/app/pages/live/join/join.component.ts/.html/.css`
- `src/app/pages/live/host-dashboard/host-dashboard.component.ts/.html/.css`
- `.gitignore` (security hardening)
- `PLAN.md`, `TODOs.md`, `PROGRESS.md` (AWS account ID redacted and history cleanup recorded)

**Anything the next session needs to know:**
- AWS account: `<REDACTED>`, region: `ap-southeast-1`, CLI profile: `clf-quiz`
- Admin IAM user is named `clf-quiz-admin-policy` (matches policy name — works fine)
- `clf-quiz-github-actions` is a legacy S3/CloudFront deployment user; unused while Vercel owns frontend CI/CD
- S3 bucket `aws-clf-quiz-frontend` created in `ap-southeast-1` (not us-east-1 — see Decisions Log)
- CloudFront OAC `E37IFEDVTLC7J6` (named `aws-clf-quiz-frontend-oac`) pre-created via CLI
- CloudFront blocked: new account requires verification. AWS Support case submitted 2026-04-29. Case type: Account and Billing > CloudFront > General.
- New CloudFront console (2026) has a plan-based wizard (Free/$0 plan chosen). OAC is now set automatically via "Allow private S3 bucket access to CloudFront" checkbox on Specify origin step.
- After CloudFront unblocks and distribution is created: MUST manually set (a) default root object = `index.html`, (b) custom error pages 403→/index.html→200 and 404→/index.html→200 — the new wizard doesn't expose these.
- EC2 instance: `i-042b91a08364b6e01` | Elastic IP: `47.130.41.30` | nip.io domain: `api.47.130.41.30.nip.io`
- SSH key: `~/Desktop/live-quiz-backend-key.pem` (chmod 400) — SSH: `ssh -i ~/Desktop/live-quiz-backend-key.pem ubuntu@47.130.41.30`
- SSH security group now includes the observed admin source `136.158.152.66/32`; temporary `0.0.0.0/0` SSH debug access was removed immediately after deployment.
- EC2 setup script: `scripts/ec2-setup.sh` — run P6-B3 through P6-B8 sections via SSH
- EC2 lifecycle helper: `./scripts/ec2-backend-lifecycle.sh status|start|stop|restart` — defaults to profile `clf-quiz`, region `ap-southeast-1`, instance `i-042b91a08364b6e01`, and API `https://api.47.130.41.30.nip.io`
- EC2 is currently **stopped**. Run `./scripts/ec2-backend-lifecycle.sh start` before any demo/classroom use. Storage/static IP costs may still apply while stopped.
- Pre-demo check script: `scripts/pre-demo-check.sh` — uses `https://aws-clf-prac-app.vercel.app` and `https://api.47.130.41.30.nip.io`; run after starting EC2 and before classroom use
- Backend is EC2 **t2.micro** (free tier) — SSL via Let's Encrypt + nip.io
- Angular `environment.prod.ts` `wsUrl` MUST be `https://` — browsers block `ws://` from HTTPS pages
- Use `export AWS_PROFILE=clf-quiz` per terminal session before AWS CLI commands
- Vercel owns frontend CI/CD from `master`; no S3/CloudFront GitHub Actions workflow is active.
