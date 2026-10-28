# Contributing to StreamSync

Thanks for taking the time to contribute. This guide covers the development workflow, the checks every change should pass, and the conventions this repository follows.

## Getting set up

Follow [Getting started](README.md#getting-started) in the README. In short: enable Corepack, run `pnpm install` at the repository root, copy `apps/api/.env.example` to `apps/api/.env`, and run `pnpm dev`. Node.js 22.12 or newer is required.

## Workflow

1. Branch from `main` with a short, descriptive name, for example `fix/chat-rate-limit` or `feat/push-to-talk-hotkey`.
2. Keep each commit to one logical change. Keep unrelated refactors out of feature work.
3. Run the checks below and make sure they pass.
4. Open a pull request that explains what changed, why, and how you tested it. Include a screenshot for visible UI changes.

## Checks

Run this from the repository root before you open a pull request:

```bash
pnpm check
```

`pnpm check` runs the build, the type checks, ESLint, and the tests, in that order. CI runs the same steps on Node.js 22 with `pnpm install --frozen-lockfile`, and it also builds both container images.

## Repository layout

- `apps/api` is the REST and Socket.IO server.
- `apps/web` is the React client.
- `packages/shared` is the contract both sides compile against: REST shapes, realtime event types, error codes, and limits.

A change that touches the wire format starts in `packages/shared/src`, and both apps are updated to match.

## Code conventions

- **Formatting.** `.editorconfig` sets UTF-8, LF line endings, two-space indentation, and a final newline. `.gitattributes` keeps line endings LF in the repository on every platform.
- **Modules.** Every package is TypeScript with native ES modules (`"type": "module"`). Local imports in the API use the compiled file name, for example `import { loadConfig } from './config.js'`.
- **API structure.** Feature code lives in `apps/api/src/modules/<feature>/`: the model, the service that talks to the database, and the routes. Socket handling lives in `apps/api/src/realtime/`, HTTP plumbing (error handling, authentication middleware, the `HttpError` type) in `apps/api/src/http/`, and pure helpers in `apps/api/src/lib/`.
- **Input and errors.** Validate every external input through `apps/api/src/lib/validation.ts` or the media parser, and report failures with `HttpError` and a code from `ERROR_CODES` in `@streamsync/shared`.
- **Client structure.** Hooks own side effects and state, and components render. Pure logic lives in `apps/web/src/lib/` with its unit tests beside it. Realtime calls use the typed socket in `lib/socket.ts`, so event names and payloads are checked against the contract.
- **Comments.** Explain why something is done, not what the code does.
- **Tests.** Add or update a test with every bug fix and every new socket event. API integration tests live in `apps/api/test/integration/` and use an in-memory MongoDB.
- **Dependencies.** Add a dependency to the package that uses it, for example `pnpm --filter @streamsync/api add <name>`, and commit the updated `pnpm-lock.yaml` with the change. Keep runtime dependencies few, and explain any new one in the pull request.
- **Build scripts.** Packages may run install scripts only when they are listed under `allowBuilds` in `pnpm-workspace.yaml`. Add an entry only with a reason in the pull request.

## Commit messages

Write each commit message as one imperative sentence of 10 to 30 words that says what changed and why, for example:

> Validate room names on the server and cap them at 60 characters so long titles cannot break the room header

## Reporting security issues

Do not open a public issue for a vulnerability. Contact the maintainer privately first, and include enough detail to reproduce the problem.
