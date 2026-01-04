export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, level } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fi`
    );

    const data = await response.json();
    const finnish = data.responseData?.translatedText || 'Translation failed';

    res.status(200).json({
      english: text,
      finnish: finnish,
      pronunciation: finnish,
      level: level
    });
  } catch (e) {
    console.error('Translation error:', e.message);
    res.status(500).json({ error: `Translation error: ${e.message}` });
  }
}

