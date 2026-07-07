/*
  ═══════════════════════════════════════════════════════════════════
  URVI MONTESSORI CHAT WIDGET — JAVASCRIPT
  ═══════════════════════════════════════════════════════════════════

  HOW THIS FILE IS ORGANIZED:
    1.  Grab references to all HTML elements we need
    2.  Conversation history array
    3.  Open / close the chat window
    4.  Greeting bubble logic (auto-pop + click / dismiss)
    5.  Image upload (paperclip button, preview, add image to chat)
    6.  Add a message bubble to the screen
    7.  Feedback buttons (thumbs up / down under bot messages)
    8.  Add the welcome message + quick-reply chips
    9.  Show / hide the animated typing indicator
    10. Core send function — fetches the backend and shows the reply
    11. Talk to Montessori Mentor button
    12. Utility: scroll to the bottom of the message area
    13. Initialise everything once the page has loaded

  BACKEND ENDPOINT:
    POST https://urvi-agent.onrender.com/chat
    Request body:  { "message": "user's text", "history": [ ...prior turns ] }
    Response body: { "reply": "bot's reply here" }

  The `history` array (see section 8) gives the assistant conversational
  memory. The backend keeps only the most recent turns, so the chat stays
  fast and affordable even in a long conversation.
  ═══════════════════════════════════════════════════════════════════
*/


/* ── 1. GRAB HTML ELEMENTS ──────────────────────────────────────── */
/*
  document.getElementById() finds an element by its id="..." attribute
  and gives us a JavaScript handle so we can read, write, and listen on it.
*/

const chatBubble      = document.getElementById('chat-bubble');        // Round floating button
const chatWindow      = document.getElementById('chat-window');        // The popup chat panel
const chatMessages    = document.getElementById('chat-messages');      // Scrollable message area
const userInput       = document.getElementById('user-input');         // Text input field
const sendBtn         = document.getElementById('send-btn');           // Arrow send button
const closeBtn        = document.getElementById('close-btn');          // X inside the header
const bubbleLogo      = document.getElementById('bubble-logo');        // School logo in the bubble
const bubbleIconClose = document.getElementById('bubble-icon-close'); // X icon in the bubble
const greetingBubbles = document.getElementById('greeting-bubbles');  // Container for greeting tips

// ── NEW: image upload elements ───────────────────────────────────
const imageBtn        = document.getElementById('image-btn');          // Paperclip button
const imageInput      = document.getElementById('image-input');        // Hidden <input type="file">
const imagePreviewBar = document.getElementById('image-preview-bar'); // Strip showing the thumbnail
const imageRemoveBtn  = document.getElementById('image-remove-btn');  // ✕ inside the preview strip

// ── NEW: mentor + feedback elements ─────────────────────────────
const mentorBtn       = document.getElementById('mentor-btn');         // "Talk to Mentor" button


/* ── BACKEND URL ────────────────────────────────────────────────── */
/*
  Base address of our server. All three endpoints live here:
    POST /chat            — send a message, get Urvija's reply
    POST /feedback        — record a 👍 / 👎 on a reply
    POST /mentor-request  — alert staff that a parent wants a real person
  For local testing, change this to 'http://localhost:3000'.
*/
const BACKEND_URL = 'https://urvi-agent.onrender.com';


/* ── 2. CONVERSATION HISTORY ────────────────────────────────────── */
/*
  The running conversation lives in the `conversation` array, declared in
  section 8 (right next to the send logic that fills and uses it). Each
  entry is { role: 'user' | 'assistant', content } and the array is sent to
  the backend on every request so the assistant remembers the context.
*/


/* ── 3. OPEN / CLOSE THE CHAT WINDOW ───────────────────────────── */

/*
  isOpen tracks whether the chat is currently visible.
  We start closed (false) so the widget is unobtrusive on page load.
*/
let isOpen = false;

