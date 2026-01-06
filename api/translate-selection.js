export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, targetLanguage = 'English' } = req.body;

  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Valid text required' });
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MISTRAL_API_KEY not configured' });
  }

  try {
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [{
          role: 'user',
          content: `Translate this to ${targetLanguage}: "${text.replace(/"/g, '\\"')}"\n\nOnly the translation.`
        }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      return res.json({ translation: data.choices[0].message.content.trim() });
    }

    // Gemini fallback
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: 'Fallback API not configured' });
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Translate to ${targetLanguage}: "${text}"\n\nOnly the translation.` }] }]
      })
    });

    const geminiData = await geminiResponse.json();
    return res.json({ 
      translation: geminiData.candidates[0].content.parts[0].text.trim(),
      model: 'Gemini'
    });

  } catch (error) {
    console.error('Selection translation error:', error);
    return res.status(500).json({ error: 'Translation failed' });
  }
}

