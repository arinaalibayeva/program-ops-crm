# Program Ops CRM

A CRM for cohort-based programs: participants, teams, partners, event calendars, check-ins, requirements, notes and follow-ups.

Built with Next.js, TypeScript and FastAPI. Uses SQLite locally or Postgres.

## Run locally

Start the backend (see [backend/README.md](backend/README.md)), then:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Then open http://localhost:3000. Without the backend, set `NEXT_PUBLIC_USE_BACKEND=false` to run on sample data in the browser.
