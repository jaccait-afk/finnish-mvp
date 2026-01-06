export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LanguageTranslator/1.0)'
      }
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'Failed to fetch content' });
    }

    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const contentMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || 
                        html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

    let content = contentMatch ? contentMatch[1] : html;
    
    // Basic HTML to text
    content = content.replace(/<[^>]*>/g, ' ');
    content = content.replace(/\s+/g, ' ').trim();

    return res.json({
      title: titleMatch ? titleMatch[1].trim() : 'Untitled',
      content: content.substring(0, 50000) // Limit size
    });

  } catch (error) {
    console.error('Fetch error:', error);
    return res.status(500).json({ error: 'Failed to process URL' });
  }
}

