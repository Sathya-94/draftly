# Draftly

AI-powered Gmail drafting assistant with an Express/Node backend, Postgres (Supabase-ready), and a static Tailwind frontend.

## Features
- Google OAuth login; JWT access/refresh for Draftly.
- Gmail integration: list threads, fetch message context, send approved drafts.
- LLM draft generation (OpenAI, Gemini) with streaming updates.
- Draft lifecycle: generate, edit, save, approve/reject, send; send logging.
- Responsive Gmail-like UI, toasts, spinners, floating approve/reject controls.

## Project Structure
- `backend/`: Express app, routes, services, db migrations.
- `frontend/`: Static HTML/JS/CSS Tailwind UI.
- `docker-compose.yml`: Local Postgres.

## Local Setup
1) Backend
```bash
cd backend
npm install
cp .env.example .env  # fill in secrets
node src/db/migrate.js
npm run dev  # or npm start
```

Key env vars:
- `PORT`, `NODE_ENV`
- `DATABASE_URL` (preferred) or `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `FRONTEND_URL` (for CORS)
- `JWT_SECRET`, `REFRESH_SECRET`, `ENCRYPTION_KEY`, `ENCRYPTION_IV`
- `LLM_PROVIDER`, `LLM_API_KEY`

2) Frontend
- Set `window.API_BASE` in `frontend/index.html` (defaults to `http://localhost:4000/api`).
- Serve `frontend/` statically (e.g., `npx serve frontend` or via your editor’s live server).

## Deployment (GitHub Pages + Supabase + Render/Railway)
- Frontend: GitHub Pages from `frontend/`, set `window.API_BASE` to your API URL.
- Backend: Render/Railway web service; set env vars above; run `node src/db/migrate.js` post-deploy; set `FRONTEND_URL` to your Pages URL; update Google OAuth redirect to `<api>/api/auth/google/callback` and frontend popup callback to `<pages>/popup-callback.html`.
- Database: Supabase `DATABASE_URL` with SSL.

## Scripts
Backend: `npm run dev`, `npm start`, `npm run lint`, `npm run format`.

## Notes
- Only approved drafts are sent; rejected/not-approved returns clear errors.
- Toasts and spinners cover loading/sending/generating; approve/reject FABs appear when draft content exists.
