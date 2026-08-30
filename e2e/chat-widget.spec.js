/**
 * End-to-end tests for the Urvija chat widget (frontend/index.html).
 *
 * These drive a real browser against the actual frontend markup and
 * verify what a parent visiting the site actually experiences: opening
 * the widget, sending a message, seeing a reply, and reaching a mentor.
 *
 * The real backend (https://urvi-agent.onrender.com) is intentionally
 * NEVER called here — script.js's fetch() calls are intercepted with
 * page.route() and given scripted responses. This keeps tests fast,
 * free (no Claude API spend), deterministic (not dependent on model
 * output), and runnable with no real backend or credentials at all.
 *
 * Run locally with:
 *   npm install -D @playwright/test
 *   npx playwright install --with-deps chromium
 *   npx playwright test
 *
 * (Requires downloading a Chromium binary — not runnable in network-
 * restricted sandboxes; verify these against real Playwright locally.)
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

// The frontend is static HTML/CSS/JS with no build step, so tests just
// open the file directly rather than running a dev server.
const FRONTEND_PATH = 'file://' + path.resolve(__dirname, '../frontend/index.html');

// Every test starts from a clean page load with the backend fully mocked,
// so no test can accidentally depend on network access or a previous
// test's state.
test.beforeEach(async ({ page }) => {
  await page.route('https://urvi-agent.onrender.com/chat', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'Thanks for reaching out! Our admissions start in the fall.' }),
    });
  });

  await page.route('https://urvi-agent.onrender.com/mentor-request', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route('https://urvi-agent.onrender.com/feedback', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.goto(FRONTEND_PATH);

  // The chat bubble has a continuous "float" animation, and its halo has
  // a continuous pulse — both infinite, so the button never stops moving.
  // Playwright waits for an element to be "stable" before clicking, which
  // an infinitely-animating element never satisfies. addStyleTag runs
  // after the page is fully loaded, so there's no race with page parsing.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
      }
    `,
  });
});

test('chat window is hidden until the bubble is clicked', async ({ page }) => {
  await expect(page.locator('#chat-window')).toHaveClass(/hidden/);

  await page.locator('#chat-bubble').click();

  await expect(page.locator('#chat-window')).not.toHaveClass(/hidden/);
});

test('sending a message shows both the user bubble and the reply', async ({ page }) => {
  await page.locator('#chat-bubble').click();

  await page.locator('#user-input').fill('What are your admission timings?');
  await page.locator('#send-btn').click();

  // The user's own message should appear in the log immediately.
  await expect(page.locator('#chat-messages')).toContainText('What are your admission timings?');

  // The mocked backend reply should appear once the request resolves.
  await expect(page.locator('#chat-messages')).toContainText(
    'Thanks for reaching out! Our admissions start in the fall.'
  );
});

test('the input clears after a message is sent', async ({ page }) => {
  await page.locator('#chat-bubble').click();

  const input = page.locator('#user-input');
  await input.fill('Hello there');
  await page.locator('#send-btn').click();

  await expect(input).toHaveValue('');
});

test('clicking send with an empty input does not add an empty bubble', async ({ page }) => {
  await page.locator('#chat-bubble').click();

  const messagesBefore = await page.locator('#chat-messages').innerHTML();
  await page.locator('#send-btn').click();
  const messagesAfter = await page.locator('#chat-messages').innerHTML();

  expect(messagesAfter).toBe(messagesBefore);
});

test('the close button hides the chat window again', async ({ page }) => {
  await page.locator('#chat-bubble').click();
  await expect(page.locator('#chat-window')).not.toHaveClass(/hidden/);

  await page.locator('#close-btn').click();

  await expect(page.locator('#chat-window')).toHaveClass(/hidden/);
});

test('the mentor button is reachable and clickable from the footer', async ({ page }) => {
  await page.locator('#chat-bubble').click();

  const mentorBtn = page.locator('#mentor-btn');
  await expect(mentorBtn).toBeVisible();
  await mentorBtn.click();
  // A confirmation/reassurance message should appear in the chat log
  // after clicking — asserting broadly here since the exact copy is a
  // product/UX detail that may change independently of this test's intent.
  await expect(page.locator('#chat-messages')).not.toBeEmpty();
});

test('a network failure on /chat surfaces gracefully, not a blank screen', async ({ page }) => {
  // Override the happy-path mock from beforeEach with a failure for this
  // one test, to verify the widget doesn't just hang or crash silently
  // when the backend is unreachable.
  await page.route('https://urvi-agent.onrender.com/chat', (route) => {
    route.abort('failed');
  });

  await page.locator('#chat-bubble').click();
  await page.locator('#user-input').fill('Hello');
  await page.locator('#send-btn').click();

  // The chat window itself should still be open and usable, not crashed.
  await expect(page.locator('#chat-window')).not.toHaveClass(/hidden/);
  // script.js shows this specific reassurance/error text on a network
  // failure (see the catch block in sendMessageText) — asserting on it
  // confirms the widget degrades gracefully instead of just going quiet.
  await expect(page.locator('#chat-messages')).toContainText(
    "Sorry, I couldn't reach the server right now."
  );
});
