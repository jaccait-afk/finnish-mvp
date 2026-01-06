export default async function handler(req, res) {
  console.log('Translate request received:', { method: req.method, body: Object.keys(req.body || {}) });
  
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
      if (obj.translated) return obj.translated;
      if (obj.content) return obj.content;
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
                text: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nOutput ONLY valid JSON:\n{"translated": "translation text"}`
              }]
            }]
          })
        }
      );

      console.log(`${model} response: ${geminiResponse.status}`);

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          const geminiContent = geminiData.candidates[0].content.parts[0].text.trim();
          const cleanContent = geminiContent.startsWith('```') ? geminiContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '') : geminiContent;
          
          try {
            const parsed = JSON.parse(cleanContent);
            const translated = extractText(parsed.translated);
            console.log(`${model} succeeded`);
            return { success: true, translated, model };
          } catch (e) {
            console.error(`${model} parse error:`, e.message);
            return { success: true, translated: cleanContent, model };
          }
        }
      }
      console.log(`${model} failed with status ${geminiResponse.status}`);
      return { success: false };
    } catch (e) {
      console.error(`${model} error:`, e.message);
      return { success: false };
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  if (geminiKey) {
    console.log('Trying Gemini models...');
    for (const model of geminiModels) {
      const result = await tryGeminiModel(geminiKey, model);
      if (result.success) {
        return res.json({ translated: result.translated, model: result.model, targetLanguage, level });
      }
    }
    console.log('All Gemini models failed, trying Mistral...');
  } else {
    console.log('No Gemini key, trying Mistral...');
  }

  const mistralKey = process.env.MISTRAL_API_KEY;
  if (!mistralKey) {
    console.error('No Mistral key configured');
    return res.status(500).json({ error: 'No API keys configured' });
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
          content: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nOutput ONLY valid JSON:\n{"translated": "translation text"}`
        }]
      })
    });

    console.log('Mistral response:', mistralResponse.status);

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      console.error('Mistral error:', mistralResponse.status, errorText);
      return res.status(500).json({ error: `Mistral failed: ${mistralResponse.status}` });
    }

    const data = await mistralResponse.json();
    
    if (!data.choices?.?.message?.content) {
      console.error('Mistral format error:', data);
      return res.status(500).json({ error: 'Mistral format error' });
    }

    let content = data.choices.message.content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      const parsed = JSON.parse(content);
      const translated = extractText(parsed.translated);
      console.log('Mistral succeeded');
      return res.json({ translated, model: 'Mistral', targetLanguage, level });
    } catch (e) {
      console.error('Mistral parse error:', e.message);
      return res.json({ translated: content, model: 'Mistral', targetLanguage, level });
    }

  } catch (mistralError) {
    console.error('Mistral exception:', mistralError.message);
    return res.status(500).json({ error: mistralError.message });
  }
}

