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

  // Helper to extract plain text from any format
  function extractText(obj) {
    if (typeof obj === 'string') {
      try {
        const parsed = JSON.parse(obj);
        return extractText(parsed);
      } catch {
        return obj;
      }
    }
    if (typeof obj === 'object' && obj !== null) {
      if (obj.text) return obj.text;
      if (obj.teksti) return obj.teksti;
      if (obj.translated) return obj.translated;
      if (obj.content) return obj.content;
      if (obj.sisältö) return obj.sisältö;
      return JSON.stringify(obj);
    }
    return String(obj);
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

Output ONLY valid JSON with plain text strings (no nested objects):
{"translated": "simple translation text here", "englishBackTranslation": "English version here or null if target is English"}`
        }]
      })
    });

    if (!mistralResponse.ok) {
      throw new Error(`Mistral API error: ${mistralResponse.status}`);
    }

    const data = await mistralResponse.json();
    let content = data.choices[0].message.content.trim();
    
    // Strip markdown code blocks
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return res.json({
        translated: content,
        englishBackTranslation: null,
        targetLanguage,
        level,
        model: 'Mistral'
      });
    }

    // Flatten nested objects to plain text
    const translated = extractText(parsed.translated);
    const englishBackTranslation = parsed.englishBackTranslation ? extractText(parsed.englishBackTranslation) : null;

    return res.json({
      translated,
      englishBackTranslation,
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
              text: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nOutput ONLY valid JSON:\n{"translated": "translation text", "englishBackTranslation": "English or null"}`
            }]
          }]
        })
      });

      if (!geminiResponse.ok) {
        throw new Error(`Gemini API error: ${geminiResponse.status}`);
      }

      const geminiData = await geminiResponse.json();
      let geminiContent = geminiData.candidates.content.parts.text.trim();

      // Strip markdown
      if (geminiContent.startsWith('```')) {
        geminiContent = geminiContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      let parsed;
      try {
        parsed = JSON.parse(geminiContent);
      } catch (parseError) {
        console.error('Gemini parse error:', parseError);
        return res.json({
          translated: geminiContent,
          englishBackTranslation: null,
          targetLanguage,
          level,
          model: 'Gemini'
        });
      }

      const translated = extractText(parsed.translated);
      const englishBackTranslation = parsed.englishBackTranslation ? extractText(parsed.englishBackTranslation) : null;

      return res.json({
        translated,
        englishBackTranslation,
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