function openChat() {
  isOpen = true;

  // Reveal the chat window (CSS transition handles the bounce animation)
  chatWindow.classList.remove('hidden');

  // Swap logo → X icon on the bubble button
  bubbleLogo.style.display      = 'none';
  bubbleIconClose.style.display = 'block';

  // Add .is-open so CSS pauses the float + ring animations on the bubble
  chatBubble.classList.add('is-open');
  chatBubble.setAttribute('aria-label', 'Close chat');

  // Dismiss any greeting tooltips (they've done their job)
  hideAllGreetings();

  // Focus the input so the user can start typing immediately
  // Small delay lets the CSS animation settle before we steal focus
  setTimeout(() => userInput.focus(), 60);
}

function closeChat() {
  isOpen = false;

  // Hide the chat window
  chatWindow.classList.add('hidden');

  // Swap X icon → logo on the bubble button
  bubbleLogo.style.display      = 'block';
  bubbleIconClose.style.display = 'none';

  // Re-enable the float + ring animations
  chatBubble.classList.remove('is-open');
  chatBubble.setAttribute('aria-label', 'Open chat');
}

function toggleChat() {
  if (isOpen) {
    closeChat();
  } else {
    openChat();
  }
}


/* ── 4. GREETING BUBBLES ────────────────────────────────────────── */
/*
  Two small speech-bubble tooltips pop up near the chat button after
  a short delay to invite the user to start a conversation.

  Behaviour:
    • Clicking the bubble text → opens the chat and sends that text
    • Clicking ✕             → dismisses just that bubble
    • Opening the chat        → dismisses all remaining bubbles
*/

/*
  Each entry matches an element id in the HTML and the text it shows.
  They appear bottom-to-top: greeting-1 first (closest to button),
  then greeting-2 (above it) 0.7 seconds later.
*/
const GREETINGS = [
  { id: 'greeting-1', text: 'Got a question? 🌱' },
  { id: 'greeting-2', text: 'Ask Urvija ✨' },
];

function showGreetings() {
  // Wait 1.5 s after page load before showing the first tooltip
  setTimeout(() => {
    const el1 = document.getElementById('greeting-1');
    if (el1) el1.classList.add('visible');

    // Second tooltip appears 0.7 s after the first
    setTimeout(() => {
      const el2 = document.getElementById('greeting-2');
      if (el2) el2.classList.add('visible');
    }, 700);
  }, 1500);
}

function hideAllGreetings() {
  GREETINGS.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('visible');
  });
  // Make the container invisible to screen readers too
  if (greetingBubbles) greetingBubbles.setAttribute('aria-hidden', 'true');
}

/*
  Wire up click handlers for each greeting bubble.
  We do this once here rather than inline in the HTML.
*/
GREETINGS.forEach(({ id, text }) => {
  const el = document.getElementById(id);
  if (!el) return;

  // Clicking the text part: open chat + send the greeting as a user message
  const textEl = el.querySelector('.greeting-text');
  if (textEl) {
    textEl.addEventListener('click', function () {
      hideAllGreetings();
      openChat();
      // sendMessageText is defined in section 8 below — call it after DOM init
      sendMessageText(text);
    });
  }

  // Clicking ✕: dismiss only this bubble, don't open the chat
  const closeX = el.querySelector('.greeting-close');
  if (closeX) {
    closeX.addEventListener('click', function (event) {
      // stopPropagation prevents the click from also triggering the text listener
      event.stopPropagation();
      el.classList.remove('visible');
    });
  }
});


/* ── 5. IMAGE UPLOAD ────────────────────────────────────────────── */
/*
  Flow:
    1. Parent clicks paperclip → hidden <input type="file"> opens
    2. Parent picks an image   → handleImageSelect reads it with FileReader
    3. showImagePreview()      → thumbnail appears above the input bar
    4. Parent clicks Send      → sendMessageText() calls addImageMessage()
                                 to show it in the chat, then clears the preview

  TODO (backend): To actually send the image to Claude Vision:
    In sendMessageText() below, include the image in the fetch body:
      body: JSON.stringify({ message: text, image: pendingImageDataUrl })
    Then in index.js read req.body.image and pass it to the Claude API
    using the "image" content block format:
      { type: "image", source: { type: "base64", media_type: "image/jpeg",
        data: req.body.image.split(',')[1] } }
    (The .split(',')[1] strips the "data:image/jpeg;base64," prefix)
*/

