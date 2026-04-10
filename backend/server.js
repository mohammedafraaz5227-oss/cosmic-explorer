/**
 * server.js — Express backend for Cosmic Explorer.
 *
 * Proxies AI chat requests to OpenAI GPT-4o with an astronomy system prompt.
 * API key is stored securely in .env and never exposed to the client.
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors());
app.use(express.json());

// ── Rate limiting (simple in-memory) ──
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20;       // requests per window

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimit.get(ip) || { count: 0, start: now };

  if (now - record.start > RATE_LIMIT_WINDOW) {
    // Reset window
    record.count = 1;
    record.start = now;
  } else {
    record.count++;
  }

  rateLimit.set(ip, record);
  return record.count <= RATE_LIMIT_MAX;
}

// ── AI client (Groq via OpenAI SDK) ──
const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are "Cosmic AI", an expert astronomer and space science educator embedded in the Cosmic Explorer 3D solar system application.

Your personality:
- Enthusiastic about space but scientifically rigorous
- Use emojis sparingly for visual appeal (🌍 🪐 ☀️ 🌑 🚀 ✨)
- Keep responses concise (2-4 paragraphs max)
- Include at least one surprising fact in each response
- When discussing a specific planet, reference its data naturally

Rules:
- Only answer questions about astronomy, space science, astrophysics, and the solar system
- For off-topic questions, politely redirect to space topics
- Cite realistic numbers and scientific consensus
- Mention ongoing/recent missions when relevant (JWST, Perseverance, Europa Clipper, etc.)`;

// ── Routes ──

app.post('/ask-space-ai', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(ip)) {
    return res.status(429).json({
      error: 'Too many requests. Please wait a moment before asking another question.',
    });
  }

  const { question, context } = req.body;

  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Please provide a question.' });
  }

  // Check if API key is configured
  if (!process.env.GROQ_API_KEY) {
    return res.json({
      answer: '🔧 The Groq API key is not configured. Please add your API key to `backend/.env` and restart the server. In the meantime, I can still share basic facts about planets from my local database!',
    });
  }

  try {
    // Build context-aware user message
    let userMessage = question;
    if (context) {
      userMessage = `[The user is currently viewing ${context} in the 3D solar system] ${question}`;
    }

    const completion = await openai.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content || 'I wasn\'t able to generate a response. Please try again!';

    res.json({ answer });
  } catch (error) {
    console.error('OpenAI API error:', error.message);

    if (error.status === 401) {
      return res.status(401).json({
        answer: '🔑 Invalid API key. Please check your `backend/.env` file.',
      });
    }

    res.status(500).json({
      answer: '⚠️ An error occurred while contacting the AI. Please try again in a moment.',
    });
  }
});

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cosmic-explorer-backend' });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`\n🚀 Cosmic Explorer Backend running on http://localhost:${PORT}`);
  console.log(`   POST /ask-space-ai — AI chat endpoint`);
  console.log(`   GET  /health       — Health check\n`);

  if (!process.env.GROQ_API_KEY) {
    console.log('   ⚠️  GROQ_API_KEY not set — AI will return placeholder responses');
    console.log('   📝 Add your key to backend/.env\n');
  }
});
