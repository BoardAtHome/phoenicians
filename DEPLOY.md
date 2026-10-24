# Deploying Phoenicians

The whole app runs on [Render](https://render.com) as one web service plus one
Postgres database, both described in `render.yaml`. Setting it up takes about
15 minutes, most of it waiting for the first build.

Render facts below were checked against Render's docs on 24 October 2026
([free tier](https://render.com/docs/free), [Blueprint spec](https://render.com/docs/blueprint-spec),
[pricing](https://render.com/pricing)). Dashboard labels change from time to time.

## 1. Create the service

1. Sign up at [render.com](https://render.com), ideally with **Sign in with GitHub**.
2. In the dashboard choose **New > Blueprint**.
3. Connect GitHub if asked, and give Render access to `BoardAtHome/phoenicians`.
4. Pick the repository and the `main` branch. Render reads `render.yaml` and lists
   a web service `phoenicians` and a database `phoenicians-db`.
5. Render asks for `ADMIN_PASSWORD`. Choose the shared password for the admin page
   and keep it somewhere safe. It is only asked for here; change it later under the
   service's **Environment** tab.
6. Apply the Blueprint. The first build takes a few minutes. Follow it under the
   service's **Logs**; it is ready when the log shows `Phoenicians 0.x.0 listening`.

## 2. Check it works

1. Open the service URL shown at the top of the service page, something like
   `https://phoenicians-xxxx.onrender.com`.
2. **Changelog** should list v1, the baseline config.
3. **Admin** should unlock with your password.
4. Start a test game, copy the invite link and open it in a private window to
   claim a second seat.

## 3. Before the first playtest

- Curse copies in the baseline are 2 each as a placeholder. Set them in
  **Admin > Config > Curses**, save with a note, and **Publish**. New games use the
  published version; games already running keep the version they started on.
- To try changes first, tick **Test the unpublished draft config** when creating a game.
- After each session, **Admin > Matches and stats** has each game's stats and
  downloads. **Download all games (CSV)** gives one row per game for comparing versions.

## 4. Costs and the free tier

| | Free | Paid |
| --- | --- | --- |
| Web service | $0. Sleeps after 15 minutes with no visitors and takes about a minute to wake. 750 hours a month, enough for one service running all month. | $7/month (0.5 CPU, 512 MB). Never sleeps. |
| Postgres | $0, but **deleted 30 days after creation** (plus 14 days to upgrade), 1 GB, no backups. | About $6/month (0.1 CPU, 256 MB, 1 GB storage included, more at $0.30/GB). Kept for as long as it is paid for. |

The Hobby workspace has no monthly fee, so you pay only for the services.

**Recommendation:** upgrade the database before day 30, or you lose every config
version and game record. In the dashboard open `phoenicians-db` and change its
instance type to the smallest paid one. The web service can stay free: the first
visitor after a quiet spell waits about a minute while it wakes, and during play
the open game connections keep it awake.

## 5. Releasing updates

Merging a pull request into `main` runs the tests on GitHub Actions. Render deploys
only once those checks pass (`autoDeployTrigger: checksPass` in `render.yaml`).
Watch progress under the service's **Events** and **Logs**.

A deploy restarts the server:

- Games are saved in Postgres and carry on. Players may need to reload the page.
- Admin logins end, so log in again.
- The admin **Undo last action** history starts empty again.

Deploy between sessions when you can. If an update misbehaves, open the service's
**Events**, find the previous deploy and choose **Rollback**. That rolls back the code only.
Config versions live in the database and are changed from the admin page.

## 6. Changing settings

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Unlocks the admin page. If unset, admin is disabled. |
| `DATABASE_URL` | Set by the Blueprint from `phoenicians-db`. Without it, everything is in memory and lost on restart. |
| `NODE_VERSION` | 22. |
| `PORT` | Set by Render. |
| `BUILD_VERSION` | Optional. Defaults to the version in `package.json`. |

Change them under the service's **Environment** tab. Saving restarts the service.

A custom domain (for example `phoenicians.yourfamily.com`) can be added under the
service's **Settings > Custom Domains**. Render shows the DNS record to create.

## 7. Troubleshooting

| What you see | Likely cause |
| --- | --- |
| Page loads slowly or shows Render's loading screen | The free service is waking up. Wait about a minute. |
| Admin says the password is wrong for everyone | `ADMIN_PASSWORD` was not set or has a typo. Check the **Environment** tab. |
| Configs or games vanish after a restart | `DATABASE_URL` is missing, or the free database expired. |
| Build fails | Open the failed deploy's log. Usually it's a failing check or dependency install; the same commit should also be red in GitHub Actions. |
| A game is stuck | **Admin > Matches and stats > Open**, then **Undo last action** or **End match**. Players see the change at once. |

## Running locally

```sh
npm install
ADMIN_PASSWORD=secret npm run dev   # server on :8000, app on http://localhost:5173
npm test
```
