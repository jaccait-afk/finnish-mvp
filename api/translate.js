kexport default async function handler(req, res) {
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
          content: `Translate this text to ${targetLanguage} at CEFR ${level} level (keep it natural for that level, maintain original meaning):

Text: "${text.replace(/"/g, '\\"')}"

Respond in JSON format:
{
  "translated": "[translation here]",
  "englishBackTranslation": "[English translation of the translated text - only if target is not English]"
}

Example if translating to Finnish A1:
{
  "translated": "Minä menen kaupunkiin.",
  "englishBackTranslation": "I go to the city."
}`
        }]
      })
    });

    if (mistralResponse.ok) {
      const data = await mistralResponse.json();
      const content = data.choices[0].message.content.trim();
      
      try {
        const parsed = JSON.parse(content);
        return res.json({
          translated: parsed.translated,
          englishBackTranslation: parsed.englishBackTranslation || null,
          targetLanguage,
          level,
          model: 'Mistral'
        });
      } catch (e) {
        return res.json({
          translated: content,
          englishBackTranslation: null,
          targetLanguage,
          level,
          model: 'Mistral'
        });
      }
    }

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
            text: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nRespond in JSON:\n{\n  "translated": "[translation]",\n  "englishBackTranslation": "[English of translation - skip if target is English]"\n}`
          }]
        }]
      })
    });

    const geminiData = await geminiResponse.json();
    const geminiContent = geminiData.candidates[0].content.parts[0].text;
    
    try {
      const parsed = JSON.parse(geminiContent);
      return res.json({
        translated: parsed.translated,
        englishBackTranslation: parsed.englishBackTranslation || null,
        targetLanguage,
        level,
        model: 'Gemini'
      });
    } catch (e) {
      return res.json({
        translated: geminiContent,
        englishBackTranslation: null,
        targetLanguage,
        level,
        model: 'Gemini'
      });
    }

  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({ error: 'Translation failed' });
  }
}

