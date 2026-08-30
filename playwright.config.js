// Minimal Playwright config for the chat-widget E2E suite.
// The frontend has no build step or dev server, so tests open
// frontend/index.html directly as a file:// URL (see e2e/chat-widget.spec.js) —
// no baseURL/webServer needed here.
module.exports = {
  testDir: './e2e',
  timeout: 15000,
  retries: 0,
  use: {
    headless: true,
    // The chat bubble has a continuous "float" animation, and the halo
    // behind it has a continuous pulse. Both are infinite, so the button
    // never stops moving. Playwright waits for an element to be "stable"
    // (not moving) before clicking, which an infinitely-animating element
    // never satisfies, causing every click to time out.
    //
    // The site's own CSS already has a prefers-reduced-motion rule that
    // turns these off (an existing accessibility feature), so this setting
    // just asks the test browser to report that preference as "on," which
    // the site already knows how to honor. No site code changes needed.
    reducedMotion: 'reduce',
  },
};