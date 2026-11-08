# Program Ops CRM

A CRM for cohort-based programs, such as fellowships, accelerators, internship programs, hackathons, and university project courses.

These programs usually run on a mix of spreadsheets, forms, calendars, and group chats. The people running them keep track of who attended what, which teams handed in their work, which partners have heard from their team, and who needs a reminder. Most of that lives in someone's head until something slips. Program Ops CRM puts participants, teams, partners, events, and requirements in one place, works out who is on track, and shows staff what needs their attention each day.

The platform is configurable. Each program defines its own participant fields, requirements, record types, and warning rules without changing any code.

## Features

- **Today.** A daily overview for the program manager. It lists the participants and teams that need attention and why, upcoming events and deadlines, each staff member's workload, open follow-ups, and a personal to-do list.
- **Participants and teams.** A searchable list of everyone in the program, with custom fields, notes, follow-up dates, and status against each requirement. Each team page shows its project, members, partner, and progress.
- **Import.** Upload a CSV of participants and teams and match its columns to the program's fields.
- **Calendar.** Workshops, meetings, and deadlines in a month or week view. Participants check in to an event through a shared link, and attendance counts toward requirements automatically.
- **Requirements.** Rules that participants or teams must meet, such as attending a minimum number of workshops, handing something in by a date, or logging a set number of records. The platform calculates whether each person and team is on track, at risk, or can no longer meet a rule. Staff can mark items done, excuse someone with a reason, and send reminders.
- **Partners.** The organizations that teams work with, the project each team is doing for them, and the staff member who looks after them.
- **Records.** Custom record types, such as partner meeting reports or issues, each with its own fields. Teams can submit records through a shared form link.
- **Customize.** Set up record types, tracked numbers (for example, days since a team's last partner meeting), and warning rules that flag a team when a number crosses a threshold.
- **Access.** Managers invite staff with a link and choose their role.

## How to use it

1. **Set up the program.** Add participant fields, requirements, and any record types the program needs in Customize and Requirements.
2. **Add people.** Import participants and teams from a CSV, then assign each team a staff member and a partner.
3. **Run the program.** Add events to the calendar and share check-in and form links with participants.
4. **Check in daily.** Open Today to see who is falling behind, follow up with notes and reminders, and mark work as done.

The repository includes a sample cohort of 20 teams working with community partners over one semester, so every page has data to explore.

## Built with

- **Frontend:** Next.js, React, TypeScript, and Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, and Alembic
- **Database:** SQLite locally, Postgres when hosted

The requirement rules exist in both TypeScript and Python. Tests check that both give the same result on the sample data.

## Running it locally

You need Node.js 20 or later and Python 3.11 or later.

**1. Start the backend**

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seed
.venv/bin/uvicorn app.main:app --reload --port 8000
```

**2. Start the frontend** (in a second terminal)

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. The app opens on the dashboard as the program manager, with no sign-in.

Sign-in is built but turned off for this version. To turn it on, create a manager account with `.venv/bin/python -m app.create_user you@example.com --name "Your Name" --role manager` (it asks for a password), then set `REQUIRE_SIGN_IN=true` in `backend/.env` and `NEXT_PUBLIC_REQUIRE_SIGN_IN=true` in `frontend/.env.local`.

To try the frontend without the backend, set `NEXT_PUBLIC_USE_BACKEND=false` in `frontend/.env.local`. The app then runs on the sample data, and changes are saved only in your browser.

## Project structure

```
frontend/   Next.js app (pages, components, requirement rules, sample data)
backend/    FastAPI app (API, database models, migrations, tests)
```

See [frontend/README.md](frontend/README.md) and [backend/README.md](backend/README.md) for checks, tests, and more detail on each part.
