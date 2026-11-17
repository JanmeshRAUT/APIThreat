# API Security Frontend

Static React dashboard for the API Security Monitoring Platform.

## Local development

```bash
npm install
npm run dev
```

With `VITE_API_URL` unset, Vite proxies `/api` requests to
`http://localhost:3000`. For a separate backend, set `VITE_API_URL` to its
origin.

## Vercel deployment

Use the Vite framework preset, `npm run build` as the build command, and
`dist` as the output directory. Set `VITE_API_URL` to the deployed backend
origin and add that frontend origin to the backend's `ALLOWED_ORIGINS`.

The following types are duplicated and must be kept synchronized manually:
`ThreatSeverity`, `ThreatStatus`, `ThreatRule`, `ThreatRecord`,
`FeatureRow`, `LabelSource`, `FeatureWindowSize`, `PlatformSettings`, and
`AlertHistoryEntry` in `src/types/threats.ts`, plus their backend counterparts
in `server/types.ts`.
