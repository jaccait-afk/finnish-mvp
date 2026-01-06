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

  async function fetchWithTimeout(url, options, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      console.log('Attempting Gemini translation (PRIMARY)...');
      const geminiResponse = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nOutput ONLY valid JSON:\n{"translated": "translation text", "englishBackTranslation": "English or null"}`
            }]
          }]
        })
      }, 30000);

      if (geminiResponse.ok) {
        const geminiData = await geminiResponse.json();
        const geminiContent = geminiData.candidates[0].content.parts[0].text.trim();
        const cleanContent = geminiContent.startsWith('```') ? geminiContent.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '') : geminiContent;
        
        try {
          const parsed = JSON.parse(cleanContent);
          const translated = extractText(parsed.translated);
          const englishBackTranslation = parsed.englishBackTranslation ? extractText(parsed.englishBackTranslation) : null;
          console.log('Gemini succeeded');
          return res.json({ translated, englishBackTranslation, targetLanguage, level, model: 'Gemini' });
        } catch (e) {
          console.error('Gemini parse error:', e);
          return res.json({ translated: cleanContent, englishBackTranslation: null, targetLanguage, level, model: 'Gemini' });
        }
      }
    } catch (geminiError) {
      console.error('Gemini failed:', geminiError.message);
    }
  }

  const mistralKey = process.env.MISTRAL_API_KEY;
  if (!mistralKey) {
    return res.status(500).json({ error: 'No API keys configured' });
  }

  try {
    console.log('Attempting Mistral translation (FALLBACK)...');
    const mistralResponse = await fetchWithTimeout('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{
          role: 'user',
          content: `Translate to ${targetLanguage} at CEFR ${level} level:\n\n"${text}"\n\nOutput ONLY JSON:\n{"translated": "text", "englishBackTranslation": "English or null"}`
        }]
      })
    }, 30000);

    if (!mistralResponse.ok) {
      throw new Error(`Mistral ${mistralResponse.status}`);
    }

    const data = await mistralResponse.json();
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
      console.error('Mistral parse error:', e);
      return res.json({ translated: content, englishBackTranslation: null, targetLanguage, level, model: 'Mistral' });
    }

  } catch (mistralError) {
    console.error('Mistral failed:', mistralError.message);
    return res.status(500).json({ error: 'Both APIs failed' });
  }
}

