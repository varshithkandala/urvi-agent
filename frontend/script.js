/*
  ═══════════════════════════════════════════════════════════════════
  URVI MONTESSORI CHAT WIDGET — JAVASCRIPT
  ═══════════════════════════════════════════════════════════════════

  HOW THIS FILE IS ORGANIZED:
    1. Grab references to all the HTML elements we'll need
    2. Set up the opening welcome message
    3. Functions for toggling the chat open/closed
    4. Function to add a message bubble to the screen
    5. Function to show/hide the typing indicator
    6. Function to send a message to the backend and show the reply
    7. Event listeners (wire up clicks and keypresses)

  BACKEND ENDPOINT:
    POST http://localhost:3000/chat
    Request body:  { "message": "user's text here" }
    Response body: { "reply": "bot's response here" }
  ═══════════════════════════════════════════════════════════════════
*/


/* ── 1. GRAB HTML ELEMENTS ──────────────────────────────────────── */
/*
  document.getElementById() finds an element in the HTML by its id="..."
  attribute and gives us a JavaScript reference to it so we can
  read from it, write to it, or listen for clicks on it.
*/

const chatBubble      = document.getElementById('chat-bubble');       // The floating round button
const chatWindow      = document.getElementById('chat-window');       // The chat popup window
const chatMessages    = document.getElementById('chat-messages');     // The scrollable message area
const userInput       = document.getElementById('user-input');        // The text input field
const sendBtn         = document.getElementById('send-btn');          // The send (arrow) button
const closeBtn        = document.getElementById('close-btn');         // The X button inside the header
const bubbleIconOpen  = document.getElementById('bubble-icon-open');  // Chat icon on the bubble
const bubbleIconClose = document.getElementById('bubble-icon-close'); // X icon on the bubble (when open)


/* ── 2. WELCOME MESSAGE ─────────────────────────────────────────── */
/*
  This is the first message the user sees when they open the chat.
  We add it to the screen as soon as the page loads using addMessage().
  (addMessage is defined in section 4 below.)
*/

const WELCOME_MESSAGE =
  "Hi there! I'm here to help with anything about Urvi Montessori — " +
  "admissions, fees, timings, or our programs. What can I help with?";

// Wait until the HTML document is fully loaded before running our setup code
document.addEventListener('DOMContentLoaded', function () {
  // Show the welcome message as a bot message (not user-sent)
  addMessage(WELCOME_MESSAGE, 'bot');
});


/* ── 3. OPEN / CLOSE THE CHAT WINDOW ───────────────────────────── */

/*
  isOpen tracks whether the chat window is currently visible.
  We start it as false (chat is closed on page load).
*/
let isOpen = false;

/*
  openChat() — makes the chat window visible.
  It removes the "hidden" CSS class (which hides the window with opacity:0).
  Then it flips the bubble icons and moves focus into the input field.
*/
function openChat() {
  isOpen = true;
  chatWindow.classList.remove('hidden');  // Remove the hidden class → window appears
  bubbleIconOpen.style.display  = 'none'; // Hide the chat icon
  bubbleIconClose.style.display = '';     // Show the X icon on the bubble
  userInput.focus();                      // Auto-focus so user can type right away
}

/*
  closeChat() — hides the chat window.
  Adding the "hidden" class triggers the CSS fade-out animation.
*/
function closeChat() {
  isOpen = false;
  chatWindow.classList.add('hidden');     // Add hidden class → window fades out
  bubbleIconOpen.style.display  = '';    // Show the chat icon again
  bubbleIconClose.style.display = 'none'; // Hide the X icon
}

/*
  toggleChat() — called when the bubble button is clicked.
  If the chat is open, close it. If it's closed, open it.
*/
function toggleChat() {
  if (isOpen) {
    closeChat();
  } else {
    openChat();
  }
}


