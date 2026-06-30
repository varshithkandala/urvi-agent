require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic();

app.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `You are a warm, helpful assistant for Urvi Montessori school. 
      You help parents with admission queries, school information, and any 
      questions they have. Always be friendly, patient and clear. 
      If you don't know something specific about the school, 
      say you'll connect them with a staff member.`,
      messages: [
        { role: 'user', content: message }
      ]
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