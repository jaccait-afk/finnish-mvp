export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, level, targetLanguage = 'Finnish' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Valid text required' });
  }

  function extractText(obj) {
    if (typeof obj === 'string') {
      try {
        const parsed = JSON.parse(obj);
        return extractText(parsed);
      } catch (e) {
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

  async function tryGeminiModel(geminiKey, model) {
    console.log(`Attempting Gemini ${model}...`);
    try {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nOutput ONLY valid JSON:\n{"translated": "translation text", "englishBackTranslation": "English or null"}`
              }]
            }]
          })
        }
      );

      console.log(`${model} response: ${geminiResponse.status}`);

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const geminiContent = geminiData.candidates[0].content.parts[0].text.trim();
        const cleanContent = geminiContent.startsWith('```') ? geminiContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '') : geminiContent;
        
        try {
          const parsed = JSON.parse(cleanContent);
          const translated = extractText(parsed.translated);
          const englishBackTranslation = parsed.englishBackTranslation ? extractText(parsed.englishBackTranslation) : null;
          console.log(`${model} succeeded`);
          return { success: true, translated, englishBackTranslation, model };
        } catch (e) {
          console.error(`${model} parse error:`, e.message);
          return { success: true, translated: cleanContent, englishBackTranslation: null, model };
        }
      } else if (geminiResponse.status === 429) {
        console.error(`${model} rate limited (429)`);
        return { success: false, rateLimited: true };
      } else {
        console.error(`${model} HTTP error: ${geminiResponse.status}`);
        return { success: false };
      }
    } catch (e) {
      console.error(`${model} error:`, e.message);
      return { success: false };
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModels = ['gemini-2.0-flash-exp', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

  if (geminiKey) {
    for (const model of geminiModels) {
      const result = await tryGeminiModel(geminiKey, model);
      if (result.success) {
        return res.json({ ...result, targetLanguage, level });
      }
    }
    console.log('All Gemini models failed, trying Mistral...');
  }

  const mistralKey = process.env.MISTRAL_API_KEY;
  if (!mistralKey) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY not configured' });
  }

  try {
    console.log('Attempting Mistral translation...');
    
    const mistralResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{
          role: 'user',
          content: `Translate this text to ${targetLanguage} at CEFR ${level} level (keep it natural for that level, maintain original meaning, structure sentences appropriately for the level):

Text: "${text.replace(/"/g, '\\"')}"

Output ONLY valid JSON:\n{"translated": "translation text", "englishBackTranslation": "English or null"}`
        }]
      })
    });

    console.log('Mistral response received:', mistralResponse.status);

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      console.error('Mistral HTTP error:', mistralResponse.status, errorText);
      throw new Error(`Mistral HTTP ${mistralResponse.status}: ${errorText}`);
    }

    const data = await mistralResponse.json();
    console.log('Mistral data parsed');
    
    if (!data.choices || !data.choices || !data.choices.message) {
      throw new Error('Mistral format error');
    }

    let content = data.choices.message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(content);
      const translated = extractText(parsed.translated);
      const englishBackTranslation = parsed.englishBackTranslation ? extractText(parsed.englishBackTranslation) : null;
      console.log('Mistral succeeded');
      return res.json({ translated, englishBackTranslation, targetLanguage, level, model: 'Mistral' });
    } catch (e) {
      console.error('Mistral parse error:', e.message);
      return res.json({ translated: content, englishBackTranslation: null, targetLanguage, level, model: 'Mistral' });
    }

  } catch (mistralError) {
    console.error('Mistral failed:', mistralError.message);
    return res.status(500).json({ error: mistralError.message });
  }
}

