export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, level } = req.body;
  const apiKey = process.env.DEEPL_API_KEY;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  if (!apiKey) {
    return res.status(500).json({ error: 'DeepL API key not configured' });
  }

  try {
    const response = await fetch('https://api-free.deepl.com/v1/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        target_lang: 'FI'
      })
    });

    const data = await response.json();
    const finnish = data.translations?.[0]?.text || 'Translation failed';

    res.status(200).json({
      english: text,
      finnish: finnish,
      pronunciation: finnish, // DeepL doesn't provide pronunciation
      level
    });
  } catch (e) {
    console.error('Translation error:', e.message);
    res.status(500).json({ error: `Translation error: ${e.message}` });
  }
}

