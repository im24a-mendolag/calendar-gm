# Calendar

A calendar web app for school and personal life. You enter your school timetable once, and it repeats every week of the term. Exams, tests and deadlines appear on top of it, together with personal events like doctor appointments or job interviews.

**Status:** work in progress. See [Roadmap](#roadmap).

## Features

**Working now**

- **Timetable editor**
  - Set up subjects (with colour, teacher and usual room), terms and holidays.
  - Click a slot in the period grid to add a lesson.
- **Week view**
  - The timetable expanded into real lessons for each week. Holidays and days outside the term are skipped.
  - Your wake-up time at the start of each day and a red "now" line.
  - Homework due shown at the top of each day.
- **Tags on cards**
  - **Built-in types:**
    - School: Exam, Test, Presentation, Deadline.
    - Personal: Appointment, Interview, Work, Sport, Social.
    - Every lesson shows **Lesson**; a moved lesson also shows **Changed**.
  - **Your own tags** (name only), created in Settings. An event can have several.
  - **Overflow:** tags use at most half of a card's width. A tag that's too long is shortened with "…", and the rest go behind **+N**, which lists all tags on hover.
  - An exam replaces the lesson it takes place in. Personal events have their own neutral style.
- **Events:** create and edit exams, tests, presentations, deadlines and personal events.
  - Use the **New** button, or click an empty spot in the week grid to start one at that time.
  - Click an event to edit or delete it. You can add tags, including new ones created on the spot.
- **Today**
  - Shows your wake-up time and what's on now (with time left and a progress bar) and next.
  - Lists today's schedule with breaks.
  - Lists exams and appointments in the next 14 days with countdowns, and homework due.
- **Exams:** upcoming and past exams, tests and presentations grouped by month.
  - A detail panel shows the countdown, time, room, teacher, topics and notes.
  - Countdowns turn red within the "soon" window you set per event (default 3 days).
- **Sidebar "Coming up":** the next three exams, tests, presentations, appointments or interviews.
- **Settings**
  - Wake-up time per weekday. This is display only; the app never rings.
  - Terms and holidays.
  - Light, dark or system theme, and an option to show weekends.
- **Accounts:** email and password. Each user only ever sees their own data.

**Planned:** see [Roadmap](#roadmap).

## Tech stack

| Part | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query; plain CSS with design tokens |
| API | [Hono](https://hono.dev), running as a Vercel serverless function (`/api/*`) |
| Database | [Neon](https://neon.tech) Postgres via **Prisma 7** and the Neon driver adapter |
| Auth | [Better Auth](https://better-auth.com) (email + password), stored in the same database |
| Validation | Zod schemas shared by client and server (`shared/`) |
| Tests | Vitest |

The design is in Figma ("Student Calendar"). The colour, spacing and font values in `src/styles/tokens.css` are copied from its variables.

## Getting started

### 1. Requirements

- Node.js 22 or newer
- A free [Neon](https://console.neon.tech) project

### 2. Install

```bash
npm install
```

This also runs `prisma generate`, which creates the database client in `generated/prisma`. That folder is not committed.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

```ini
DATABASE_URL=postgresql://neondb_owner:PASSWORD@ep-xxxx-xxxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
BETTER_AUTH_SECRET=<random string, see below>
BETTER_AUTH_URL=http://localhost:5173
```

- **`DATABASE_URL`**: in the Neon console, go to **Connect** and copy the **pooled** connection string. Its host contains `-pooler`.
  - Paste only the URL. Don't include the `psql '…'` command that Neon shows by default.
  - Migrations need Neon's *direct* connection. If you don't set `DIRECT_URL`, it's derived automatically by removing `-pooler` from this URL.
- **`BETTER_AUTH_SECRET`**: any long random string. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- **`BETTER_AUTH_URL`**: the address the app is opened at.

`.env.local` is git-ignored. Never commit it: it contains your database password.

### 4. Create the database tables

```bash
npm run db:migrate
```

### 5. Run

```bash
npm run dev
```

- This starts Vite on <http://localhost:5173> and the API on port 3001. Vite forwards `/api` requests to the API.
- Open the app and create an account on the sign-in page.
- Then go to **Timetable**: add your term, add your subjects, and click empty slots to add lessons.
- Stop both servers with **Ctrl+C**.

If port 5173 is already in use, Vite picks the next free one (5174, …). Sign-in still works there in development.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start frontend and API in watch mode |
| `npm run build` | Typecheck and build the frontend into `dist/` |
| `npm test` | Run unit tests once |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check, no output |
| `npm run db:migrate` | Create/apply migrations after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply existing migrations (production) |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run db:generate` | Regenerate the Prisma client |

## Project structure

```
api/index.ts            Vercel function entry: hands every /api/* request to the Hono app
server/
  app.ts                Hono app: auth handler, session check, routes, error handling
  auth.ts               Better Auth config
  dev.ts                Local API server (port 3001)
  routes/               subjects, terms + holidays, periods + lesson slots, settings, calendar
  lib/                  date/time conversion, response mapping, request validation
db/client.ts            Prisma client (Neon adapter)
prisma/
  schema.prisma         Database schema
  migrations/           SQL migrations
shared/                 Code used by both browser and server
  constants.ts          Event tags, subject colours
  schemas.ts            Zod input validation
  types.ts              API response types
  dates.ts              Date helpers on 'YYYY-MM-DD' strings
  occurrences.ts        Timetable → dated lessons (+ tests)
src/
  main.tsx              Routes
  components/           App shell + sidebar, time-grid Block, Popover, icons
  features/             auth, timetable, week, settings, terms
  lib/                  API client, data hooks, formatting, theme
  styles/               tokens.css (from Figma), base.css (shared UI styles)
```

## How it works

- **The timetable is a template.**
  - Each lesson is stored once as a weekly slot: weekday, start, end, room and term.
  - When a week is viewed, `GET /api/calendar?from=…&to=…` expands the slots into dated lessons with `expandLessons()` in `shared/occurrences.ts`. That's where holidays, term dates, and cancelled or changed single lessons are applied.
- **Dates and times are local.**
  - The API uses plain `'YYYY-MM-DD'` and `'HH:MM'` strings in the user's timezone. A 08:20 lesson stays at 08:20 when the clocks change.
  - Prisma's `Date` objects are converted at the edge, in `server/lib/datetime.ts`.
- **Periods** (the school's period times) only help the timetable editor place lessons. Lessons store real times, so editing period times doesn't move existing lessons.
- **Data isolation.**
  - Every route except `/api/health` and `/api/auth/*` requires a session.
  - Every database query is filtered by the signed-in user's id.
  - Updating or deleting someone else's row returns 404.

## Testing

```bash
npm test
```

The unit tests cover:
- turning the timetable into dated lessons: term boundaries, holidays, cancelled/changed lessons, the clock change
- the week-view layout: overlapping blocks, exams replacing lessons

## Deployment (Vercel)

Not deployed yet. The plan:

1. Import the repo in Vercel. It detects Vite and the function in `api/`; `vercel.json` sends `/api/*` to the function and everything else to the app.
2. Set `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (your Vercel URL) in the project's environment variables.
3. Run `npm run db:deploy` against the production database.

## Roadmap

- [x] Project setup, database schema, accounts
- [x] Subjects, terms, holidays, timetable editor, settings
- [x] Week view
- [x] Create and edit exams, tests and personal events; Today page; Exams page with countdowns
- [ ] Homework list
- [ ] Cancel or change a single lesson from the week view
- [ ] `.ics` import and export (Google / Apple Calendar)
- [ ] Mobile layout, month view, polish, deploy to Vercel