// Holds the base64 data URL of the selected image (null = no image pending)
let pendingImageDataUrl = null;

function handleImageSelect(event) {
  const file = event.target.files[0];
  if (!file) return; // User opened the picker then cancelled

  // FileReader converts the image file into a base64 "data URL" string
  // that browsers can display directly in an <img src="...">
  const reader = new FileReader();
  reader.onload = function (e) {
    pendingImageDataUrl = e.target.result; // Save the data URL
    showImagePreview(pendingImageDataUrl);
  };
  reader.readAsDataURL(file); // Start reading — triggers onload when done
}

function showImagePreview(dataUrl) {
  const thumb = document.getElementById('image-preview-thumb');
  thumb.src = dataUrl;
  // Adding "visible" triggers the CSS max-height transition (slides open)
  imagePreviewBar.classList.add('visible');
  // Mark the paperclip button so parents can see an image is attached
  imageBtn.classList.add('has-image');
  scrollToBottom();
}

function clearImagePreview() {
  imagePreviewBar.classList.remove('visible');
  imageBtn.classList.remove('has-image');
  document.getElementById('image-preview-thumb').src = '';
  pendingImageDataUrl = null;
  // Reset the file input so the same file can be reselected if needed
  imageInput.value = '';
}

/*
  Adds the chosen image as a user bubble on the right side of the chat.
  Called by sendMessageText() before sending the text message.
*/
function addImageMessage(dataUrl) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', 'user');

  const bubble = document.createElement('div');
  // "image-bubble" class reduces padding so the image sits flush
  bubble.classList.add('bubble', 'image-bubble');

  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = 'Image shared by parent';
  img.classList.add('chat-image');

  bubble.appendChild(img);

  const label = document.createElement('div');
  label.classList.add('message-label');
  label.textContent = 'You';

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(label);
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}


/* ── 6. ADD A MESSAGE BUBBLE TO THE SCREEN ──────────────────────── */
/*
  Creates a message row (wrapper + bubble + label) and appends it
  to the messages area.

  Parameters:
    text   — the string to show inside the bubble
    sender — 'bot', 'user', or 'error'

  Returns the created element (used by addWelcomeMessage to attach chips).
*/
function addMessage(text, sender) {
  // Outer wrapper: sets left/right alignment via CSS class
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender); // e.g. class="message bot"

  // Inner bubble: the coloured rounded box
  const bubble = document.createElement('div');
  bubble.classList.add('bubble');

  if (sender === 'bot') {
    /*
      Bot replies may contain Markdown (**bold**, *italics*, bullet lists)
      from the AI, so we render it to real HTML with `marked`.
      That HTML is then passed through DOMPurify.sanitize(), which strips
      anything unsafe (e.g. <script> tags, onclick handlers) before it's
      inserted — so even if the AI's reply ever contained malicious HTML,
      it can't execute.
    */
    bubble.innerHTML = DOMPurify.sanitize(marked.parse(text));
  } else {
    /*
      User input (and error notices) is NEVER parsed as Markdown/HTML.
      .textContent always displays the raw string as plain text, so a
      parent typing "<img onerror=...>" just sees that literal text —
      it can never be interpreted as HTML. This is what prevents XSS
      from user input.
    */
    bubble.textContent = text;
  }

  // Small label below the bubble: "You" or "Urvi"
  const label = document.createElement('div');
  label.classList.add('message-label');
  label.textContent = sender === 'user' ? 'You' : 'Urvija';

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(label);

  // Add thumbs-up / thumbs-down buttons under every real bot reply
  // (not for user messages, and not for error notices)
  if (sender === 'bot') {
    addFeedbackRow(messageDiv, text);
  }

  chatMessages.appendChild(messageDiv);

  scrollToBottom();
  return messageDiv; // Returned so the caller can append chips inside the bubble
}


