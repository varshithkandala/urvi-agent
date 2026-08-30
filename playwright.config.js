// Minimal Playwright config for the chat-widget E2E suite.
// The frontend has no build step or dev server, so tests open
// frontend/index.html directly as a file:// URL (see e2e/chat-widget.spec.js) —
// no `baseURL`/webServer needed here.
module.exports = {
  testDir: './e2e',
  timeout: 15000,
  retries: 0,
  use: {
    headless: true,
  },
};
