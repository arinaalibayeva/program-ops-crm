# Frontend

The Next.js app for Program Ops CRM. See the [main README](../README.md) for what the platform does and how to run it with the backend.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. With `NEXT_PUBLIC_USE_BACKEND=true`, it loads and saves through the backend at http://localhost:8000. With `false`, it runs on sample data stored in the browser.

## Checks

```bash
npx tsc --noEmit
npx eslint
```

## Where things are

- `app/admin/` holds the pages: Today, Participants, Teams, Calendar, Requirements, Partners, Customize, and Profile.
- `lib/requirements.ts` is the rules engine that calculates each participant's and team's status. The backend has the same logic in `app/services/requirements.py`.
- `lib/mock-data.ts` is the sample CCP cohort. Run `npx tsx scripts/export-sample-data.ts` after changing it, so the backend uses the same data.
- `lib/store.tsx` holds the app's data in the browser and saves changes to the backend.
