export default async function handler(req, res) {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'No URL provided' });
  }
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch: ${response.statusText}` });
    }
    
    const html = await response.text();
    
    // Remove script and style tags
    let cleaned = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove all HTML tags
    let plainText = cleaned.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    plainText = plainText
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Clean up whitespace aggressively
    plainText = plainText.replace(/\t+/g, ' ');
    plainText = plainText.replace(/  +/g, ' ');
    plainText = plainText.replace(/\n\n\n+/g, '\n'); // Multiple blank lines to single
    plainText = plainText.trim();
    
    res.status(200).json({ 
      content: plainText,
      totalLength: plainText.length
    });
  } catch (e) {
    res.status(500).json({ error: `Server error: ${e.message}` });
  }
}

