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

app.post('/api/user', (req, res) => {
  res.json({ token: 'demo-token-123' });
});

app.post('/api/diagnostic', (req, res) => {
  res.json({
    overall: 72,
    cases: { illative: 85, inessive: 68, adessive: 71, elative: 59 }
  });
});
app.post('/api/translate', (req, res) => {
let text = req.body.text || 'I go to the city.';
const level = req.body.level || 'A1';

const translations = {
A1: { finnish: 'Minä menen kaupunkiin.', pronunciation: 'MEE-nuh MEN-en KAH-poon-kiin' },
A2: { finnish: 'Menen kaupunkiin jokapäivä.', pronunciation: 'MEN-en KAH-poon-kiin YO-kah-PAH-ee-vuh' },
B1: { finnish: 'Käyn kaupungissa ostoksilla.', pronunciation: 'KAH-oon KAH-poon-GEES-sah OS-tok-sil-lah' }
};

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
      .trim()
      .substring(0, 3000);
    
    res.json({ content: plainText || 'No content found' });
  } catch (e) {
    console.error('Fetch error:', e.message);
    res.status(500).json({ error: `Server error: ${e.message}` });
  }
});

const result = translations[level] || translations.A1;

res.json({
english: text,
finnish: result.finnish,
pronunciation: result.pronunciation,
level: level
});
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Finnish MVP ready: http://localhost:${port}`);
});
