require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
// Allow larger bodies so parents can attach photos (base64 images are bulky).
app.use(express.json({ limit: '10mb' }));

const client = new Anthropic();

// ── WALLET PROTECTION ─────────────────────────────────────────────
// Our endpoints are public, and every /chat request costs money (it calls
// the paid Claude API). This limits how many requests a single visitor (by
// IP address) can make in a short window, so nobody can spam us and run up
// the bill. Normal parents will never hit this. The same limiter is shared
// across all three routes below.
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20,             // at most 20 requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You are sending messages too quickly. Please wait a moment and try again.' },
});

// ── MEMORY CAP ────────────────────────────────────────────────────
// The frontend sends the whole conversation so the assistant remembers
// context. But re-sending a very long chat every time is slow and costly,
// so we only keep the most recent messages. 20 messages ≈ the last 10
// back-and-forth exchanges — plenty of context to stay coherent.
const MAX_HISTORY_MESSAGES = 20;

// ── EMAIL (staff notifications) ───────────────────────────────────
// Used to alert the school when a parent asks to talk to a mentor, or
// rates a reply. Credentials come from environment variables (.env locally,
// or the Render dashboard in production) so no secrets live in the code:
//   EMAIL_USER  — the Gmail address that sends the alerts
//   EMAIL_PASS  — a Gmail "App Password" (NOT the normal login password)
//   STAFF_EMAIL — where alerts are delivered (defaults to the school inbox)
const STAFF_EMAIL = process.env.STAFF_EMAIL || 'urvimontessorischool@gmail.com';

const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Sends an email to the staff inbox. If email isn't configured yet, we just
// log a warning instead of crashing — so the chatbot keeps working even
// before the email credentials are set up.
async function sendStaffEmail(subject, text) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[email] Not configured (EMAIL_USER/EMAIL_PASS missing) — skipping. Subject:', subject);
    return;
  }
  await mailTransporter.sendMail({
    from: `"Urvija — Urvi Montessori" <${process.env.EMAIL_USER}>`,
    to: STAFF_EMAIL,
    subject,
    text,
  });
}

// Turns the conversation array into a readable transcript for the email.
function formatConversation(conversation) {
  if (!Array.isArray(conversation) || conversation.length === 0) {
    return '(no messages yet)';
  }
  return conversation
    .map((m) => `${m.role === 'user' ? 'Parent' : 'Urvija'}: ${m.content}`)
    .join('\n\n');
}

// Load the school knowledge base once at startup so the assistant can
// answer school-specific questions instead of deflecting everything.
const knowledge = fs.readFileSync(path.join(__dirname, 'knowledge.txt'), 'utf8');

const SYSTEM_PROMPT = `Your name is Urvija, which means 'child of the Earth' — the daughter of Urvi. You are the warm, patient digital assistant of Urvi Montessori, House of Children.
You help parents with admission queries, school information, and any
questions they have. Always be friendly, patient and clear.

Talk like a warm front-desk conversation, not an information brochure.
Keep your replies short and warm — usually just a few sentences. Answer the
specific question the parent actually asked; don't dump every related detail
at once. When it feels natural, gently offer a follow-up rather than
over-explaining (for example, "Would you like to know about our timings
too?"). Let the parent lead, and share more only when they ask for it.

Use the school information below to answer questions accurately. Only use
these facts — do not invent details. If a fact is missing or blank below,
or the question is about something not covered here, say you'll connect them
with a staff member rather than guessing.

--- SCHOOL INFORMATION ---
${knowledge}
--- END SCHOOL INFORMATION ---`;

// ── CHAT ──────────────────────────────────────────────────────────
app.post('/chat', limiter, async (req, res) => {
  const { message, history, image } = req.body;

  // Basic guard: ignore empty or malformed requests before spending money
  // on an API call.
  if (typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // If a parent attached an image, send it to Claude alongside their text so
  // Urvija can actually "see" and answer about it. The frontend sends the
  // image as a data URL like "data:image/jpeg;base64,...."; we split that
  // into the media type and the raw base64 data the API expects.
  let userContent = message;
  if (typeof image === 'string' && image.startsWith('data:')) {
    const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (match) {
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } },
        { type: 'text', text: message },
      ];
    }
  }

  // Build the message list: the most recent prior turns (capped above) plus
  // the new user message. This gives the assistant conversational memory
  // without re-sending the entire history every time.
  const priorTurns = Array.isArray(history)
    ? history.slice(-MAX_HISTORY_MESSAGES)
    : [];
  const messages = [
    ...priorTurns,
    { role: 'user', content: userContent },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    res.json({ reply: response.content[0].text });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

// ── TALK TO A MENTOR ──────────────────────────────────────────────
// A parent asked to speak with a real person. Email the staff with the
// conversation so far so a teacher has full context before reaching out.
app.post('/mentor-request', limiter, async (req, res) => {
  const { conversation, timestamp } = req.body;

  try {
    await sendStaffEmail(
      'A parent would like to talk to a mentor',
      `A parent clicked "Talk to a Montessori Mentor" on ${timestamp || new Date().toISOString()}.\n\n` +
        `Please reach out to them soon. Here is their conversation with Urvija so far:\n\n` +
        `${formatConversation(conversation)}`
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('mentor-request failed:', error);
    res.status(500).json({ error: 'Could not send the request.' });
  }
});

// ── FEEDBACK (thumbs up / down) ───────────────────────────────────
// A parent rated one of Urvija's replies. Log it and email the staff so
// they can see which answers are helpful vs. confusing and improve the
// knowledge base over time.
app.post('/feedback', limiter, async (req, res) => {
  const { rating, reply, timestamp } = req.body;
  const label = rating === 'up' ? '👍 Helpful' : rating === 'down' ? '👎 Not helpful' : String(rating);

  console.log('[feedback]', label, '| reply:', reply);

  try {
    await sendStaffEmail(
      `Chat feedback: ${label}`,
      `A parent rated one of Urvija's replies as "${label}" on ${timestamp || new Date().toISOString()}.\n\n` +
        `The reply they rated was:\n\n${reply || '(not provided)'}`
    );
  } catch (error) {
    // Feedback is non-critical — never fail the request over it.
    console.error('feedback email failed:', error);
  }

  res.json({ ok: true });
});

app.listen(process.env.PORT || 3000, () => {
  console.log('Urvi Agent is running on port 3000');
});
