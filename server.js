const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Translation API - calls Gemini
app.post('/api/translate', async (req, res) => {
  const { text, level } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  if (!geminiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  const models = [
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash-001',
    'gemini-2.0-flash-lite-001'
  ];

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate this English text to Finnish at ${level} level (CEFR framework):

"${text}"

Provide ONLY the Finnish translation at this level. For A1, use very simple words and short sentences. For B1+, use more complex vocabulary. For Selkosuomi, use simplified vocabulary with short, clear sentences.`
              }]
            }],
            generationConfig: {
              maxOutputTokens: 8192
            }
          })
        }
      );

      const data = await response.json();

      if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        const finnish = data.candidates[0].content.parts[0].text;
        return res.status(200).json({
          english: text,
          finnish: finnish,
          pronunciation: finnish,
          level: level,
          model: model
        });
      }
    } catch (e) {
      console.error(`Model ${model} failed:`, e.message);
      continue;
    }
  }

  return res.status(500).json({ 
    error: 'All translation models failed',
    modelsAttempted: models
  });
});

// Fetch content from URL
app.get('/api/fetch-content', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'No URL provided' });
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch: ${response.statusText}` });
    }
    
    const text = await response.text();
    const plainText = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\n\n+/g, '\n')
      .trim();
    
    console.log(`Fetched content length: ${plainText.length} characters`);
    
    res.json({ 
      content: plainText,
      totalLength: plainText.length,
      truncated: false
    });
  } catch (e) {
    console.error('Fetch error:', e.message);
    res.status(500).json({ error: `Server error: ${e.message}` });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Finnish MVP ready: http://localhost:${port}`);
});

