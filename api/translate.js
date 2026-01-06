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
                  text: `Translate this English text to ${targetLanguage} at ${level} level:\n\n"${text}"\n\nRespond with ONLY valid JSON (no markdown, no extra text):\n{"translated": "the translation", "englishBackTranslation": "what the translation means in English or null"}`
                }]
              }],
              generationConfig: {
                maxOutputTokens: 512
              }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            try {
              // Clean markdown code fences if present
              let cleanContent = content.trim();
              if (cleanContent.startsWith('```')) {
                cleanContent = cleanContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
              }
              const parsed = JSON.parse(cleanContent);
              return res.json({ 
                translated: parsed.translated, 
                englishBackTranslation: parsed.englishBackTranslation || null,
                model, 
                targetLanguage, 
                level 
              });
            } catch (e) {
              // If JSON parse fails, return raw content as translation
              return res.json({ 
                translated: content, 
                englishBackTranslation: null,
                model, 
                targetLanguage, 
                level 
              });
            }
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
    // First, get the translation
    const translateResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{
          role: 'user',
          content: `Translate this English text to ${targetLanguage} at ${level} level:\n\n"${text}"\n\nRespond with ONLY the translation, nothing else.`
        }],
        max_tokens: 512
      })
    });

    if (!translateResponse.ok) {
      return res.status(500).json({ error: 'Translation failed' });
    }

    const translateData = await translateResponse.json();
    const translated = translateData.choices?.?.message?.content?.trim();
    
    if (!translated) {
      return res.status(500).json({ error: 'No translation returned' });
    }

    // Then, get the English back-translation
    let englishBackTranslation = null;
    try {
      const backTranslateResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mistralKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mistral-large-latest',
          messages: [{
            role: 'user',
            content: `What does this ${targetLanguage} text mean in English? Provide a brief, natural English explanation.\n\n"${translated}"\n\nRespond with ONLY the English explanation, nothing else.`
          }],
          max_tokens: 256
        })
      });

      if (backTranslateResponse.ok) {
        const backData = await backTranslateResponse.json();
        englishBackTranslation = backData.choices?.?.message?.content?.trim() || null;
      }
    } catch (e) {
      // If back-translation fails, just continue without it
    }

    return res.json({ 
      translated, 
      englishBackTranslation,
      model: 'Mistral', 
      targetLanguage, 
      level 
    });

  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
}