/* ── 7. FEEDBACK BUTTONS (thumbs up / down) ─────────────────────── */
/*
  addFeedbackRow(messageDiv)
    Appends a small 👍 👎 row to the bottom of a bot message div.
    Clicking one button highlights it and locks both so you can only
    rate each message once.

  TODO (backend): When a parent rates a reply, send the rating to your
    backend so you can see which answers are helpful vs. confusing.
    Example endpoint: POST /feedback
    Body: { rating: "up" | "down", timestamp: "2024-..." }
    You could also include the bot's reply text so you know exactly
    which answer was rated. See the click handler below.
*/
function addFeedbackRow(messageDiv, replyText) {
  const row = document.createElement('div');
  row.classList.add('feedback-row');

  // Helper that makes one button and wires up its click logic
  function makeFeedbackBtn(emoji, ariaLabel, ratingValue) {
    const btn = document.createElement('button');
    btn.classList.add('feedback-btn');
    btn.setAttribute('aria-label', ariaLabel);
    btn.textContent = emoji;

    btn.addEventListener('click', function () {
      // Disable BOTH buttons so the parent can only rate once
      row.querySelectorAll('.feedback-btn').forEach(function (b) {
        b.disabled = true;
        b.classList.remove('selected');
      });
      // Highlight the button that was clicked
      btn.classList.add('selected');

      // Tell the backend how this reply was rated (and which reply it was)
      // so staff can see which answers are helpful vs. confusing.
      fetch(`${BACKEND_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: ratingValue,               // "up" or "down"
          reply: replyText,                  // the bot answer being rated
          timestamp: new Date().toISOString(),
        }),
      }).catch(function (err) {
        // Feedback is non-critical — never disrupt the chat if it fails
        console.error('Could not send feedback:', err);
      });
    });

    return btn;
  }

  row.appendChild(makeFeedbackBtn('👍', 'Mark as helpful',     'up'));
  row.appendChild(makeFeedbackBtn('👎', 'Mark as not helpful', 'down'));
  messageDiv.appendChild(row);
}


/* ── 8. WELCOME MESSAGE + QUICK-REPLY CHIPS ─────────────────────── */
/*
  The very first thing the user sees when the chat opens.
  Below the welcome text we add four chip buttons so the user can
  tap a common topic instantly instead of typing it.
*/

const WELCOME_TEXT =
  "Hi! I'm Urvija 🌱 — child of Urvi, here to help you with admissions, " +
  "fees, timings, or our programs. What would you like to know?";

// Four common topics — clicking one sends it as a message
const QUICK_REPLIES = ['Admissions', 'Fees', 'Timings', 'Visit the school'];

function addWelcomeMessage() {
  // Build the message row manually so we can inject chips inside the bubble
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', 'bot');

  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  bubble.textContent = WELCOME_TEXT;

  // Chip row below the welcome text
  const chipsRow = document.createElement('div');
  chipsRow.classList.add('quick-reply-chips');

  QUICK_REPLIES.forEach(function (label) {
    const chip = document.createElement('button');
    chip.classList.add('chip');
    chip.textContent = label;

    chip.addEventListener('click', function () {
      // Remove ALL chips so they can only be used once and don't clutter history
      chipsRow.remove();
      // Send the chip label as the user's message
      sendMessageText(label);
    });

    chipsRow.appendChild(chip);
  });

  // Append chips INSIDE the bubble (visually below the welcome text)
  bubble.appendChild(chipsRow);

  const labelEl = document.createElement('div');
  labelEl.classList.add('message-label');
  labelEl.textContent = 'Urvija';

  messageDiv.appendChild(bubble);
  messageDiv.appendChild(labelEl);
  chatMessages.appendChild(messageDiv);

  // The welcome text is UI-only — it is not added to `conversation`, since
  // the backend supplies its own greeting behaviour via the system prompt.

  scrollToBottom();
}


/* ── 7. TYPING INDICATOR ────────────────────────────────────────── */
/*
  While we wait for the backend to reply, show three animated bouncing
  dots so the user knows something is happening.
*/

// We keep a reference so hideTypingIndicator can find and remove it
let typingIndicatorEl = null;

function showTypingIndicator() {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', 'bot');
  wrapper.id = 'typing-wrapper';

  const indicator = document.createElement('div');
  indicator.classList.add('typing-indicator');
  indicator.setAttribute('aria-label', 'Urvi is typing');

  // Three dot spans — CSS animates each with a staggered delay
  for (let i = 0; i < 3; i++) {
    indicator.appendChild(document.createElement('span'));
  }

  wrapper.appendChild(indicator);
  chatMessages.appendChild(wrapper);
  typingIndicatorEl = wrapper;
  scrollToBottom();
}

function hideTypingIndicator() {
  if (typingIndicatorEl) {
    typingIndicatorEl.remove();
    typingIndicatorEl = null;
  }
}


/* ── 8. SEND A MESSAGE ──────────────────────────────────────────── */
/*
  sendMessageText(text)
    The core sending function. Takes a string, adds it as a user bubble,
    shows the typing indicator, calls the backend, then shows the reply.

  sendMessage()
    Called by the send button and Enter key. Just reads the input field
    and passes the value to sendMessageText().
*/

// Prevents firing multiple requests at the same time
let isSending = false;

/*
  conversation holds the running back-and-forth so the backend can give
  context-aware replies. Each entry is { role: 'user'|'assistant', content }.
*/
const conversation = [];

async function sendMessageText(text) {
  // Nothing to send, or already waiting for a reply
  if (!text || isSending) return;

  isSending = true;
  sendBtn.disabled = true;  // Gray out the send button visually
  userInput.value = '';     // Clear the input field

  // If a parent attached an image, show it in the chat first, then clear the
  // preview. We capture it into a local variable BEFORE clearing, because
  // clearImagePreview() resets pendingImageDataUrl to null — and we still
  // need to send the image to the backend below.
  const imageToSend = pendingImageDataUrl;
  if (pendingImageDataUrl) {
    addImageMessage(pendingImageDataUrl);
    clearImagePreview();
  }

  // Show the user's message on the right
  addMessage(text, 'user');

  // Show the three-dot animation while we wait
  showTypingIndicator();

  /* ── FETCH REQUEST ───────────────────────────────────────────────
     fetch() sends an HTTP POST to the backend.
     async/await makes the asynchronous call readable (no callback nesting).
     try/catch handles network errors gracefully.
  ─────────────────────────────────────────────────────────────────── */
  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // "I'm sending JSON"
      },
      // Send the new message, the conversation so far (for memory), and the
      // attached image if there is one (imageToSend is null when there isn't).
      body: JSON.stringify({ message: text, history: conversation, image: imageToSend }),
    });

    // response.ok is true for status codes 200–299
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    // Parse the JSON response — backend sends { "reply": "..." }
    const data = await response.json();

    hideTypingIndicator();
    addMessage(data.reply, 'bot');

    // Record this exchange so the next request includes it as context
    conversation.push({ role: 'user', content: text });
    conversation.push({ role: 'assistant', content: data.reply });

  } catch (error) {
    // Network down, backend not running, or a 5xx error
    console.error('Chat error:', error);
    hideTypingIndicator();
    addMessage(
      "Sorry, I couldn't reach the server right now. " +
      "Please make sure the backend is running (node index.js) and try again.",
      'error'
    );
  } finally {
    // "finally" runs whether the request succeeded or failed
    isSending = false;
    sendBtn.disabled = false;
    userInput.focus(); // Return focus to the input for the next message
  }
}

function sendMessage() {
  const text = userInput.value.trim(); // .trim() removes leading/trailing spaces
  sendMessageText(text);
}


/* ── 11. TALK TO MONTESSORI MENTOR ─────────────────────────────── */
/*
  When a parent clicks "Talk to a Montessori Mentor", we immediately
  show them a warm, reassuring message so they know help is coming.

  TODO (backend): After showing the message, also send a notification
    to your backend so staff know to follow up with this parent.
    Example:
      fetch('http://localhost:3000/mentor-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: conversation,   // Full context for the teacher
          timestamp: new Date().toISOString(),
        })
      });
    In index.js, create a POST /mentor-request route that logs this
    to a file, sends an email/Slack alert, or stores it in a database
    so a real teacher can see it and reach out to the parent.
*/
function handleMentorRequest() {
  const warmMessage =
    "Of course! 🌸 A real teacher or staff member from Urvi Montessori " +
    "will personally reach out to you very soon. " +
    "Please feel free to keep asking questions here in the meantime — " +
    "we're always happy to help!";

  addMessage(warmMessage, 'bot');

  // Notify staff so a real person can follow up. We send the conversation so
  // far so the teacher has full context before reaching out.
  fetch(`${BACKEND_URL}/mentor-request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation: conversation,          // full context for the teacher
      timestamp: new Date().toISOString(),
    }),
  }).catch(function (err) {
    console.error('Could not send mentor request:', err);
  });

  // Change the button to a confirmation state so parents can't click it twice
  if (mentorBtn) {
    mentorBtn.disabled = true;
    mentorBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" ' +
      'viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' +
      ' Request sent!';
  }
}


