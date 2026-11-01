# Agents Guide

## Quick Commands

```bash
npm run start    # Start server (default port 3000)
npm run dev      # Development mode with nodemon
npm test        # Run test.js (tests song ID 557583842)
npm run test:unit  # Run hermetic unit tests (node --test test/*.test.js)
npx . --help    # Show CLI help
```

## Architecture

- **Entry**: `index.js` - Express server + CLI launcher
- **Core logic**: `src/match.js` - loads modules dynamically from `modules/`
- **Modules**: `modules/*.js` - one file per music source (7 active modules)
- **Logger**: `src/logger.js` - custom colored console logger

## Module System

`modules/` directory auto-discovers `.js` files at runtime. Each module must export:
- A single async function, OR
- An object with a method matching the filename

Example structure (from `modules/unm.js`):
```javascript
module.exports = {
    async unm(id) {
        // returns URL string or null
    }
}
```

Matching logic (`src/match.js`):
- If `source` param provided → use that specific module
- Otherwise → start all modules concurrently (at most one request per module; currently ≤7 in flight), then return the first successful URL in directory (priority) order; the winner aborts the remaining in-flight requests
- Every module call is capped by `UNBLOCK_MODULE_TIMEOUT_MS` (default 5000ms, env override, clamped to 100–30000ms, read lazily so `.env` works); failures/timeouts resolve to `null` and are skipped
- A hanging *high-priority* source still occupies the priority slot, so worst-case latency ≈ the timeout budget (not the sum of module latencies, and not instant)
- `unm` cannot use axios timeout/AbortSignal (it is backed by `@unblockneteasemusic/server`): it has its own unref'd deadline and is not truly cancellable

## Adding a New Module

1. Create `modules/<name>.js`
2. Export async function `(id, options = {})` that takes the song ID string, returns URL string or null,
   and passes `options.signal` (an `AbortSignal`) plus `timeout: getUnblockModuleTimeoutMs()` to every
   outgoing request — see any module under `modules/` for the pattern
3. It auto-registers at runtime (no import needed)

## Deployment

- **Vercel**: Uses `vercel.json` (configured, pushes directly)
- **Standalone**: Any Node.js host, `npm start`

## Dependencies

- `pnpm` preferred (lockfile exists)
- Key dependency: `@unblockneteasemusic/server` (the core unm library)

## No Formal Config

- No ESLint, Prettier, TypeScript
- CI: `.github/workflows/test.yml` runs the hermetic unit tests (`node --test test/`);
  `.github/workflows/publish.yml` publishes to npm when `package.json` version changes
- No pre-commit hooks