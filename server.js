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

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Finnish MVP ready: http://localhost:${port}`);
});
