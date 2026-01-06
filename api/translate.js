export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, level, targetLanguage = 'Finnish' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Valid text required' });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const mistralKey = process.env.MISTRAL_API_KEY;

  // Try Gemini models first
  if (geminiKey) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

    for (const model of geminiModels) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Translate this English text to ${targetLanguage} at ${level} level:\n\n"${text}"\n\nProvide ONLY the translation.`
                }]
              }],
              generationConfig: {
                maxOutputTokens: 256
              }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const translated = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (translated) {
            return res.json({ translated, model, targetLanguage, level });
          }
        }
      } catch (e) {
        continue;
      }
    }
  }

  // Fallback to Mistral
  if (!mistralKey) {
    return res.status(500).json({ error: 'No API keys configured' });
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{
          role: 'user',
          content: `Translate this English text to ${targetLanguage} at ${level} level:\n\n"${text}"\n\nProvide ONLY the translation.`
        }],
        max_tokens: 256
      })
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Translation failed' });
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content;
    
    return res.json({ translated: translated || '', model: 'Mistral', targetLanguage, level });

  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}

