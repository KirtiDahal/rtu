# RTU Full-Stack MVP

## Structure
- `backend`: Express + Prisma + Socket.IO API
- `frontend`: React + Vite + TanStack Query client

## Backend
1. `cd backend`
2. Set `DATABASE_URL` in `.env` to your MySQL instance (for example: `mysql://USER:PASSWORD@localhost:3306/rtu_dev`).
3. Optional for tests: set `TEST_DATABASE_URL` (for example: `mysql://USER:PASSWORD@localhost:3306/rtu_test`).
4. Optional for AI fallback in Knowledge search: set `OPENROUTER_API_KEY` in `backend/.env`.
5. `npm install`
6. `npm run prisma:generate`
7. `npm run prisma:push`
8. `npm run prisma:seed` (safe seed: preserves existing users)
9. `npm run dev`

If you need a full reset + reseed for local development, run `npm run prisma:seed:reset`.

Runs on `http://localhost:4000`.

## Frontend
1. `cd frontend`
2. Copy `.env.example` to `.env` if needed.
3. `npm install`
4. `npm run dev`

Runs on `http://localhost:5173`.

## Tests
- Backend: `cd backend && npm test`
- Frontend: `cd frontend && npm test`
