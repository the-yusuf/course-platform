# Course platform API

Backend for a Chinese language course platform. Admins publish courses with
ordered lessons, vocabulary (dictionaries), grammar and graded stories (HSK 1–6).
Students enroll, study lessons and leave reviews.

**Stack:** Node 24 · NestJS 12 (Express) · PostgreSQL 13+ · Kysely (type-safe SQL,
no ORM) · class-validator · argon2 · sharp · Vitest + Supertest.

---

## Getting started

```bash
npm install
cp .env.example .env            # then set DATABASE_URL and ACCESS_TOKEN_SECRET
createdb course-platform        # or create the database however you like
npm run db:migrate
npm run start:dev               # http://localhost:3000/api
```

**First admin.** No endpoint can create one, which is deliberate. Set `ADMIN_USERNAME`, `ADMIN_EMAIL` and
`ADMIN_PASSWORD` in `.env`, then run:

```bash
npm run db:seed
```

The seed is safe to run again. If the username already exists, that user is promoted to admin and keeps their
current password.

**API docs:** Swagger UI at <http://localhost:3000/api/docs>, and the OpenAPI JSON
at `/api/docs-json`. Both are disabled in production unless `SWAGGER_ENABLED=true`, which there
also requires `SWAGGER_USERNAME` and `SWAGGER_PASSWORD`. The browser then asks for that login
before showing the docs.

## Scripts

| Script | What it does |
|---|---|
| `npm run start:dev` | Start with watch mode |
| `npm run build` / `npm run start:prod` | Compile to `dist/` / run the compiled app |
| `npm test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (see [Testing](#testing)) |
| `npm run lint` / `npm run format` | oxlint / prettier |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:rollback` | Undo the last migration |
| `npm run db:status` | List migrations |
| `npm run db:seed` | Create/promote the admin from `ADMIN_*` |
| `npm run db:types` | Regenerate `src/database/db.types.ts` from the database |

The `db:*` scripts read `.env` themselves. Variables already set in your shell
win, e.g. `DATABASE_URL=… npm run db:migrate`.

## Configuration