/* ── 4. ADD A MESSAGE BUBBLE TO THE SCREEN ──────────────────────── */
/*
  addMessage(text, sender) creates a new message bubble and appends
  it to the chat messages area.

  Parameters:
    text   — the string of text to display inside the bubble
    sender — either 'bot', 'user', or 'error' (controls styling and label)

  This function:
    1. Creates a wrapper <div class="message bot/user">
    2. Creates the bubble <div class="bubble"> with the text inside
    3. Creates a small label ("Urvi" or "You") below the bubble
    4. Appends everything to the messages container
    5. Scrolls the container down so the new message is always visible
*/
function addMessage(text, sender) {
  // Create the outer wrapper div
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender); // e.g. class="message bot"

  // Create the bubble div that contains the message text
  const bubble = document.createElement('div');
  bubble.classList.add('bubble');
  bubble.textContent = text; // .textContent is safe — it won't execute any HTML/scripts

  // Create the small label below the bubble
  const label = document.createElement('div');
  label.classList.add('message-label');
  if (sender === 'user') {
    label.textContent = 'You';
  } else {
    label.textContent = 'Urvi'; // The bot's friendly name
  }

  // Assemble: put the bubble and label inside the message wrapper
  messageDiv.appendChild(bubble);
  messageDiv.appendChild(label);

  // Add the completed message div to the messages area
  chatMessages.appendChild(messageDiv);

  // Scroll to the bottom so the newest message is always in view
  scrollToBottom();

  // Return the messageDiv in case we want to reference it later
  return messageDiv;
}


/* ── 5. TYPING INDICATOR ────────────────────────────────────────── */
/*
  While we're waiting for the backend to respond, we show three
  animated bouncing dots so the user knows something is happening.

  showTypingIndicator() — creates and displays the dots
  hideTypingIndicator() — removes them
*/

let typingIndicatorEl = null; // Will hold a reference to the indicator element

function showTypingIndicator() {
  // Build the indicator: a wrapper div with three <span> dots inside
  const wrapper = document.createElement('div');
  wrapper.classList.add('message', 'bot'); // Same layout as a bot message
  wrapper.id = 'typing-wrapper';           // Give it an id so we can find and remove it

  const indicator = document.createElement('div');
  indicator.classList.add('typing-indicator');

  // Create three dots
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    indicator.appendChild(dot);
  }

  wrapper.appendChild(indicator);
  chatMessages.appendChild(wrapper);

  typingIndicatorEl = wrapper; // Save the reference so hideTypingIndicator can remove it
  scrollToBottom();
}

function hideTypingIndicator() {
  // If the indicator exists in the DOM, remove it
  if (typingIndicatorEl) {
    typingIndicatorEl.remove();
    typingIndicatorEl = null; // Clear the reference
  }
}


/* ── 6. SEND MESSAGE TO THE BACKEND ────────────────────────────── */
/*
  sendMessage() is the main function that:
    a) Reads the user's text from the input field
    b) Displays it as a user message bubble
    c) Shows the typing indicator
    d) Sends the text to our Node.js backend using fetch()
    e) When the reply arrives, hides the indicator and shows the bot reply
    f) If something goes wrong (e.g. backend is off), shows an error message

  fetch() is a built-in browser function for making HTTP requests.
  It is "asynchronous" — it doesn't freeze the page while waiting for
  the server to respond. We use async/await to write it in a readable way.
*/

// "let isSending" prevents the user from firing multiple requests at once
let isSending = false;

/*
  conversation holds the running back-and-forth so the backend can give
  context-aware replies. Each entry is { role: 'user'|'assistant', content }.
  We send this array with every request and append the bot's reply to it.
*/
const conversation = [];

