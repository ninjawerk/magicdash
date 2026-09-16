# CLAUDE.md

Read `AGENTS.md` first — it explains the architecture, the plugin contract and the conventions. Key points:

- **Plugins** live in `plugins/<id>/` with `manifest.ts` (shared, no React/Node imports), `client.tsx`, optional `server.ts`.
  Scaffold with `npm run new-plugin <id> "Name"`. Full guide: `docs/PLUGINS.md`, tutorial: `docs/PLUGIN-TUTORIAL.md`.
- **The SDK is the contract**: `src/sdk/types.ts`, `src/sdk/client.ts`, `src/sdk/server.ts`. Changing them affects every plugin.
- **Settings UI is generated** from the manifest (`SchemaForm`). Don't hand-build settings forms in plugins.
- **Theme tokens** (`--accent --fg --cool --warm --surface`) instead of hard-coded colours; `text-white/NN` follows the theme.
- **Verify** with `npm run typecheck`, `curl` against `localhost:3210/api/...`, and the browser at `localhost:5173`.
- **Commits**: no Co-Authored-By or other attribution trailers. Never commit directly to `main`; branch + PR.
- **Auth**: state-changing API routes need a session/token (`server/auth.ts` allowlist). When testing with curl, log in first
  (`POST /api/auth/login`, cookie jar) or pass `Authorization: Bearer <token>`.
- After adding a bundled plugin, add its id to `BUNDLED_PLUGINS` in `server/install.ts` and a row in the README plugin table.
