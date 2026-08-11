# Supabase manual checklist (do in bulk later)

Hand-done dashboard / env tasks only. Migrations `001`–`012` are already applied on the hosted project via agent/MCP — do **not** re-run those SQL files unless spinning up a new project.

Project: Dark Plains hosted Supabase (connected in Cursor MCP `user-supabase`).

---

## P0 — Required for live auth / password reset

- [ ] **Auth → URL configuration**
  - Site URL = production Vercel URL (e.g. `https://dark-plains….vercel.app` or custom domain).
  - Redirect allow-list includes:
    - `https://<prod-host>/reset-password`
    - `http://localhost:3000/reset-password` (local testing)
  - Keep any existing OAuth/callback URLs if you add providers later.

- [ ] **Vercel env**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key)
  - `SUPABASE_SERVICE_ROLE_KEY` (server only — never `NEXT_PUBLIC_`)
  - `NEXT_PUBLIC_SITE_URL` = same production origin used in Auth Site URL (used for reset emails)

- [ ] **Auth → Emails**
  - Confirm “Reset password” template is enabled and sends.
  - Optional: customize subject/body for Dark Plains tone.
  - Send a test reset from production login → Forgot password.

- [ ] **Smoke test (two browsers / two accounts)**
  - Register + login with Supabase Auth.
  - Party invite → accept.
  - Trade create → settle (if both online).
  - Co-op raid formation → one combat action → other client sees update (poll/realtime).
  - Forgot password → email link → `/reset-password` succeeds.

---

## P1 — Security dashboard toggles

- [ ] **Auth → Attack protection / password security**
  - Enable **Leaked password protection** (HaveIBeenPwned). Advisor currently reports this **disabled**.
  - Docs: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

- [ ] **Auth → Providers**
  - Confirm Email/password is enabled.
  - Confirm **Anonymous sign-ins** are off unless you intentionally want them (advisors flag many policies as “anonymous-capable”; turning anon off reduces risk even before RLS hardening).

- [ ] **Authentication → Users**
  - Spot-check that production users are Auth users (not only localStorage prototypes).
  - Ban/delete test junk accounts if any.

---

## P2 — Realtime / API exposure (usually already OK)

- [ ] **Database → Publications → `supabase_realtime`**
  - Confirm these tables are published (migration `011`/`012` added them; verify in UI):
    - `coop_raid_sessions`
    - `coop_raid_actions`
    - `party_invites`
    - `coop_dungeon_sessions`
  - If a table is missing, add it once in the UI (or ask agent to re-apply a safe publication migration).

- [ ] **Settings → API / Data API**
  - Confirm `public` schema is exposed as intended.
  - After any *new* tables created only in SQL editor (not migrations), grant `authenticated` + enable RLS (agent normally handles this in migrations).

---

## P3 — Optional hardening (can be agent SQL later; listed so you can batch)

These are advisor warnings. Prefer a dedicated migration when ready rather than clicking per-table in the UI.

- [ ] Add `TO authenticated` on RLS policies that currently omit role (reduces anon-role false opens). Tables flagged by advisor include sessions, social, `player_states`, chat, etc.
- [ ] Review `SECURITY DEFINER` RPCs callable by `authenticated`:
  - `public.is_coop_raid_participant(...)`
  - `public.is_party_participant(...)`
  - Keep if intentional for RLS helpers; otherwise revoke `EXECUTE` from `authenticated` / move out of exposed API surface.
- [ ] When server-owned `player_states` writes are trusted in production: revoke client `UPDATE`/`INSERT` on `player_states` from `authenticated`. **Blocked for now** — `PATCH /api/me` is the first prefer-API sync slice, but `saveRemotePlayer` still falls back to direct browser upsert on `501`/`503`/network failure. Revoking client writes early will break saves.

---

## Already done (skip)

| Item | Status |
|------|--------|
| Migrations `001`–`010` (+ security invoker) | Applied on hosted |
| `011_party_invites_and_realtime` | Applied |
| `012_coop_dungeon_sessions` | Applied |
| Party invite / raid / duel / dungeon session APIs | In app code on `master` |
| Fail-closed production without Auth keys | In app code |
| Forgot / reset password routes | In app code (needs P0 URL allow-list) |

---

## When you finish a batch

1. Tick boxes above.
2. Tell the agent what you completed so the checklist and roadmaps can be updated.
3. Re-run two-account smoke test after Auth URL / email changes.
