/*
  ═══════════════════════════════════════════════════════════════════
  URVI MONTESSORI — MOBILE FULL-SCREEN CHAT DEMO — JAVASCRIPT
  ═══════════════════════════════════════════════════════════════════

  This is a SEPARATE, simplified script from script.js (the floating
  widget). There is no open/close logic here at all — the chat is
  already "open" the moment the page loads, because the whole page
  IS the chat. A parent gets here by scanning a QR code on a print
  banner, so this file focuses on just the essentials:

    1. Grab references to the HTML elements we need
    2. Conversation history (sent to the backend so it remembers context)
    3. Add a message bubble to the screen (with Markdown for bot replies)
    4. Welcome message + the three big quick-reply chips
    5. Typing indicator (animated dots while we wait for a reply)
    6. Send a message to the backend and show its reply
    7. Initialise everything once the page has loaded

  BACKEND ENDPOINT:
    POST https://urvi-agent.onrender.com/chat
    Request body:  { "message": "user's text", "history": [ ...prior turns ] }
    Response body: { "reply": "bot's reply here" }

  This demo does NOT persist chat across reloads, and does NOT include
  image upload, sound, or "talk to a mentor" — those live only in the
  floating widget (script.js). Quick-reply chips here just send their
  label as a plain message; a real branching question-tree comes later.
  ═══════════════════════════════════════════════════════════════════
*/


/* ── 1. GRAB HTML ELEMENTS ──────────────────────────────────────── */
const messagesEl = document.getElementById('messages');   // Scrollable message list
const userInput  = document.getElementById('user-input'); // Text field
const sendBtn    = document.getElementById('send-btn');   // Round send button


/* ── BACKEND URL ────────────────────────────────────────────────── */
/* For local testing, change this to 'http://localhost:3000'. */
const BACKEND_URL = 'https://urvi-agent.onrender.com';


/* ── 2. CONVERSATION HISTORY ────────────────────────────────────── */
/*
  `conversation` is the running back-and-forth we send to the backend
  on every request so Urvija's replies stay context-aware. Each entry
  looks like { role: 'user' | 'assistant', content: '...' }.
*/
const conversation = [];


/* ── 3. ADD A MESSAGE BUBBLE TO THE SCREEN ──────────────────────── */
/*
  Creates a message row (wrapper + bubble) and appends it to the
  scrolling message list.

  text   — the string to show inside the bubble
  sender — 'bot', 'user', or 'error'

  Returns the created element, so callers (like the welcome message)
  can add extra content — e.g. quick-reply chips — inside the bubble.
*/
function addMessage(text, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender); // e.g. class="message bot"

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');

  if (sender === 'bot') {
    /*
      Bot replies may contain Markdown (**bold**, bullet lists, etc.)
      from the AI, so render it to HTML with `marked`, then clean that
      HTML with DOMPurify.sanitize() before inserting it — this strips
      anything unsafe (like a <script> tag) so a malicious reply could
      never execute code in the parent's browser.
    */
    bubble.innerHTML = DOMPurify.sanitize(marked.parse(text));
  } else {
    /*
      User input (and error notices) is NEVER parsed as Markdown/HTML.
      .textContent always shows the raw string as plain text, so this
      is what prevents XSS from anything a parent types.
    */
    bubble.textContent = text;
  }

  messageDiv.appendChild(bubble);
  messagesEl.appendChild(messageDiv);

  scrollToBottom();
  return messageDiv;
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}


/* ── 4. WELCOME MESSAGE + QUICK-REPLY CHIPS ─────────────────────── */
/*
  The very first thing a parent sees. It acknowledges they arrived via
  the banner/QR code, then offers three big, thumb-friendly chips so
  they can get started with a single tap instead of typing.
*/
const WELCOME_TEXT =
  "🌱 Hi, I'm Urvija! Thanks for scanning our banner and stopping by — " +
  "I'm the Urvi Montessori assistant, here to help with admissions, " +
  "our programs, and anything else you're curious about. " +
  "What can I help you with today?";

/*
  QUICK_REPLY_TOPICS — the three chips shown under the welcome message.
    label = what's printed on the chip
    query = the exact text sent as the user's message when tapped
  NOTE: for this demo, tapping a chip just sends its label as a normal
  chat message — a real branching question-tree comes later.
*/
const QUICK_REPLY_TOPICS = [
  { label: 'Enquiry / Admission Interest', query: 'Enquiry / Admission Interest' },
  { label: 'Our Programs',                 query: 'Our Programs' },
  { label: 'Other Queries',                query: 'Other Queries' },
];

