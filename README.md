# API Security Backend

Always-on Express API for the API Security Monitoring Platform.

## Local development

```bash
npm install
npm run dev
```

The API listens on `PORT` (default `3000`). Set `ALLOWED_ORIGINS` to a
comma-separated list of frontend origins, for example
`http://localhost:5173,https://dashboard.example.com`.

## Deployment

Build with `npm run build` and start with `npm start`. Railway and Render
provide `PORT`; configure `ALLOWED_ORIGINS`, `ADMIN_USER`, and a strong
`ADMIN_PASS`. Set `DATA_DIR` to the mounted persistent-volume path, such as
`/data`, and mount a persistent volume there.

Run a **single instance**. Threat counters and session tokens are held in
memory and are not coordinated between instances.

## Data

`rules.default.json` and `settings.default.json` seed missing files on first
boot. Runtime files are created under `DATA_DIR` and are intentionally not
tracked by Git.
