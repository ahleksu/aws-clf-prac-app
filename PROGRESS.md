# PROGRESS.md — Implementation Status

> **AI Copilot Directive:** Update this file immediately after completing each task. Mark tasks `[x]` as you go. Record blockers in the Blockers section. Add decisions made during implementation to the Decisions Log.

---

## Phase Status Overview

| Phase | Name | Status | Tasks Done | Notes |
|---|---|---|---|---|
| IAM | AWS Identity Setup | **In Progress** | 9 / 10 | 1 task remaining: policy correction |
| P0 | Project Scaffolding | **Complete** | 10 / 10 | |
| P1 | Backend: Game Engine | Not Started | 0 / 11 | Depends on P0 |
| P2 | Frontend: Services & Routing | Not Started | 0 / 6 | Depends on P0 |
| P3 | Frontend: Host Interface | Not Started | 0 / 4 | Depends on P1, P2 |
| P4 | Frontend: Player Interface | Not Started | 0 / 4 | Depends on P1, P2 |
| P5 | Integration Testing | Not Started | 0 / 7 | Depends on P3, P4 |
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

- [ ] P1-T1: Create `backend/src/game/types.ts`
- [ ] P1-T2: Create `backend/src/game/GameManager.ts`
- [ ] P1-T3: Create `backend/src/game/GameSession.ts`
- [ ] P1-T4: Create `backend/src/game/QuestionLoader.ts`
- [ ] P1-T5: Create `backend/src/socket/hostHandlers.ts`
- [ ] P1-T6: Create `backend/src/socket/playerHandlers.ts`
- [ ] P1-T7: Wire socket handlers in `backend/src/index.ts`
- [ ] P1-T8: Create `backend/src/routes/api.routes.ts`
- [ ] P1-T9: Create `backend/.env.example`
- [ ] P1-T10: Create `backend/ecosystem.config.js` (PM2)
- [ ] P1-T11: Manual backend validation test (wscat or test client)

---

## Phase 2 — Frontend: Services & Routing

- [ ] P2-T1: Create `src/app/core/live-quiz.model.ts`
- [ ] P2-T2: Update `SocketService` to be fully functional
- [ ] P2-T3: Create `src/app/core/live-quiz.service.ts`
- [ ] P2-T4: Add live routes to `app.routes.ts` (lazy-loaded)
- [ ] P2-T5: Update `HomeComponent` to add "Live Session" card
- [ ] P2-T6: Smoke test — new routes resolve, existing routes unaffected

---

## Phase 3 — Frontend: Host Interface

- [ ] P3-T1: Create `HostDashboardComponent`
- [ ] P3-T2: Create `HostLobbyComponent`
- [ ] P3-T3: Create `HostSessionComponent`
- [ ] P3-T4: Create `LeaderboardComponent` (shared)

---

## Phase 4 — Frontend: Player Interface

- [ ] P4-T1: Create `JoinComponent`
- [ ] P4-T2: Create `PlayerLobbyComponent`
- [ ] P4-T3: Create `PlayerGameComponent`
- [ ] P4-T4: Handle reconnection in `PlayerGameComponent`

---

## Phase 5 — Integration Testing

- [ ] P5-T1: Multi-tab end-to-end full game loop
- [ ] P5-T2: Pause/resume flow test
- [ ] P5-T3: Host disconnect/reconnect test
- [ ] P5-T4: Player disconnect/reconnect test
- [ ] P5-T5: Edge cases (invalid code, duplicate nick, late join)
- [ ] P5-T6: Mobile responsiveness (player views)
- [ ] P5-T7: Existing solo quiz mode regression check

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

*No blockers yet.*

| Date | Task | Blocker | Status | Resolution |
|---|---|---|---|---|
| — | — | — | — | — |

---

## Decisions Log

> Record any architectural or implementation decisions made during development that deviate from or extend PLAN.md.

| Date | Task | Decision | Rationale |
|---|---|---|---|
| 2026-04-28 | PIAM-T2 | Removed `s3:PutPublicAccessBlock` from admin policy (IAM validation rejected it); correct action is `s3:PutBucketPublicAccessBlock` — to be added in PIAM-T10 | AWS IAM does not recognize `s3:PutPublicAccessBlock`; the public access block API maps to `s3:PutBucketPublicAccessBlock` |
| 2026-04-28 | PIAM-T1 | Admin IAM username is `clf-quiz-admin-policy` (matches policy name) due to input error during creation | Functionally identical; renaming would require recreating the user and reconfiguring the CLI profile — not worth the effort |

---

## Current Working Session

> Keep this section updated so you can pick up exactly where you left off after a context reset.

**Last task completed:** P0-T10 — SocketService created, ng prod build passes (2026-04-28)
**Next task to work on:** P1-T1 — Create backend/src/game/types.ts
**Files recently modified:** backend/, src/environments/, angular.json, src/app/core/socket.service.ts, package.json (socket.io-client added)
**Anything the next session needs to know:**
- AWS account: `<REDACTED>`, region: `ap-southeast-1`, CLI profile: `clf-quiz`
- Admin IAM user is named `clf-quiz-admin-policy` (policy name was mistakenly used as username — no fix needed, works fine)
- `clf-quiz-github-actions` keys must be stored securely — needed for GitHub Secrets in Phase 6-A4
- `s3:PutPublicAccessBlock` was invalid in the admin policy and removed by user; add back as `s3:PutBucketPublicAccessBlock` before Phase 6 (PIAM-T10)
- Backend is EC2 **t2.micro** (free tier, always-on) — SSL via Let's Encrypt + nip.io
- Angular `environment.prod.ts` `wsUrl` MUST be `https://` — browsers block `ws://` from HTTPS pages
- Use `export AWS_PROFILE=clf-quiz` in every terminal session before running AWS CLI commands