/* ── 12. SCROLL TO BOTTOM ───────────────────────────────────────── */
/*
  Sets the scroll position to the very bottom of the messages container
  so the newest message is always in view.
*/
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


/* ── 10. INITIALISE ─────────────────────────────────────────────── */
/*
  Wait until the full HTML document is parsed before running setup.
  This guarantees all elements exist when we try to reference them.
*/
document.addEventListener('DOMContentLoaded', function () {

  // Show the welcome message + quick-reply chips in the message area
  addWelcomeMessage();

  // After 1.5 s, pop up the two greeting tooltip bubbles
  showGreetings();

  /* ── EVENT LISTENERS ──────────────────────────────────────────── */

  // Floating bubble button → toggle the chat open/closed
  chatBubble.addEventListener('click', toggleChat);

  // X button inside the header → close the chat
  closeBtn.addEventListener('click', closeChat);

  // Send button (arrow) → send the typed message
  sendBtn.addEventListener('click', sendMessage);

  // Enter key inside the input → send the message
  userInput.addEventListener('keydown', function (event) {
    // Shift+Enter is a common shortcut for newlines — we ignore it here
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent any default form-submit behaviour
      sendMessage();
    }
  });

  // Click anywhere OUTSIDE the chat window and outside the bubble → close
  document.addEventListener('click', function (event) {
    const outsideWindow    = !chatWindow.contains(event.target);
    const outsideBubble    = !chatBubble.contains(event.target);
    const outsideGreetings = !greetingBubbles.contains(event.target);

    if (isOpen && outsideWindow && outsideBubble && outsideGreetings) {
      closeChat();
    }
  });

  /* ── NEW: image upload listeners ──────────────────────────────── */

  // Paperclip button click → open the hidden file picker
  if (imageBtn) {
    imageBtn.addEventListener('click', function () {
      imageInput.click(); // Programmatically opens the OS file picker
    });
  }

  // File picker change → parent selected (or deselected) a file
  if (imageInput) {
    imageInput.addEventListener('change', handleImageSelect);
  }

  // ✕ button in the preview strip → clear the selected image
  if (imageRemoveBtn) {
    imageRemoveBtn.addEventListener('click', clearImagePreview);
  }

  /* ── NEW: mentor button listener ──────────────────────────────── */

  if (mentorBtn) {
    mentorBtn.addEventListener('click', handleMentorRequest);
  }

});
