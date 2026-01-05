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
    let cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '');
    
    // Extract main content - look for article/main/content tags first
    let mainContent = '';
    const articleMatch = cleaned.match(/<article[^>]*>(.*?)<\/article>/is);
    const mainMatch = cleaned.match(/<main[^>]*>(.*?)<\/main>/is);
    const contentMatch = cleaned.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/is);
    
    if (articleMatch) {
      mainContent = articleMatch[1];
    } else if (mainMatch) {
      mainContent = mainMatch[1];
    } else if (contentMatch) {
      mainContent = contentMatch[1];
    } else {
      mainContent = cleaned;
    }
    
    // Remove remaining HTML tags
    let plainText = mainContent
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Remove excessive whitespace
      .replace(/\n\s*\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`Fetched and cleaned: ${plainText.length} characters`);
    
    res.status(200).json({ 
      content: plainText,
      totalLength: plainText.length
    });
  } catch (e) {
    console.error('Fetch error:', e.message);
    res.status(500).json({ error: `Server error: ${e.message}` });
  }
}

