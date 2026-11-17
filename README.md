# API Security

This repository contains the two application parts used by the project:

- `Backend/` - the Express API and MongoDB storage layer.
- `Frontend/` - the Vite web application.

## Vercel

The repository root is configured for Vercel. Vercel builds `Frontend/` and
serves its generated `Frontend/dist/` output. Set `VITE_API_URL` in the
Vercel project environment to the deployed backend URL.

## Backend

Run backend commands from `Backend/`:

```powershell
npm install
npm run build
npm run lint
npm test
```

The backend requires `MONGODB_URI`; see `Backend/.env.example`.
