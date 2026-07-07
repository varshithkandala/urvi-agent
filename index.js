require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic();

// ── WALLET PROTECTION ─────────────────────────────────────────────
// Our /chat endpoint is public, and every request costs money (each one
// calls the paid Claude API). This limits how many messages a single
// visitor (by IP address) can send in a short window, so nobody can spam
// the endpoint and run up the bill. Normal parents will never hit this.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20,             // at most 20 messages per IP per minute
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

// Load the school knowledge base once at startup so the assistant can
// answer school-specific questions instead of deflecting everything.
const knowledge = fs.readFileSync(path.join(__dirname, 'knowledge.txt'), 'utf8');

const SYSTEM_PROMPT = `Your name is Urvija, which means 'child of the Earth' — the daughter of Urvi. You are the warm, patient digital assistant of Urvi Montessori, House of Children.
You help parents with admission queries, school information, and any
questions they have. Always be friendly, patient and clear.

Use the school information below to answer questions accurately. Only use
these facts — do not invent details. If a fact is missing or blank below,
or the question is about something not covered here, say you'll connect them
with a staff member rather than guessing.

--- SCHOOL INFORMATION ---
${knowledge}
--- END SCHOOL INFORMATION ---`;

app.post('/chat', chatLimiter, async (req, res) => {
  const { message, history } = req.body;

  // Basic guard: ignore empty or malformed requests before spending money
  // on an API call.
  if (typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Message is required.' });
  }

  // Build the message list: the most recent prior turns (capped above) plus
  // the new user message. This gives the assistant conversational memory
  // without re-sending the entire history every time.
  const priorTurns = Array.isArray(history)
    ? history.slice(-MAX_HISTORY_MESSAGES)
    : [];
  const messages = [
    ...priorTurns,
    { role: 'user', content: message },
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

app.listen(process.env.PORT || 3000, () => {
  console.log('Urvi Agent is running on port 3000');
});
