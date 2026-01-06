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
          content: `Translate this text to ${targetLanguage} at CEFR ${level} level (keep it natural for that level):

Text: "${text.replace(/"/g, '\\"')}"

Return ONLY a JSON object (no other text):
{"translated": "your translation here", "englishBackTranslation": "English version of translation (or null if target is English)"}`
        }]
      })
    });

    if (!mistralResponse.ok) {
      console.error('Mistral error:', mistralResponse.status);
      throw new Error(`Mistral API error: ${mistralResponse.status}`);
    }

    const data = await mistralResponse.json();
    const content = data.choices[0].message.content.trim();
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      return res.json({
        translated: content,
        englishBackTranslation: null,
        targetLanguage,
        level,
        model: 'Mistral'
      });
    }

    return res.json({
      translated: parsed.translated || content,
      englishBackTranslation: parsed.englishBackTranslation || null,
      targetLanguage,
      level,
      model: 'Mistral'
    });

  } catch (mistralError) {
    console.error('Mistral error, trying Gemini:', mistralError);
    
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: 'Fallback API not configured' });
    }

    try {
      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nReturn ONLY JSON (no other text):\n{"translated": "translation", "englishBackTranslation": "English or null"}`
            }]
          }]
        })
      });

      if (!geminiResponse.ok) {
        console.error('Gemini error:', geminiResponse.status);
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const geminiData = await geminiResponse.json();
      const geminiContent = geminiData.candidates[0].content.parts[0].text;

      let parsed;
      try {
        parsed = JSON.parse(geminiContent);
      } catch (parseError) {
        console.error('Gemini JSON parse error:', parseError);
        return res.json({
          translated: geminiContent,
          englishBackTranslation: null,
          targetLanguage,
          level,
          model: 'Gemini'
        });
      }

      return res.json({
        translated: parsed.translated || geminiContent,
        englishBackTranslation: parsed.englishBackTranslation || null,
        targetLanguage,
        level,
        model: 'Gemini'
      });

    } catch (geminiError) {
      console.error('Both APIs failed:', mistralError, geminiError);
      return res.status(500).json({ error: 'Translation failed on both APIs' });
    }
  }
}

