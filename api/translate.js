export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, level, targetLanguage = 'Finnish' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Valid text required' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY not configured' });
  }

  try {
    // Mistral primary
    const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{
          role: 'user',
          content: `Translate this text to ${targetLanguage} at CEFR ${level} level (keep it natural for that level, maintain original meaning, structure sentences appropriately for the level):

Text: "${text.replace(/"/g, '\\"')}"

Only return the translation. No explanations.`
        }]
      })
    });

    if (mistralResponse.ok) {
      const data = await mistralResponse.json();
      return res.json({
        translated: data.choices[0].message.content.trim(),
        targetLanguage,
        level,
        model: 'Mistral'
      });
    }

    // Fallback to Gemini (uses its own env var)
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: 'Fallback API not configured' });
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nOnly the translation, nothing else.`
          }]
        }]
      })
    });

    const geminiData = await geminiResponse.json();
    return res.json({
      translated: geminiData.candidates[0].content.parts[0].text.trim(),
      targetLanguage,
      level,
      model: 'Gemini'
    });

  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({ error: 'Translation failed' });
  }
}

