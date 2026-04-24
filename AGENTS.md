# Agents Guide

## Quick Commands

```bash
npm run start    # Start server (default port 3000)
npm run dev      # Development mode with nodemon
npm test        # Run test.js (tests song ID 557583842)
npx . --help    # Show CLI help
```

## Architecture

- **Entry**: `index.js` - Express server + CLI launcher
- **Core logic**: `src/match.js` - loads modules dynamically from `modules/`
- **Modules**: `modules/*.js` - one file per music source (6 active modules)
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
- Otherwise → iterate all modules in directory order, return first successful URL

## Adding a New Module

1. Create `modules/<name>.js`
2. Export async function that takes song ID string, returns URL string or null
3. It auto-registers at runtime (no import needed)

## Deployment

- **Vercel**: Uses `vercel.json` (configured, pushes directly)
- **Standalone**: Any Node.js host, `npm start`

## Dependencies

- `pnpm` preferred (lockfile exists)
- Key dependency: `@unblockneteasemusic/server` (the core unm library)

## No Formal Config

- No ESLint, Prettier, TypeScript, or CI workflows
- No pre-commit hooks