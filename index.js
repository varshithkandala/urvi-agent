require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic();

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

app.post('/chat', async (req, res) => {
  const { message, history } = req.body;

  // Build the message list: prior turns (if the frontend sent any) plus
  // the new user message. This gives the assistant conversational memory.
  const messages = [
    ...(Array.isArray(history) ? history : []),
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

app.listen(3000, () => {
  console.log('Urvi Agent is running on port 3000');
});
