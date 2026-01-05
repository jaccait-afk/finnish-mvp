export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, targetLanguage = "Finnish" } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing text" });
  }

  try {
    const languageCodeMap = {
      Finnish: "fi",
      English: "en",
      Spanish: "es",
      French: "fr"
    };

    const targetLangCode = languageCodeMap[targetLanguage] || "fi";

    // Use free MyMemory translation API
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.append("q", text);
    url.searchParams.append("langpair", `auto|${targetLangCode}`);

    const translationResponse = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    if (!translationResponse.ok) {
      throw new Error(`Translation API error: ${translationResponse.statusText}`);
    }

    const translationData = await translationResponse.json();
    
    if (translationData.responseStatus !== 200) {
      throw new Error("Translation API returned error");
    }

    const translation = translationData.responseData.translatedText;

    res.status(200).json({
      translation,
      originalText: text,
      targetLanguage
    });
  } catch (error) {
    console.error("Selection translation error:", error.message);
    res.status(500).json({ error: `Translation failed: ${error.message}` });
  }
}

