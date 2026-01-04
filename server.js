const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

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
    const response = await fetch(url);
    const text = await response.text();
    const plainText = text.replace(/<[^>]*>/g, '').replace(/\n\n+/g, '\n').trim().substring(0, 2000);
    res.json({ content: plainText });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch URL' });
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
