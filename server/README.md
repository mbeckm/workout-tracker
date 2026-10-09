# trim-api

Trim's one server function (decision 88): `POST /api/import-plan` reads a pasted plan or plan
screenshots with Claude Haiku 5.5 and returns its structure. It stores and logs nothing.

- Vercel project `trim-api` (team `mbeckms-projects`), region fra1. Deploy: `vercel deploy --prod`.
- Env: `ANTHROPIC_API_KEY` (Production). Set a monthly spend limit on the key's workspace in the
  Anthropic Console.
- Rate limit: a Vercel Firewall rule on `/api/import-plan` (per IP).
- `catalog-names.json` is generated from the app's catalog: `cd ../mobile && npx tsx scripts/export-catalog-names.ts`.
- The app reads `EXPO_PUBLIC_IMPORT_API_URL` (default `https://trim-api-five.vercel.app`) and falls back
  to reading on the phone when this endpoint fails.
