# Backend

FastAPI API for Program Ops. Uses a local SQLite file by default and Postgres when `DATABASE_URL` is set.

## Run locally

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head     # create the tables
.venv/bin/python -m app.seed       # load the sample cohort
.venv/bin/python -m app.create_user you@example.edu --name "Your Name"
.venv/bin/uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

The account command prompts for a password. Use that account to sign in to the frontend.

## Tests

```bash
.venv/bin/python -m pytest
```

## Changing the tables

Edit `app/models.py`, then:

```bash
.venv/bin/alembic revision --autogenerate -m "what changed"
.venv/bin/alembic upgrade head
```

## Sample data

`app/sample/` is exported from the frontend's sample cohort, so both sides start from the same data and the Python requirement rules can be checked against the TypeScript ones. To refresh it, run `npx tsx scripts/export-sample-data.ts` in `frontend/`.
