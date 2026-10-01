# still.

React + TypeScript + Vite + Tailwind frontend (`/`) and FastAPI + PostgreSQL backend (`/backend`).

## Modes
- **Account mode** (default): sign in or register. All data (check-ins, journal, posts, replies, reactions, saves, reports, blocks, preferences, activity completions) is stored by the API. Nothing from an account is written to localStorage, and the session lives in an HttpOnly cookie the frontend cannot read.
- **Local demo mode**: chosen explicitly ("Try local demo mode", or offered when the server is unreachable). Sample content, data stays in this browser, no account. A banner always shows which mode you are in. The app never switches to demo mode by itself when the backend fails.

Requires a running backend: everything in account mode. Works without one: only local demo mode.

## Run the whole app locally
1. **PostgreSQL**: create a database and user, e.g. `createdb still`.
2. **Backend** (`cd backend`):
   ```
   python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt
   export DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/still   # see backend/.env.example (the app reads the environment, not .env)
   export CORS_ORIGINS=http://localhost:5173
   alembic upgrade head            # migrations
   python -m app.seed              # activity catalogue only (no fake users or posts)
   uvicorn app.main:app --reload   # http://localhost:8000/docs
   ```
3. **Frontend** (repo root): `cp .env.example .env` (set `VITE_API_URL`, default `http://localhost:8000`), then `npm install && npm run dev` (http://localhost:5173).
   Use `localhost` for both, so the SameSite=Lax session cookie is sent. Set `COOKIE_SECURE=true` behind HTTPS.

## Environment variables (placeholders only; never commit real values)
`backend/.env.example`: `DATABASE_URL`, `CORS_ORIGINS`, `COOKIE_SECURE`, `SESSION_DAYS`. `.env.example`: `VITE_API_URL`.

## Tests
- `npx tsc --noEmit` · `npm run build` · `npm test` (Vitest: demo mode, plus API-integration tests with a mocked `fetch`: auth, check-ins, journal privacy and editing, report dialog, reply loading/errors, backend activity ids, saved posts beyond the newest page, Discover paging).
- `cd backend && python -m pytest -q` (SQLite in memory). For PostgreSQL: `TEST_DATABASE_URL=postgresql://... python -m pytest -q`, and `alembic upgrade head` / `downgrade base` / `upgrade head` against a real database (migrations: 0001 schema, 0002 report details, 0003 moderation, 0004 quiet room and notes).
- `npx playwright test`: two real accounts against a running backend and `vite preview` on :4173 (backend needs `CORS_ORIGINS=http://localhost:4173`). Set `PW_SPARTICUZ=1` to use the bundled Chromium where Playwright's own browser download is blocked.
- `e2e/qa.mjs W H` is a measurement script (overflow, colour contrast via axe, font loading, dialog focus), not a test suite.

## Moderation
Moderators review user reports in the app: **My Space → Moderation queue** (shown only to moderators). The queue lists each report's reason, the reporter's optional note, the reported post or reply, the report date and its status. A moderator can **Mark reviewed**, **Dismiss**, or **Remove content** (hides the post or reply from every user and closes other open reports on it). Every action, including who did it and when, is written to an audit log (**Audit log** tab, `GET /api/mod/log`). The reporter's identity is never shown to moderators.

Authorization is enforced on the server: every `/api/mod/*` endpoint checks the role stored in the database and returns 403 to ordinary users and 401 when signed out. Hiding the button in the UI is cosmetic only. There is **no public moderator registration and no API that grants roles**; registration and preference requests that include a `role` are rejected.

### Creating the first moderator (securely)
1. Register the account normally through the app (use a strong, unique password).
2. On the server, with `DATABASE_URL` set, run: `cd backend && python -m app.make_moderator their-email@example.com`
3. They sign out and in again (or simply reload) to see the queue. Revoke with `python -m app.make_moderator their-email@example.com --revoke`.
Only someone with shell and database access can do this; each grant or revoke is recorded in the audit log as done by the server CLI. Apply the migration first: `alembic upgrade head` (adds `users.role`, the review fields on reports, and the `moderation_log` table). Keep moderator accounts few, use unique passwords, and protect the server and database credentials, since those are what gate this role.

### Moderation limits
No appeals, no notice to the reporter or the author when content is removed (removed posts simply disappear for their author too), no restore-content action, no bulk actions, no assignment between moderators, and no automated moderation. The audit log is append-only in the API but is ordinary database rows, so anyone with direct database access could alter it.

## Quiet Room, Notes from strangers, the sky and Tiny Returns
Reached from the **Home** page ("More ways to be here"); the sky is in **My Space**. The five main destinations are unchanged.
- **The Quiet Room** (account mode only): `POST /api/quiet/join|heartbeat|leave`, `GET /api/quiet`. Presence is real: you count only while the page is open and sending a heartbeat every 30 s (expires after 90 s; leaving the page leaves the room). Other people only ever receive a **count** - never names, ids or durations. Presence rows are deleted after 7 days, are removed with the account, and appear in your data export. There is no chat. If you are alone, it says so.
- **Notes from strangers** (account mode only): you write 10-280 characters; the note is **pending** and visible only to you until a moderator approves it (**My Space → Moderation queue → Notes to review**). Readers receive only `{id, body}`; moderators also never see the author. Readers can report a note (existing report dialog; reported notes are hidden for the reporter, and a moderator can remove content like any report). Limit: 5 notes per hour per client IP. Nothing is seeded: with no approved notes the screen says so. Authors can delete their own notes; account deletion removes them and reports about them.
- **Sky** (My Space): your own check-ins (filled stars) and journal entries (rings) from your own authenticated data, filterable by feeling, keyboard-operable. Journal text is never drawn on the sky and is only shown after you choose "Read this entry". Positions are decorative: no score, no trend.
- **Tiny Returns**: filters the existing activity catalogue by energy, time and company and uses the existing completion endpoint; "Recent returns" is private to you. No streaks. Works in demo mode (with the sample catalogue).
- Migration `0004` adds `quiet_sessions` and `notes`. Run `alembic upgrade head`.

## Fonts
DM Sans and Instrument Serif are self-hosted through `@fontsource` packages (no request to Google Fonts). The earlier 403 was the test sandbox blocking `fonts.googleapis.com`; it no longer occurs.

## Known limitations and risks
- Not a security audit: no penetration test or external review has been done. Backend tests cover ownership and cross-user access only.
- Rate limiting is in memory and per process (resets on restart, not shared across workers): use a shared store such as Redis in production.
- Moderation is minimal (see above): no appeals, notifications, or analytics; the queue is unpaginated in the UI beyond the first 20 reports.
- Discover relevance ordering is applied to the pages loaded so far; older posts load on request ("Load older posts"). Category filters apply to loaded posts.
- Quiet Room and Notes have no fake presence or content: with nobody else around they show an honest empty state. A small count of people can still hint at who is around; there is no minimum-count threshold. Notes are moderated by hand only (no automated screening), the note queue is not paginated beyond 50, and the rate limit is per IP, not per account.
- Demo mode discards the report reason and details (local only). One write request runs at a time.
- Account pseudonym is fixed per account. Emails are not verified and there is no password reset.
- Visual QA: real-browser checks passed at 375px and 390px on the sign-in, register and all five demo screens plus the report dialog. At 768px and 1440px the headless browser timed out after the sign-in and register screens, so the five sections and dialogs there are **not** verified beyond the earlier Home/Discover checks. Only headless Chromium was used, with no screen reader or other browsers. Signed-in screens were exercised in the end-to-end test but not screenshot-audited.
