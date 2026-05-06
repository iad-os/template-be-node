# Development Guidelines

## After every development session

Always run the tests and verify that coverage reaches at least **80%**:

```bash
npm test -- --coverage
```

If coverage drops below 80% on branches, statements, or functions, the session is not complete: add the missing tests before considering the task done.

---

## API Documentation

When adding or modifying API endpoints, always update `docs/apis.http` accordingly:

- Add a new named request block (`# @name <operationName>`) for every new endpoint.
- Use the existing variables (`@apiUpstream`, `@accessToken`, etc.) rather than hardcoding values.
- Keep the file ordered logically (auth first, then endpoints grouped by resource).

---

## 12-Factor App

1. **Codebase** — one repo, multiple deployments.
2. **Dependencies** — all declared in `package.json`; no implicit system dependencies.
3. **Config** — zero hardcoded config. Use environment variables or `.mother-auditsrc.yml` loaded via `CONFIG_FILE`. No secrets in code.
4. **Backing services** — MongoDB and any external service are interchangeable resources via config.
5. **Build / Release / Run** — separate stages; never modify code at runtime.
6. **Processes** — stateless. No in-memory state shared between processes.
7. **Port binding** — the server exposes itself via `PORT`/`HOST_BINDING`.
8. **Concurrency** — scale by adding processes, not threads.
9. **Disposability** — fast startup, graceful shutdown.
10. **Dev/prod parity** — use the same Node and MongoDB versions locally and in production.
11. **Logs** — write to stdout/stderr (already handled by Pino). Never to files inside the container.
12. **Admin processes** — migrations and one-off scripts must run as separate processes.

---

## Clean Code (Uncle Bob)

- **Meaningful names** — variables, functions, and classes must say exactly what they do.
- **Small functions** — one function does one thing. If it exceeds ~20 lines, consider splitting it.
- **No obvious comments** — comment only the *why*, never the *what* (the code already says that).
- **DRY** — do not duplicate logic; extract shared functions or modules.
- **Single Responsibility** — every module/class has one reason to change.
- **Separate error handling** — do not mix business logic with try/catch; use the `errorHandler` registered on Fastify.
- **No magic numbers** — use named constants.
- **Readable tests** — every test name describes the expected behaviour, not the implementation.

---

## OWASP Top 10

1. **Broken Access Control** — always verify the `Authorization` header and `mother-subscription` before returning data. Never expose resources belonging to a different subscription.
2. **Cryptographic Failures** — never log tokens, passwords, or secrets. Use HTTPS in production.
3. **Injection** — never build MongoDB queries by concatenating strings; always use typed filter objects.
4. **Insecure Design** — validate input at the boundary (Zod on querystring, headers, params). Never trust unvalidated data.
5. **Security Misconfiguration** — no debug routes exposed in production. Swagger available only in `development`.
6. **Vulnerable Components** — update dependencies regularly; run `npm audit` before deploying.
7. **Authentication Failures** — every protected route requires a valid `Authorization: Bearer <token>`.
8. **Software and Data Integrity** — never deserialize unsigned payloads without verification.
9. **Logging & Monitoring** — log errors with context (request id, subscription id) but **never** personal data or full tokens.
10. **SSRF** — never fetch URLs supplied directly by the user without a whitelist.
