# Agent Bug Loop (Playwright + Artifacts)

This is the shared, single-source SOP for Claude/Codex to run a tight
**observe → reproduce → fix → verify** loop without manual clicking.

## Preconditions

- Base URL is stable (default `http://localhost:4280`).
- Use test credentials for authenticated flows.
- Keep runs deterministic: avoid manual data creation when possible.

## One-Loop SOP

1. **Reproduce (no patching before repro)**
   - Run the smallest failing test first.
   - Always set `BUG_ID` so artifacts are bundled.

   ```bash
   BUG_ID=123 pnpm test:e2e --project=chromium --grep "your test name"
   ```

2. **Observe (artifacts are source of truth)**
   - On failure, artifacts are copied to:

     ```
     artifacts/bug-123/<project>-<test>/
       console.log
       network.har
       trace.zip
       screenshot.png
       video.webm
       repro.md
     ```

   - Use `console.log` + `network.har` + `trace.zip` to pinpoint failures.

3. **Hypothesize + Fix**
   - Identify code location from stack traces / network failures.
   - Patch smallest surface area.
   - Add or tighten a test if regression risk exists.

4. **Verify**
   - Rerun the exact failing test.
   - Run a small smoke set if needed.

5. **Report**
   - Root cause (1–2 lines)
   - Fix summary
   - Verification commands + results
   - Link to artifacts folder (path)

## Playwright Defaults (Current Repo)

Configured in `playwright.config.ts`:

- `trace`:
  - `retain-on-failure` locally
  - `on-first-retry` in CI
  - override with `E2E_TRACE=on`
- `screenshot`: `only-on-failure`
- `video`: `retain-on-failure`
- `baseURL`: `E2E_BASE_URL || http://localhost:4280`

## Artifact Capture (Current Repo)

Implemented in `tests/e2e/fixtures/base.ts`:

- Console + page errors → `console.log`
- Network HAR → `network.har`
- Request failures appended to `console.log`
- On failure + `BUG_ID`, full output dir copied into `artifacts/bug-<id>/...`

## Auth For Tests

Authenticated tests reuse a saved storage state (auth bundle).
Global setup logs in once and writes `tests/e2e/.auth/user.json`.

Set before running authenticated tests:

```bash
E2E_TEST_EMAIL=... E2E_TEST_PASSWORD=... pnpm test:e2e
```

Tests skip gracefully if these are missing. To refresh auth state, re-run the
command (global setup overwrites the storage state each run).

## Optional: CDP MCP

The `chrome-devtools` MCP server is configured in `.mcp.json`.
Use it only when Playwright traces + HAR aren’t enough.

## Output Format For Agent Reports

- **Repro command**
- **Observed failure**
- **Evidence** (file:line or console/network snippet)
- **Root cause**
- **Fix**
- **Verification** (commands + results)
