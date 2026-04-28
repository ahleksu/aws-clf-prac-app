# PROGRESS.md — Implementation Status

> **AI Copilot Directive:** Update this file immediately after completing each task. Mark tasks `[x]` as you go. Record blockers in the Blockers section. Add decisions made during implementation to the Decisions Log.

---

## Phase Status Overview

| Phase | Name | Status | Tasks Done | Notes |
|---|---|---|---|---|
| IAM | AWS Identity Setup | **In Progress** | 9 / 10 | 1 task remaining: policy correction |
| P0 | Project Scaffolding | **Complete** | 10 / 10 | |
| P1 | Backend: Game Engine | **Complete** | 11 / 11 | Smoke-tested with multi-client script |
| P2 | Frontend: Services & Routing | **Complete** | 6 / 6 | Production build passes; warnings only |
| P3 | Frontend: Host Interface | **Complete** | 4 / 4 | Angular + backend builds pass; warnings only |
| P4 | Frontend: Player Interface | **Complete** | 4 / 4 | Angular + backend builds pass; warnings only |
| P5 | Integration Testing | **Complete** | 7 / 7 | P5-T1 through P5-T7 verified; production builds pass with existing Angular budget/selector warnings |
| P6 | AWS Deployment (Free Tier) | Not Started | 0 / 14 | S3+CF frontend + EC2 t2.micro backend |

---

## Phase IAM — AWS Identity Setup

- [x] PIAM-T1: Create IAM user `clf-quiz-admin-policy` (admin user) — ✅ 2026-04-28
- [x] PIAM-T2: Create `clf-quiz-admin-policy` customer managed policy — ✅ 2026-04-28
- [x] PIAM-T3: Attach `clf-quiz-admin-policy` to admin user — ✅ Verified via CLI
- [x] PIAM-T4: Create IAM user `clf-quiz-github-actions` — ✅ 2026-04-28
- [x] PIAM-T5: Create `clf-quiz-github-actions-policy` — ✅ 2026-04-28
- [x] PIAM-T6: Attach `clf-quiz-github-actions-policy` to github-actions user — ✅ Verified via CLI
- [x] PIAM-T7: Generate access keys for both users; store github-actions keys securely — ✅ 2026-04-28
- [x] PIAM-T8: Configure `clf-quiz` AWS CLI profile — ✅ 2026-04-28
- [x] PIAM-T9: Verified profile with `aws sts get-caller-identity` → `<REDACTED>:user/clf-quiz-admin-policy` — ✅
- [ ] PIAM-T10: Fix policy: add `s3:PutBucketPublicAccessBlock` and `s3:GetBucketPublicAccessBlock` to `clf-quiz-admin-policy` (original JSON had incorrect action name `s3:PutPublicAccessBlock`)

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

## Phase 6 — AWS Deployment (Free Tier: S3+CloudFront + EC2 t2.micro)

**Part A — Frontend (S3 + CloudFront)**
- [ ] P6-A1: Create private S3 bucket (us-east-1, block all public access)
- [ ] P6-A2: Create CloudFront distribution (OAC, 404→/index.html, redirect HTTP→HTTPS)
- [ ] P6-A3: ACM cert + Route 53 A record (optional; skip if using default cloudfront.net URL)
- [ ] P6-A4: Create IAM user `github-actions-deploy` + add 4 GitHub secrets
- [ ] P6-A5: Create `.github/workflows/deploy-frontend.yml` + verify CI/CD works

**Part B — Backend (EC2 t2.micro, always-on free tier)**
- [ ] P6-B1: Launch EC2 **t2.micro** (not t3.micro) + security group `live-quiz-sg`
- [ ] P6-B2: Allocate Elastic IP + associate to instance (note the IP)
- [ ] P6-B3: Install Node.js 20, PM2, nginx, certbot on EC2
- [ ] P6-B4: Clone repo + copy quiz JSON + build backend on EC2
- [ ] P6-B5: Determine nip.io domain from Elastic IP (e.g. api.54.123.45.67.nip.io)
- [ ] P6-B6: Configure nginx (template from PLAN.md §13B-3), enable site, reload
- [ ] P6-B7: Run certbot for Let's Encrypt cert on nip.io domain; verify TLS works
- [ ] P6-B8: Start backend with PM2 + configure pm2 startup (survives reboot)

