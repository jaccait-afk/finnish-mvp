import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, level, targetLanguage = "Finnish" } = req.body;

  console.log("Request received:", { text: text.substring(0, 50), level, targetLanguage });

  if (!text || !level) {
    return res.status(400).json({ error: "Missing text or level" });
  }

  if (!process.env.GOOGLE_API_KEY) {
    console.error("GOOGLE_API_KEY is not set");
    return res.status(500).json({ error: "API key not configured" });
  }

  console.log("API Key check passed, key length:", process.env.GOOGLE_API_KEY?.length);

  const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
  let translated = null;
  let lastError = null;

  // Try each model until one works
  for (const modelName of models) {
    try {
      console.log(`Attempting translation with ${modelName}...`);
      const model = client.getGenerativeModel({ model: modelName });

      const languageMap = {
        Finnish: "Finnish",
        English: "English",
        Spanish: "Spanish",
        French: "French"
      };

      const targetLang = languageMap[targetLanguage] || "Finnish";

      const levelMap = {
        A1: "absolute beginner (A1)",
        A2: "elementary (A2)",
        B1: "intermediate (B1)",
        B2: "upper intermediate (B2)",
        C1: "advanced (C1)",
        C2: "mastery level (C2)",
        Simplified: "simplified version for easy understanding"
      };

      const levelDesc = levelMap[level] || "intermediate (B1)";

      const prompt = `Translate the following text to ${targetLang} at the ${levelDesc} CEFR level. 

The translation should:
- Use vocabulary appropriate for a ${levelDesc} learner
- Use grammatically correct ${targetLang}
- Be natural and idiomatic
- Preserve the original meaning and tone
- If translating to a simplified level, simplify sentence structure and use common words

Text to translate:
${text}

Provide ONLY the translation, nothing else.`;

      const result = await model.generateContent(prompt);
      translated = result.response.text().trim();
      console.log(`Success with ${modelName}`);
      break;

    } catch (error) {
      console.error(`Failed with ${modelName}:`, error.message);
      lastError = error;
      continue;
    }
  }

  if (!translated) {
    console.error("All models failed. Last error:", lastError?.message);
    return res.status(500).json({ 
      error: `Translation failed: ${lastError?.message || "All models exhausted"}` 
    });
  }

  res.status(200).json({
    translated,
    targetLanguage: languageMap[targetLanguage] || "Finnish",
    level
  });
}

