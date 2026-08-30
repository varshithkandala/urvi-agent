# Testing

Urvija now has two layers of automated tests, added on top of the existing
backend and frontend with no changes to the actual product behavior.

## 1. Backend API tests (`__tests__/api.test.js`)

**Stack:** Jest + Supertest
**Run:** `npm test`
**What it covers:** all 4 routes in `index.js` — `/health`, `/chat`,
`/mentor-request`, `/feedback` — including validation (missing/empty/
non-string message), the defensive "no text block in the model's reply"
path, and both the with-contact and no-contact branches of
`/mentor-request`.

**No real API calls, no real email, no real server port.** The Anthropic
SDK is replaced with a manual mock (`__mocks__/@anthropic-ai/sdk.js`) that
returns a scripted reply, and `nodemailer` is mocked the same way. `index.js`
was changed in one small way to make this possible: `app.listen()` is now
guarded behind `require.main === module`, and the app is exported
(`module.exports = app`). Running `node index.js` directly is completely
unaffected — only `require()`-ing the file for tests skips the real
`listen()` call.

Runs in CI on every push/PR via `.github/workflows/ci.yml`.

## 2. End-to-end tests (`e2e/chat-widget.spec.js`)

**Stack:** Playwright
**Run locally:**
```
npm install -D @playwright/test
npx playwright install --with-deps chromium
npx playwright test
```

**What it covers:** the actual chat widget in a real browser — opening/
closing the window, sending a message and seeing both the user bubble and
the reply appear, the input clearing after send, the empty-input guard,
the mentor button, and a network-failure path (server unreachable) to
confirm the widget degrades gracefully instead of hanging or going blank.

**The real backend is never called.** `page.route()` intercepts every
`fetch()` call to `https://urvi-agent.onrender.com/...` and returns a
scripted response, so these tests cost nothing, run offline, and never
depend on the real Claude model's output.

Not yet wired into CI — see the note at the bottom of `ci.yml`. Running
Playwright in CI needs an extra step (`npx playwright install`) to download
a real browser binary, which is a reasonable next addition once this is
in a normal (non-sandboxed) environment.

## Why mock instead of hitting the real API/backend?

- **Cost:** every real `/chat` call spends real Claude API credits.
- **Determinism:** model output isn't identical run to run; tests that
  assert on it would be flaky through no fault of the code.
- **Speed:** a mocked response returns instantly; a real one takes seconds.
- **No secrets needed:** these tests run with zero real credentials, so
  anyone can clone the repo and run the full suite immediately.
