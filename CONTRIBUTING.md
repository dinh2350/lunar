# Contributing to Lunar

## Development Setup

1. Fork and clone the repo
2. `pnpm install`
3. `pnpm dev` — starts the gateway server

## Project Structure

```
packages/
  agent/     — Core agent engine
  memory/    — Vector + BM25 memory
  connectors/ — Telegram, Discord, WebChat
  tools/     — Built-in tools
  gateway/   — Fastify API server
  guardrails/ — Safety pipeline
apps/
  control/   — Next.js control panel
services/
  eval/      — Python evaluation suite
```

## Adding a New Tool

1. Create file in `packages/tools/src/`
2. Export tool definition with `name`, `description`, `parameters`, `execute`
3. Register in `packages/tools/src/index.ts`
4. Add tests in `packages/agent/src/__tests__/`

## Adding a New Channel

1. Create adapter in `packages/connectors/src/`
2. Implement the `ChannelAdapter` interface
3. Register in `packages/gateway/src/index.ts`

## Code Style

- TypeScript strict mode
- No `any` types where avoidable (use `unknown` + type guards)
- All public functions documented with JSDoc
- Tests for all new features

## Running Tests

```bash
pnpm test            # Run all tests
pnpm test:watch      # Watch mode
pnpm test:coverage   # With coverage report
```

## Commit Convention

```
feat: add vision analysis with Ollama
fix: handle timeout on large image uploads
refactor: extract memory service from agent
docs: add API reference for tool system
test: add integration tests for Telegram channel
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes, add tests
3. Run `pnpm ci` to verify everything passes
4. Submit pull request with clear description
