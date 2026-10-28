# Contributing to StreamSync

Thanks for taking the time to contribute. This guide covers the development workflow, the checks every change should pass, and the conventions this repository follows.

## Getting set up

Follow [Getting started](README.md#getting-started) in the README to run the API and the client locally. The client's test runner needs Node.js 22.12 or newer.

## Workflow

1. Branch from `main` with a short, descriptive name, for example `fix/chat-rate-limit` or `feat/push-to-talk-hotkey`.
2. Keep each commit to one logical change. Keep unrelated refactors out of feature work.
3. Run the checks below and make sure they pass.
4. Open a pull request that explains what changed, why, and how you tested it. Include a screenshot for visible UI changes.

## Checks

Run these before you open a pull request:

```bash
cd server && npm test
cd ../client && npm run lint && npm run typecheck && npm test && npm run build
```

CI runs the same checks on Node.js 22.

## Code conventions

- **Formatting.** `.editorconfig` sets UTF-8, LF line endings, two-space indentation, and a final newline.
- **Server.** CommonJS modules. Keep HTTP handling in `src/routes/`, realtime handling in `src/socket/`, and persistence in `src/services/`. Validate every external input through `src/lib/validation.js` or the media parser, and report failures with `HttpError` and a stable `code`.
- **Client.** TypeScript in strict mode. Hooks own side effects and state; components render. Keep pure logic in `src/lib/` with its unit tests beside it.
- **Comments.** Explain why something is done, not what the code does.
- **Tests.** Add or update a test with every bug fix and every new socket event. Integration tests live in `server/test/integration/` and use an in-memory MongoDB.
- **Dependencies.** Keep runtime dependencies few. Explain any new dependency in the pull request.

## Commit messages

Write each commit message as one imperative sentence of 10 to 30 words that says what changed and why, for example:

> Validate room names on the server and cap them at 60 characters so long titles cannot break the room header

## Reporting security issues

Do not open a public issue for a vulnerability. Contact the maintainer privately first, and include enough detail to reproduce the problem.