async function sendMessage() {
  // Read the text from the input and remove extra spaces from the ends
  const text = userInput.value.trim();

  // Don't send if the input is empty or we're already waiting for a reply
  if (!text || isSending) return;

  // Lock: prevent sending another message while this one is in flight
  isSending = true;
  sendBtn.disabled = true; // Gray out the send button visually

  // Clear the input field so it's ready for the next message
  userInput.value = '';

  // Show the user's message on the right side of the chat
  addMessage(text, 'user');

  // Show the three-dot typing animation while we wait for the backend
  showTypingIndicator();

  // ── FETCH REQUEST ──────────────────────────────────────────────
  /*
    We wrap everything in try/catch.
    "try" runs the network request.
    "catch" handles any errors (e.g. the server is offline).
  */
  try {
    /*
      fetch() sends an HTTP POST request to the backend.
      - method: 'POST'      → tells the server we're sending data
      - headers             → tells the server the body is JSON
      - body                → the actual data, converted to a JSON string
    */
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',  // "I'm sending you JSON"
      },
      // Send the new message plus the conversation so far (for memory)
      body: JSON.stringify({ message: text, history: conversation }),
    });

    /*
      response.ok is true if the server replied with a 200–299 status code.
      If it's false (e.g. 500 Internal Server Error), we throw an error
      so the catch block handles it.
    */
    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    /*
      response.json() reads the response body and parses it from a JSON string
      back into a JavaScript object.
      The backend sends: { "reply": "some text here" }
      So data.reply gives us that text.
    */
    const data = await response.json();
    const botReply = data.reply;

    // Remove the typing indicator now that we have the real answer
    hideTypingIndicator();

    // Display the bot's reply on the left side of the chat
    addMessage(botReply, 'bot');

    // Record this exchange so the next request includes it as context
    conversation.push({ role: 'user', content: text });
    conversation.push({ role: 'assistant', content: botReply });

  } catch (error) {
    /*
      Something went wrong — network is down, backend is not running,
      or the server returned an error status. Show a friendly message.
    */
    console.error('Chat error:', error); // Log the technical error for debugging

    hideTypingIndicator();

    // Show the error as a special error-styled message bubble
    addMessage(
      "Sorry, I couldn't connect to the server right now. " +
      "Please make sure the backend is running and try again.",
      'error'
    );
  } finally {
    /*
      "finally" runs whether the request succeeded OR failed.
      Unlock so the user can send another message.
    */
    isSending = false;
    sendBtn.disabled = false;
    userInput.focus(); // Return focus to the input field for convenience
  }
}


/* ── 7. SCROLL TO BOTTOM ────────────────────────────────────────── */
/*
  scrollTop controls how far the container is scrolled.
  Setting it to scrollHeight (the full height of all content)
  scrolls all the way to the bottom — so the newest message is visible.
*/
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}


/* ── 8. EVENT LISTENERS ─────────────────────────────────────────── */
/*
  Event listeners tell the browser: "when THIS thing happens,
  call THAT function."

  We attach them all here at the bottom so the functions above
  are already defined by the time we reference them.
*/

// Clicking the round bubble button opens or closes the chat
chatBubble.addEventListener('click', toggleChat);

// Clicking the X button inside the header closes the chat
closeBtn.addEventListener('click', closeChat);

// Clicking the send (arrow) button sends the message
sendBtn.addEventListener('click', sendMessage);

/*
  Listen for keypresses inside the input field.
  If the user presses "Enter" (and NOT Shift+Enter), send the message.
  Shift+Enter would normally be used for a new line, but since this is
  a single-line input, we just send on plain Enter.
*/
userInput.addEventListener('keydown', function (event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault(); // Stop the default browser behavior (e.g. form submit)
    sendMessage();
  }
});

/*
  Close the chat if the user clicks anywhere OUTSIDE the chat window
  and outside the bubble button.
  This is optional but a nice UX touch.
*/
document.addEventListener('click', function (event) {
  // event.target is the element that was actually clicked
  const clickedOutsideWindow = !chatWindow.contains(event.target);
  const clickedOutsideBubble = !chatBubble.contains(event.target);

  if (isOpen && clickedOutsideWindow && clickedOutsideBubble) {
    closeChat();
  }
});