**Part C — Integration**
- [ ] P6-C1: Update `environment.prod.ts` with nip.io URL; update backend CORS_ORIGIN; push to trigger CI/CD
- [ ] P6-C2: Create + run `scripts/pre-demo-check.sh`
- [ ] P6-C3: End-to-end test (two devices, real network, full game loop, check DevTools for errors)
- [ ] P6-C4: 10-tab load test; verify EC2 CPU stays below 30%
- [ ] P6-C5: Update README.md with production URLs; mark PROGRESS.md complete

---

## Blockers

> Record any blockers here. Include: what the blocker is, when it was encountered, and how it was resolved (or if it's still open).

| Date | Task | Blocker | Status | Resolution |
|---|---|---|---|---|
| 2026-04-28 | P5-T1 | Player Join and Host Start buttons stayed in loading state even though socket events succeeded | Resolved | Fixed Angular `effect()` dependency tracking in `JoinComponent` and `HostLobbyComponent` by reading signals before local loading guards |
| 2026-04-28 | P5-T3/P5-T4 | Refreshing a player during an active question reset the timer and showed a duplicate join error; refreshing the host left players stuck on the host-disconnected overlay after resume | Resolved | Active rejoin now replaces stale sockets by nickname, rehydrated questions include server `timeRemaining`, initial connect no longer shows reconnect toast, `host:state` rehydrates host UI, and `host:reconnected`/`game:resumed` clears player disconnected overlays |
| 2026-04-28 | P5-T5 | Host dashboard question count silently clamped invalid input; exposed host URLs could be opened in another tab/device | Resolved | Dashboard now validates against 5 to `min(65, available domain questions)` with toast/inline warning; host reconnect now requires a per-session `hostToken` and rejects duplicate active host sockets. Verified manually by user. |
| 2026-04-29 | P5-T6 | Player live views could horizontally overflow on phone-width screens because padded `width: min(100%, ...)` containers used default content-box sizing | Resolved | Added scoped `box-sizing: border-box` rules to `/join`, player lobby, and player game views; verified 375px `scrollWidth` equals viewport width. |

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

---

## Current Working Session

> Keep this section updated so you can pick up exactly where you left off after a context reset.

**Last task completed:** P5-T7 — Existing solo quiz mode regression verified in headless Edge (2026-04-29)
**Next task to work on:** Phase 6 — AWS deployment, starting with PIAM-T10 policy correction before S3/CloudFront work
**Files recently modified:** PLAN.md, TODOs.md, PROGRESS.md, backend/src/game/GameManager.ts, backend/src/game/GameSession.ts, backend/src/game/types.ts, backend/src/socket/hostHandlers.ts, backend/src/socket/playerHandlers.ts, backend/src/socket/sessionHelpers.ts, src/app/core/live-quiz.model.ts, src/app/core/live-quiz.service.ts, src/app/pages/live/host-dashboard/*, src/app/pages/live/host-session/*, src/app/pages/live/player-game/player-game.component.*, src/app/pages/live/player-lobby/player-lobby.component.css, src/app/pages/live/join/join.component.*, src/app/pages/live/host-lobby/host-lobby.component.ts
**Anything the next session needs to know:**
- AWS account: `<REDACTED>`, region: `ap-southeast-1`, CLI profile: `clf-quiz`
- Admin IAM user is named `clf-quiz-admin-policy` (policy name was mistakenly used as username — no fix needed, works fine)
- `clf-quiz-github-actions` keys must be stored securely — needed for GitHub Secrets in Phase 6-A4
- `s3:PutPublicAccessBlock` was invalid in the admin policy and removed by user; add back as `s3:PutBucketPublicAccessBlock` before Phase 6 (PIAM-T10)
- Backend is EC2 **t2.micro** (free tier, always-on) — SSL via Let's Encrypt + nip.io
- Angular `environment.prod.ts` `wsUrl` MUST be `https://` — browsers block `ws://` from HTTPS pages
- Use `export AWS_PROFILE=clf-quiz` in every terminal session before running AWS CLI commands
- P5 is complete. Verification performed:
  - Socket.io edge-case script: invalid code, duplicate nickname, late join after start, disconnected nickname active rejoin, and all-player disconnect/no-crash + host-end cleanup.
  - Headless Edge mobile pass at 375px: `/join`, `/play/:code`, `/play/:code/game`; all had `scrollWidth === 375`.
  - Headless Edge solo regression: home → quiz → result → review with 65 skipped questions carried into review.
  - Final builds: `npx ng build --configuration production` passes with existing initial bundle and selector warnings; `cd backend && npm run build` passes.
