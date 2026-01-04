export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, level } = req.body;
  
  // Mock translation - replace with real API
  res.status(200).json({
    english: text,
    finnish: 'Suomalainen käännös tähän',
    pronunciation: 'Suomenlainen käännös täähän',
    level
  });
}

