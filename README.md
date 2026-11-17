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
Set `TRUST_PROXY_HOPS=0` for direct local development; the default `1`
expects one Railway/Render proxy hop.

## Deployment

Build with `npm run build` and start with `npm start`. Railway and Render
provide `PORT`; configure `ALLOWED_ORIGINS`, `ADMIN_USER`, and a strong
`ADMIN_PASS`. Set the required `MONGODB_URI` to your MongoDB Atlas connection string
(URL-encode special characters in the password). `DATA_DIR` is no longer used
for runtime storage; the default JSON files are read only to seed empty MongoDB
collections on first boot.

Run a **single instance**. Threat counters and session tokens are held in
memory and are not coordinated between instances.

## Data

`rules.default.json` and `settings.default.json` seed missing files on first
boot. Runtime files are created under `DATA_DIR` and are intentionally not
tracked by Git.
