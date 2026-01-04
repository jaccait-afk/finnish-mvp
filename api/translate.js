export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, level } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  if (!geminiKey) {
    return res.status(500).json({ error: 'Gemini API key not configured' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
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
            maxOutputTokens: 2048
          }
        })
      }
    );

    const data = await response.json();
    const finnish = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Translation failed';

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

