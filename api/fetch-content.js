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
    
    const text = await response.text();
    const plainText = text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\n\n+/g, '\n')
      .trim()
      .substring(0, 3000);
    
    res.status(200).json({ content: plainText || 'No content found' });
  } catch (e) {
    console.error('Fetch error:', e.message);
    res.status(500).json({ error: `Server error: ${e.message}` });
  }
}

