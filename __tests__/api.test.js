/**
 * API tests for the Urvija backend (index.js).
 *
 * Uses supertest to send real HTTP requests to the Express app in-process
 * (no real server binding, no real network). The Anthropic SDK is mocked
 * (see __mocks__/@anthropic-ai/sdk.js) so these tests never call the real,
 * paid Claude API — they only verify our own request handling, validation,
 * and error paths.
 *
 * nodemailer is mocked too, since we don't want tests to actually attempt
 * sending real email, and CI won't have real EMAIL_USER/EMAIL_PASS anyway.
 */

jest.mock('@anthropic-ai/sdk');
jest.mock('nodemailer');

// index.js only calls mailTransporter.sendMail() when both env vars are
// set; without them it logs a warning and returns early. Set fake values
// here (before requiring index.js) so the mentor-request email path is
// actually exercised, instead of always taking the "not configured" branch.
process.env.EMAIL_USER = 'test-sender@example.com';
process.env.EMAIL_PASS = 'test-app-password';

const nodemailer = require('nodemailer');
const sendMailMock = jest.fn().mockResolvedValue(true);
nodemailer.createTransport = jest.fn(() => ({ sendMail: sendMailMock }));

const request = require('supertest');
const app = require('../index');

describe('GET /health', () => {
  it('returns ok: true with no side effects', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('POST /chat', () => {
  it('returns a reply for a valid message', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ message: 'What are your admission timings?', history: [] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ reply: 'This is a mocked Urvija reply.' });
  });

  it('rejects a missing message with 400, before calling the API', async () => {
    const res = await request(app).post('/chat').send({ history: [] });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Message is required.' });
  });

  it('rejects an empty/whitespace-only message with 400', async () => {
    const res = await request(app).post('/chat').send({ message: '   ' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Message is required.' });
  });

  it('rejects a non-string message with 400 (e.g. a number)', async () => {
    const res = await request(app).post('/chat').send({ message: 12345 });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Message is required.' });
  });

  it('still returns a reply when history is missing entirely', async () => {
    // history is optional on the wire; the handler falls back to [] rather
    // than throwing when it's absent.
    const res = await request(app).post('/chat').send({ message: 'Hello' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('This is a mocked Urvija reply.');
  });

  it('returns 502 with a clean error if the model reply has no text block', async () => {
    // Force the next call on the shared mocked client to return a response
    // with no text content block, exercising index.js's defensive check
    // (`if (!textBlock || !textBlock.text)`) instead of assuming
    // content[0] is always text.
    const Anthropic = require('@anthropic-ai/sdk');
    Anthropic.__mockCreate.mockResolvedValueOnce({ content: [{ type: 'image' }] });

    const res = await request(app).post('/chat').send({ message: 'Hello' });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Something went wrong' });
  });
});

describe('POST /mentor-request', () => {
  it('accepts a request with contact details and emails staff', async () => {
    const res = await request(app).post('/mentor-request').send({
      name: 'Priya Shah',
      phone: '555-0100',
      email: 'priya@example.com',
      conversation: [{ role: 'user', content: 'Hi' }],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(sendMailMock).toHaveBeenCalled();
  });

  it('accepts a request with no contact details at all', async () => {
    const res = await request(app).post('/mentor-request').send({
      conversation: [],
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('POST /feedback', () => {
  it('accepts a thumbs-up rating', async () => {
    const res = await request(app)
      .post('/feedback')
      .send({ rating: 'up', reply: 'Some reply text' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('accepts a thumbs-down rating and still returns ok', async () => {
    const res = await request(app)
      .post('/feedback')
      .send({ rating: 'down', reply: 'Some reply text' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('never fails the request even if the rating value is unexpected', async () => {
    const res = await request(app)
      .post('/feedback')
      .send({ rating: 'sideways', reply: 'x' });

    expect(res.status).toBe(200);
  });
});
