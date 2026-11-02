# OEMS — deployment-ready frontend + backend

This repository contains the React/Vite frontend and the Express/PostgreSQL API. It does not use Supabase.

## Architecture

- Frontend: GitHub Pages at `https://tarakadidata-wq.github.io/rere/`
- API: Render Web Service (`backend/`)
- Database: Render PostgreSQL
- Authentication: API-issued JWTs, bcrypt password hashes, admin/student roles

## Deploy the backend (Render)

1. Push this entire project folder to the GitHub repository.
2. In Render, choose **New → Blueprint** and select the repository containing `render.yaml`.
3. Render will propose a PostgreSQL database and API service. Review the plan and pricing before creating them.
4. Set the required `ADMIN_PASSWORD` environment variable to a unique password of at least 12 characters. Do not commit it. You may optionally set `GEMINI_API_KEY` for AI PDF question extraction.
5. Apply the Blueprint. The `preDeployCommand` initializes the schema and creates the first administrator.
6. After deployment, open `https://YOUR-API.onrender.com/health`. It should return a healthy status.

If you use a separate database provider, set `DATABASE_URL` and `DATABASE_SSL` in the Render service environment instead of the Blueprint database.

## Deploy the frontend (GitHub Pages)

1. In the GitHub repository, open **Settings → Pages** and choose **GitHub Actions** as the source.
2. The workflow defaults to `https://oems-api.onrender.com`, matching the Render service in `render.yaml`. If your Render service has a different URL, open **Settings → Secrets and variables → Actions → Variables** and create/update `VITE_API_URL` with the API origin only (no `/api` suffix and no trailing slash).
3. Confirm the repository is named `rere` and the Vite base path is `/rere/` in `vite.config.ts`.
4. Push to `main` or `master`, or run the workflow manually from **Actions**.
5. Visit `https://tarakadidata-wq.github.io/rere/`.

## Run locally

Requirements: Node.js 20+ and a PostgreSQL database.

Frontend terminal:

```bash
npm install
# create .env and set VITE_API_URL=http://localhost:10000
npm run dev
```

Backend terminal:

```bash
cd backend
npm install
# copy .env.example to .env and set DATABASE_URL, JWT_SECRET (32+ chars),
# ADMIN_USERNAME and ADMIN_PASSWORD (12+ chars), CORS_ORIGINS
npm run db:init
npm run dev
```

## First login

Use the administrator username and password configured as `ADMIN_USERNAME` and `ADMIN_PASSWORD` in Render. Create student accounts from the administrator dashboard; each student should receive a unique username/ID and a strong initial password. Demo plaintext passwords from the old local-only sample data are not imported.

## Security notes

- Never put `DATABASE_URL`, `JWT_SECRET`, `ADMIN_PASSWORD`, or `GEMINI_API_KEY` in frontend variables or GitHub source.
- `VITE_API_URL` is public and is only the API address.
- CORS allows the GitHub Pages origin and local development. If you use a custom domain, update `CORS_ORIGINS`.
- Use HTTPS, keep dependencies updated, configure database backups, and test exam timing, account recovery, and restore procedures before conducting a high-stakes exam.
- The API enforces roles and grades submitted objective answers server-side. Essay/short-answer grading still requires a human review workflow.

## API health check

`GET /health`


## Existing browser-only data

The old GitHub Pages build stored records in each browser under `oems_data_v1`. The new PostgreSQL deployment does not automatically merge that browser-only data into the server database. Do not clear browser storage or uninstall the old browser profile until any records that must be retained have been exported and migrated. New records created after the API deployment are stored centrally in PostgreSQL.