/*
  makeChip(topic, chipsRow)
    Builds one tappable chip button.
    chipsRow — the chip container to remove once ANY chip is tapped,
               so a parent can't tap multiple starter chips by mistake.
*/
function makeChip(topic, chipsRow) {
  const chip = document.createElement('button');
  chip.classList.add('chip');
  chip.type = 'button';
  chip.textContent = topic.label;

  chip.addEventListener('click', function () {
    chipsRow.remove();          // Chips are a one-time starter menu
    sendMessageText(topic.query);
  });

  return chip;
}

function addWelcomeMessage() {
  const bubbleWrapper = addMessage(WELCOME_TEXT, 'bot');
  const bubble = bubbleWrapper.querySelector('.bubble');

  const chipsRow = document.createElement('div');
  chipsRow.classList.add('quick-reply-chips');
  QUICK_REPLY_TOPICS.forEach(function (topic) {
    chipsRow.appendChild(makeChip(topic, chipsRow));
  });

  // Chips live INSIDE the bubble, visually below the welcome text
  bubble.appendChild(chipsRow);
  scrollToBottom();
}


/* ── 5. TYPING INDICATOR ────────────────────────────────────────── */
/*
  While we wait for the backend to reply, show three animated bouncing
  dots so the parent knows Urvija is "thinking".
*/
let typingIndicatorEl = null;

function showTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', 'bot');

  const indicator = document.createElement('div');
  indicator.classList.add('typing-indicator');
  indicator.setAttribute('aria-label', 'Urvija is typing');

  // Three dot spans — CSS animates each with a staggered delay
  for (let i = 0; i < 3; i++) {
    indicator.appendChild(document.createElement('span'));
  }

  wrapper.appendChild(indicator);
  messagesEl.appendChild(wrapper);
  typingIndicatorEl = wrapper;
  scrollToBottom();
}

function hideTypingIndicator() {
  if (typingIndicatorEl) {
    typingIndicatorEl.remove();
    typingIndicatorEl = null;
  }
}


/* ── 6. SEND A MESSAGE ──────────────────────────────────────────── */
/*
  sendMessageText(text)
    The core sending function: shows the user's bubble, shows the
    typing dots, calls the backend, then shows the reply.

  sendMessage()
    Called by the send button / Enter key — reads the input field and
    hands its value to sendMessageText().
*/

// Prevents firing multiple requests at the same time
let isSending = false;

async function sendMessageText(text) {
  // Nothing to send, or already waiting for a reply
  if (!text || isSending) return;

  isSending = true;
  sendBtn.disabled = true;   // Gray out the send button visually
  userInput.value = '';      // Clear the input field

  addMessage(text, 'user');
  showTypingIndicator();

  /* ── FETCH REQUEST ───────────────────────────────────────────────
     fetch() sends an HTTP POST to the backend.
     async/await keeps this readable instead of nesting callbacks.
     try/catch handles the phone losing signal or the server being down.
  ─────────────────────────────────────────────────────────────────── */
  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // "I'm sending JSON"
      },
      // Send the new message plus the conversation so far, so the
      // backend can reply with full context (memory).
      body: JSON.stringify({ message: text, history: conversation }),
    });

    // response.ok is true for status codes 200–299
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    // Parse the JSON response — backend sends { "reply": "..." }
    const data = await response.json();

    hideTypingIndicator();
    addMessage(data.reply, 'bot');

    // Record this exchange so the NEXT request includes it as context
    conversation.push({ role: 'user', content: text });
    conversation.push({ role: 'assistant', content: data.reply });

  } catch (error) {
    // Network down, backend asleep/not running, or a 5xx error
    console.error('Chat error:', error);
    hideTypingIndicator();
    addMessage(
      "Sorry, I couldn't reach the server just now. Please check your " +
      "connection and try again in a moment.",
      'error'
    );
  } finally {
    // "finally" runs whether the request succeeded or failed
    isSending = false;
    sendBtn.disabled = false;
    userInput.focus(); // Ready for the next message
  }
}

function sendMessage() {
  const text = userInput.value.trim(); // .trim() removes leading/trailing spaces
  sendMessageText(text);
}


/* ── 7. INITIALISE ──────────────────────────────────────────────── */
/*
  Wait until the full HTML document is parsed before running setup —
  this guarantees every element above already exists.
*/
document.addEventListener('DOMContentLoaded', function () {

  // The chat is already "open" — show the welcome message immediately,
  // no floating bubble or greeting tooltips to wait for.
  addWelcomeMessage();

  // Send button (arrow) → send the typed message
  sendBtn.addEventListener('click', sendMessage);

  // Enter key inside the input → send the message
  userInput.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Stop any default form-submit behaviour
      sendMessage();
    }
  });

  // Focus the input on load so a parent can start typing right away
  // (skipped on touch devices, where auto-focusing would pop the
  // keyboard open immediately and cover the welcome message)
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (!isTouchDevice) {
    userInput.focus();
  }

});