Every variable is validated at startup ([env.validation.ts](src/config/env.validation.ts)).
The app refuses to start if a variable is missing or invalid. See [.env.example](.env.example).

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | **required** | `postgres://…` |
| `ACCESS_TOKEN_SECRET` | **required** | at least 32 characters |
| `NODE_ENV` | `development` | `production` hides Swagger and DB error details |
| `PORT` | `3000` | |
| `CORS_ORIGINS` | `http://localhost:5173` | comma-separated |
| `TRUST_PROXY` | unset | set behind a proxy, e.g. `1`, so rate limits see client IPs |
| `SWAGGER_ENABLED` | on outside production | in production, needs the login below |
| `SWAGGER_USERNAME` / `SWAGGER_PASSWORD` | unset | browser login for the docs; both or neither, password 12+ characters |
| `UPLOAD_DIR` | `uploads` | |
| `UPLOADS_BASE_URL` | `http://localhost:$PORT/uploads` | public base URL of uploaded files |
| `DB_POOL_MAX` | `10` | |
| `DB_STATEMENT_TIMEOUT_MS` | `10000` | |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | `60000` / `120` | per IP, per route |
| `THROTTLE_AUTH_LIMIT` | `10` | per IP, for login, register, refresh, logout and password change |
| `THROTTLE_LOGIN_USERNAME_LIMIT` / `…_TTL_MS` | `5` / 15 min | login attempts per username, then that username is blocked |
| `ADMIN_USERNAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | unset | read only by `db:seed` |

---

## API conventions

Every route is under **`/api`**. Uploaded files are served from **`/uploads`**.

### Responses

Success:
```json
{ "statusCode": 200, "message": "Success", "data": { } }
```
Lists are paginated with `?page=1&limit=20` (`limit` ≤ 100) and add `meta`:
```json
{ "statusCode": 200, "message": "Success", "data": [ ], "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 } }
```
Errors:
```json
{ "statusCode": 400, "message": ["username must be ..."], "error": "Bad Request", "data": null }
```
`message` is a list for validation errors and a string otherwise. `204 No Content`
responses have no body. Unknown body or query fields are rejected with `400`.

### Authentication

| Step | Endpoint | Notes |
|---|---|---|
| Register | `POST /api/auth/register` | creates a **student** |
| Log in | `POST /api/auth/login` | returns `{ user, access_token, refresh_token }` |
| Call the API | `Authorization: Bearer <access_token>` | the access token is a JWT valid for **1 hour** |
| Refresh | `POST /api/auth/refresh` `{ refresh_token }` | returns a **new pair**; no access token needed |
| Log out | `POST /api/auth/logout` `{ refresh_token }` | works after the access token has expired |

How sessions behave:
- **One session per user.** Logging in again ends the previous session.
- **Refresh tokens rotate on every use** and last 7 days. If a token is reused after it has
  been rotated, the server assumes it was stolen and ends the session.
- **Grace window:** for 10 seconds after a rotation, the previous token is still accepted.
  This covers two browser tabs refreshing at the same moment.
- **Password changes** end the user's session.

Rate limits respond with `429` and `Retry-After…` headers.
`@nestjs/throttler` adds the limiter's name to the header, for example `Retry-After-login-username`.

### Roles and content access

- **Public:** register, login, refresh, logout, health, the course list and course outline (lesson
  titles with no video links), and dictionary categories (free words only).
- **Students** need a login. Lessons and their words and grammar need an **enrollment** in that
  course. Words and grammar that aren't linked to a lesson are free.
- **Admins** can do everything. Enrollments are created by admins; students can list their own with
  `GET /api/enrollments/me`.

### Input rules

- Usernames are lowercased and must match `^[a-z0-9_.]{3,32}$`.
- Passwords must be 8–128 characters.
- Every text field has a maximum length.
- Lesson videos must be `https` URLs.

### Endpoints

| Area | Endpoints |
|---|---|
| Auth | `POST register, login, refresh, logout` · `GET me` · `PATCH me` · `PUT me/password` · `PUT me/avatar` |
| Users (admin) | `GET /users` · `GET/DELETE /users/:id` · `POST /users` · `PATCH :id/update-info` · `PUT :id/update-password` (reset) · `PUT :id/update-photo` |
| Courses | `GET /courses` · `GET /courses/:id` (public) · `POST/PATCH/DELETE` (admin) · `PUT /courses/:id/lessons/order` (admin) |
| Lessons | `GET /lessons` (admin) · `GET /lessons/:id` (enrolled) · `POST/PATCH/DELETE` (admin) |
| Vocabulary | `/dictionary-categories` (public reads) · `/dictionaries` · `/grammars` (reads: logged in, gated) |
| Stories | `/stories` (reads: logged in; writes: admin) |
| Enrollments | `/enrollments` (admin) · `GET /enrollments/me` |
| Reviews | `GET` (logged in) · `POST` (enrolled; author = you; one per course) · `PATCH` (author or admin) · `DELETE` (admin) |
| Health | `GET /health` (public, pings the DB) |

Swagger documents every request body and response.

### Uploads

`multipart/form-data` uploads: the user avatar goes in field `avatar`, and the course image in field `image`.
- **Accepted:** JPEG, PNG or WebP, up to 5 MB. The file type is checked from its bytes, not its name.
- **Stored as:** a re-encoded WebP with metadata stripped (512×512 for avatars, 1280×720 for course images).
- **Responses:** return the absolute URL of the stored file.

### Observability

- Every response carries an `X-Request-Id`. A safe incoming one, for example from nginx, is kept.
- Every request is logged on one line: method, path, status, duration, user and id.
- Server errors are logged with the same id.

---

## Testing

```bash
npm test            # unit tests
npm run test:e2e    # end-to-end tests
```

The e2e suite boots the real app and runs it against **its own throwaway database**, named after
the one in `DATABASE_URL` plus `-e2e`. It creates the database, migrates it, and drops it at the end,
so your dev data is never touched. The suite covers every endpoint, including auth edge cases,
role checks, content gating, uploads, rate limits, the response envelope and production behavior.

## Project layout

```
src/
  app.setup.ts          global prefix, pipes, helmet, CORS, static files, Swagger (shared with e2e)
  config/               env validation
  common/               envelope interceptor, exception filter, pagination, validators, helpers
  database/             Kysely setup, migrations, seeds, generated types
  auth/                 JWT + refresh sessions, guards, rate limiting
  storage/              image upload pipeline (validation, re-encoding, files)
  users/ courses/ lessons/ dictionary-categories/ dictionaries/ grammars/
  stories/ enrollments/ reviews/ health/
test/                   e2e specs + helpers
```

## Deployment

Production runs on one server with Docker Compose. nginx is installed on the server itself and adds HTTPS.
Every push to `main` is tested, built and deployed by GitHub Actions; the server never builds anything.

| File | What it is |
|---|---|
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | Tests every push and pull request; for `main`, builds the images, pushes them to ghcr.io and deploys |
| [Dockerfile](Dockerfile) | Builds the API image: compile, production dependencies only, runs as the `node` user |
| [compose.yaml](compose.yaml) | PostgreSQL 18, a one-off `migrate` step, and the API on `127.0.0.1:3000` |
| [.env.production.example](.env.production.example) | Template for the server's `.env` |
| [deploy/deploy.sh](deploy/deploy.sh) | Runs on the server: pulls one commit's images, migrates, restarts the API, checks its health |
| [deploy/cpu-check.sh](deploy/cpu-check.sh) | Runs sharp and argon2 from an image on an emulated copy of the server's CPU |
| [deploy/nginx/course-platform-api.conf](deploy/nginx/course-platform-api.conf) | nginx site for the API; certbot adds HTTPS to it |
| [deploy/backup.sh](deploy/backup.sh) | Daily database dump plus an uploads archive; keeps 14 days |

The database and uploaded images live in the Docker volumes `db-data` and `uploads`. Back them up with
`deploy/backup.sh`, and keep copies off the server.

### How a push reaches production

1. **test:** lint, format check, typecheck, build, unit and e2e tests (against a PostgreSQL 18 service).
2. **image** (in parallel): builds the API image and the `migrate` image (the Dockerfile's `build` stage),
   runs `deploy/cpu-check.sh`, and on `main` pushes both to `ghcr.io/the-yusuf/course-platform` tagged
   `api-<commit>` and `migrate-<commit>`.
3. **deploy** (`main` only, after both): SSH to the server, which runs `deploy/deploy.sh <commit>`, then a
   health check through `https://dili-chinese.uz`. About 3 seconds of downtime while the API restarts.

Pull requests run steps 1 and 2 without pushing. Runs for `main` wait for each other, so deploys
happen one at a time, in push order.

`deploy.sh` checks out the commit (the server's repo is left on a detached HEAD: `git status` shows
what is deployed), pulls its images and tags them `api-current` / `migrate-current`, which is what
`compose.yaml` runs. So a plain `docker compose up -d`, after editing `.env` for example, never builds.

### Everyday commands on the server

```bash
deploy/deploy.sh                                  # deploy the latest commit on main by hand
deploy/deploy.sh <commit>                         # deploy a given commit, e.g. to roll back
docker compose up -d                              # apply .env changes
docker compose run --rm migrate npm run db:seed   # first admin, from ADMIN_* in .env
docker compose logs -f api                        # follow the API logs
```

**Roll back** by re-running an older workflow run of `main` (Actions → the run → Re-run all jobs) or with
`deploy/deploy.sh <commit>`. Rolling back code doesn't roll back migrations, so the older code has to
work with the newer schema. Write migrations that add rather than remove.

**If GitHub is down**, `docker compose up -d --build` on the server still builds and starts the API there.

### Automatic deploys: one-time setup

1. Push. The first run tests, builds and pushes the images; the deploy job is skipped until step 5.
2. On GitHub, your profile → Packages → `course-platform` → Package settings → Change visibility → **Public**,
   so the server can pull without a login. (The image holds no secrets: `.dockerignore` keeps `.env` out.)
3. On the server:
   ```bash
   cd ~/course-platform && git pull                                 # brings deploy/deploy.sh
   docker image rm course-platform-api course-platform-migrate      # images it built itself before
   docker builder prune -af                                         # and their build cache
   ```
4. A deploy key that can only run the deploy script. On your laptop:
   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/dili-deploy -N '' -C github-deploy
   ```
   On the server, add one line to `~/.ssh/authorized_keys` with the contents of `~/.ssh/dili-deploy.pub`:
   ```
   restrict,command="/home/dili/course-platform/deploy/deploy.sh" ssh-ed25519 AAAA... github-deploy
   ```
   `restrict` turns off shells, port forwarding and the rest; `command` makes every login with this key
   run the deploy script, which only accepts a commit that is on `main`.
5. In the GitHub repo → Settings:
   - **Environments → New environment `production`**. Deployment branches: `main` only. Secrets:
     - `SSH_PRIVATE_KEY`: the contents of `~/.ssh/dili-deploy` (the file without `.pub`)
     - `SSH_KNOWN_HOSTS`: the output of `ssh-keyscan 5.182.26.33`. Compare its fingerprint
       (`ssh-keyscan 5.182.26.33 | ssh-keygen -lf -`) with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`
       on the server.
   - **Secrets and variables → Actions → Variables**: `DEPLOY_HOST` = `5.182.26.33`, `DEPLOY_USER` = `dili`,
     and `DEPLOY_PORT` only if SSH isn't on port 22 (then use `ssh-keyscan -p <port>` above).
6. Actions → CI/CD → **Run workflow** on `main`. From then on, every push to `main` deploys itself.

### The server's CPU

The image compiles libvips and sharp from source instead of using sharp's prebuilt binaries, which
need an x86-64-v2 CPU that some VPSs hide (e.g. "QEMU Virtual CPU version 2.5+"). CI checks every
image with `deploy/cpu-check.sh` before it ships. When you upgrade `sharp`, check its `config.libvips`
in `node_modules/sharp/package.json` and raise `VIPS_VERSION` in the Dockerfile to match.

## Database migrations

Migrations live in [src/database/migrations](src/database/migrations). Until the first production
deploy, the initial migration is edited directly. After that, every change must be a new migration
(`npm run db:make <name>`), never an edit to an applied one. Run `npm run db:types` after a schema change.
