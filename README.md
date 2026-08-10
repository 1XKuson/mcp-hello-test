# mcp-hello-test

Minimal MCP server built to be a deploy target for [OneClickMCP](https://github.com/1XKuson/oneclickmcp). It exists to exercise the deploy pipeline — clone, `docker build`, run, inject env, expose a port — not to do anything useful.

## Why it satisfies the deploy wizard

- `Dockerfile` at the repo root (the wizard blocks deploys without one)
- `.env.example` at the root, so the wizard prefills the env-var form
- listens on `0.0.0.0:$PORT`, default `3000` — matches the wizard's default internal port

## Transports

Both are served, so it works whichever one the console picks:

| Transport | Endpoint |
|---|---|
| SSE (legacy) | `GET /sse`, then `POST /messages?sessionId=...` |
| Streamable HTTP | `POST /mcp` (stateless) |

Also: `GET /health` → `{"status":"ok"}`, and `GET /` returns the endpoint map.

## Tools

| Tool | Args | Returns |
|---|---|---|
| `greet` | `name?` | `Hello, <name or $GREETING_NAME>!` |
| `add` | `a`, `b` | their sum |
| `whoami` | — | node version, port, uptime, and whether `DEMO_API_KEY` was injected |

`whoami` is the one that matters for testing: it confirms secrets actually reached the container without printing the secret itself.

## Env

| Var | Purpose |
|---|---|
| `GREETING_NAME` | fallback name for `greet` |
| `DEMO_API_KEY` | dummy secret — `whoami` reports whether it arrived |
| `PORT` | listen port, default `3000` |

## Run locally

```bash
npm install
GREETING_NAME=you DEMO_API_KEY=sk-test node server.js
```

```bash
docker build -t mcp-hello-test .
docker run --rm -p 3000:3000 -e DEMO_API_KEY=sk-test mcp-hello-test
```

Smoke test:

```bash
curl -s localhost:3000/health

curl -s -X POST localhost:3000/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
