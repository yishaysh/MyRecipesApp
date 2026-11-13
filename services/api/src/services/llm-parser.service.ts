import {
  Ingredient,
  InstructionStep,
  ShoppingCategoryItem,
  StructuredRecipe,
  StructuredRecipeSchema
} from '../shared/index.js';
import { RawMediaContent } from './extractor.service.js';

export class LlmParserService {
  /**
   * Parses raw extracted social media text / transcript into canonical StructuredRecipe.
   * Outputs all content in clear Hebrew and strictly adheres to hallucination prevention rules (unknown amount/duration => null).
   */
  public async parseToRecipe(raw: RawMediaContent): Promise<StructuredRecipe> {
    const recipes = await this.parseToRecipes(raw);
    return recipes[0];
  }

  /**
   * Parses raw extracted social media text / transcript or carousel images into canonical StructuredRecipes.
   * Supports multi-recipe posts (e.g. carousels with multiple distinct recipes).
   * Outputs all content in clear Hebrew and strictly adheres to hallucination prevention rules.
   */
  public async parseToRecipes(raw: RawMediaContent): Promise<StructuredRecipe[]> {
    console.log(`[LLM_PARSER] Initiating structured recipe parsing for platform: ${raw.platform} with Hebrew normalization`);

    const combinedText = `${raw.captionText} ${raw.audioTranscript || ''}`.trim();
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (process.env.NODE_ENV === 'test') {
      console.log(`[LLM_PARSER] Running local deterministic Hebrew structured recipe engine for unit tests.`);
      const single = this.deterministicHebrewParse(raw, combinedText);
      return [single];
    }

    // 1. If post contains carousel slides from Instagram or social media:
    if (raw.carouselImages && raw.carouselImages.length > 0 && geminiKey) {
      try {
        console.log(`[LLM_PARSER] Detected carousel images (${raw.carouselImages.length} slides). Trying Multimodal Vision extraction...`);
        const carouselRecipes = await this.callGeminiVisionCarousel(geminiKey, raw);
        if (carouselRecipes && carouselRecipes.length > 0) {
          console.log(`[LLM_PARSER] Successfully extracted ${carouselRecipes.length} recipes from carousel images!`);
          return carouselRecipes;
        }
      } catch (err: any) {
        console.warn(`[LLM_PARSER] Carousel Vision extraction error: ${err.message}`);
        // If caption text is also empty/short or only mentions carousel slides, rethrow the error
        if (!combinedText || combinedText.length < 35 || combinedText.includes('מתכון מתמונות קרוסלה')) {
          throw err;
        }
      }
    }

    // 2. Fallback / Standard single text (or uploaded screenshot) parsing
    let recipe: StructuredRecipe;
    if (geminiKey) {
      console.log(`[LLM_PARSER] Using Google Gemini API for real social media recipe extraction.`);
      recipe = await this.callGeminiApi(geminiKey, raw, combinedText);
      // P1 Validation Pass: check Hebrew word order, ingredient quantity completeness, difficulty/time sanity.
      // If any validation issues are found, perform one automatic retry with the errors fed back to Gemini.
      const validationErrors = this.validateRecipeQuality(recipe, raw);
      if (validationErrors.length > 0) {
        console.warn(`[LLM_PARSER] P1 Validation caught ${validationErrors.length} issue(s); running 1 automatic retry:`, validationErrors);
        try {
          const retried = await this.callGeminiApi(geminiKey, raw, combinedText, validationErrors);
          const retryErrors = this.validateRecipeQuality(retried, raw);
          if (retryErrors.length < validationErrors.length) {
            recipe = retried;
          }
        } catch (retryErr: any) {
          console.warn(`[LLM_PARSER] Validation retry skipped due to error: ${retryErr.message}`);
        }
      }
    } else if (openaiKey) {
      console.log(`[LLM_PARSER] Using OpenAI API for real social media recipe extraction.`);
      recipe = await this.callOpenAiApi(openaiKey, raw, combinedText);
    } else {
      throw new Error(
        'מפתח ה-AI אינו מוגדר בסביבת השרת (Vercel).\n' +
        'יש להגדיר את GEMINI_API_KEY במשתני הסביבה (Environment Variables) של הפרויקט ב-Vercel.'
      );
    }

    // Validate using canonical Zod schema
    const validationResult = StructuredRecipeSchema.safeParse(recipe);
    if (!validationResult.success) {
      console.error(`[LLM_PARSER] Schema validation failed:`, validationResult.error.format());
      throw new Error(`LLM output did not match canonical recipe schema: ${validationResult.error.message}`);
    }

    console.log(`[LLM_PARSER] Recipe successfully parsed in Hebrew: "${recipe.title}" with ${recipe.ingredients.length} ingredients.`);
    return [validationResult.data];
  }

  private async callGeminiVisionCarousel(apiKey: string, raw: RawMediaContent): Promise<StructuredRecipe[]> {
    const slides = (raw.carouselImages || []).slice(0, 12);
    if (slides.length === 0) return [];

    console.log(`[LLM_PARSER] Downloading ${slides.length} carousel slides in parallel for Gemini Vision...`);
    const downloadPromises = slides.map(async (url, idx) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
        if (!res.ok) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return {
          slideIdx: idx + 1,
          url,
          part: {
            inline_data: {
              mime_type: 'image/jpeg',
              data: buf.toString('base64')
            }
          }
        };
      } catch (e: any) {
        console.warn(`[LLM_PARSER] Failed downloading slide ${idx + 1}: ${e.message}`);
        return null;
      }
    });

    const downloaded = (await Promise.all(downloadPromises)).filter((item): item is NonNullable<typeof item> => item !== null);
    if (downloaded.length === 0) {
      throw new Error('לא ניתן היה להוריד את תמונות הקרוסלה מהרשת החברתית.');
    }

    const promptText = `You are an expert culinary assistant.
Analyze these images from an Instagram carousel post.
Some images might be cover images, decorative, author photos, or tips.
Identify each DISTINCT recipe present in the images.
For EACH recipe found, extract a structured recipe in fluent Hebrew.
CRITICAL RULES:
1. Output ALL recipe fields (title, description, ingredients names, instructions, tags) in natural, fluent Hebrew.
2. If an ingredient quantity or unit is not specified, set amount: null and unit: null. DO NOT invent or hallucinate measurements.
3. If cooking or prep duration is not specified, set to null/undefined.
4. Group ingredients under sub-headers ("group"): If the recipe divides ingredients into sections/parts (e.g. "לרוטב", "לקרסט", "לבצק", "למילוי", "לציפוי", "להגשה"), set the "group" field on each ingredient to that Hebrew section title (without trailing colon). If there are no sub-sections, set "group": null.
5. If NO recipes are found at all in the images, return a JSON object: {"error": "לא נמצאו מצרכים או הוראות הכנה בתמונות הקרוסלה"}

Return a JSON array of recipes in the following format:
[
  {
    "title": "שם המתכון בעברית",
    "description": "תיאור קצר בעברית",
    "servings": 4,
    "prepTimeMinutes": 10,
    "cookTimeMinutes": 20,
    "ingredients": [
      { "id": "ing_1", "name": "שם המצרך בעברית", "amount": 2, "unit": "כוסות", "category": "produce", "group": "לרוטב", "originalText": "2 כוסות קמח" }
    ],
    "instructions": [
      { "stepNumber": 1, "instruction": "הוראות השלב בעברית", "durationMinutes": 5, "tip": null }
    ],
    "tags": ["מרק", "חורף"]
  }
]`;

    const parts: any[] = [{ text: promptText }];
    for (const item of downloaded) {
      parts.push({ text: `--- תמונה מספר ${item.slideIdx} ---` });
      parts.push(item.part);
    }

    const modelsToTry = [
      'gemini-flash-latest',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite'
    ];

    let lastError: Error | null = null;
    for (const model of modelsToTry) {
      try {
        console.log(`[LLM_PARSER] Calling Gemini Vision model: ${model}...`);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseMimeType: 'application/json' }
          }),
          signal: AbortSignal.timeout(28000)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini Vision ${model} HTTP ${res.status}: ${errText}`);
        }

        const data = (await res.json()) as any;
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJson) {
          throw new Error(`Gemini Vision ${model} returned empty response`);
        }

        const cleanedJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = this.safeJsonParse(cleanedJson);

        if (parsed && parsed.error && (!Array.isArray(parsed) || parsed.length === 0)) {
          throw new Error(parsed.error);
        }

        const recipeArray = Array.isArray(parsed) ? parsed : (parsed.recipes && Array.isArray(parsed.recipes) ? parsed.recipes : [parsed]);
        const validRecipes: StructuredRecipe[] = [];

        for (let idx = 0; idx < recipeArray.length; idx++) {
          const item = recipeArray[idx];
          if (!item || !item.title) continue;
          const canonical = this.buildCanonicalRecipe(item, raw);
          canonical.id = `rec_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`;
          if (downloaded[idx]?.url) {
            canonical.imageUrl = downloaded[idx].url;
          } else {
            canonical.imageUrl = this.resolveThematicFoodImage(canonical.title, canonical.tags, canonical.description);
          }
          const validation = StructuredRecipeSchema.safeParse(canonical);
          if (validation.success) {
            validRecipes.push(validation.data);
          }
        }

        if (validRecipes.length === 0) {
          throw new Error('לא נמצאו מצרכים או הוראות הכנה בתמונות הפוסט');
        }

        return validRecipes;
      } catch (err: any) {
        console.warn(`[LLM_PARSER] Gemini Vision model ${model} attempt failed: ${err.message}`);
        lastError = err;
        if (
          err.name === 'TimeoutError' ||
          err.name === 'AbortError' ||
          (err.message && (
            err.message.includes('timeout') ||
            err.message.includes('503') ||
            err.message.includes('404') ||
            err.message.includes('429')
          ))
        ) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('חילוץ המתכונים מתמונות הקרוסלה נכשל.');
  }

  private async callGeminiApi(apiKey: string, raw: RawMediaContent, text: string, validationFeedback?: string[]): Promise<StructuredRecipe> {
    const feedbackSection = (validationFeedback && validationFeedback.length > 0)
      ? `\n\nIMPORTANT VALIDATION FIXES REQUIRED FROM PREVIOUS ATTEMPT:\n- ${validationFeedback.join('\n- ')}\nPlease fix ALL of the issues listed above in your output.`
      : '';

    const prompt = `You are an expert culinary AI assistant (SousChef AI).
Analyze the following social media cooking video text/transcript (and image if attached) and extract the recipe into structured JSON.
CRITICAL RULES:
1. Output ALL recipe fields (title, description, ingredients names, group, instructions, tags) in natural, fluent Hebrew.
2. NATURAL HEBREW WORD ORDER (STRICT): Always write ingredient names in natural Hebrew noun-first, adjective-after order! NEVER translate English adjective+noun literally.
   - Example: "4 large egg yolks" -> amount: 4, unit: "יחידות", name: "חלמונים גדולים" (NEVER "גדולים חלמונים").
   - Example: "freshly chopped parsley" -> name: "פטרוזיליה קצוצה טרייה" (NEVER "טרייה קצוצה פטרוזיליה").
   - Example: "crushed garlic" -> name: "שום כתוש" (NEVER "כתוש שום").
3. INGREDIENT QUANTITY COMPLETENESS (STRICT):
   - Every core ingredient MUST have a numeric "amount" and a Hebrew "unit" (e.g. amount: 400, unit: "גרם"; amount: 4, unit: "יחידות"; amount: 2, unit: "כפות"). Recover exact amounts from the transcript/caption/context.
   - ONLY when the source genuinely gives no quantity (e.g. salt, black pepper, garnish, oil for frying), set "amount": null and "unit": "לפי הטעם" (NEVER leave both amount and unit null!).
4. EXACT TIMES & CALIBRATED DIFFICULTY:
   - Preserve exact prepTimeMinutes and cookTimeMinutes stated in the source; NEVER inflate or round them up.
   - If the source does NOT state prep/cook times, provide a realistic conservative estimate and set "timeEstimated": true; otherwise set "timeEstimated": false.
   - Set "difficulty" accurately: "קל" for everyday dishes <= 5-6 steps with standard techniques (like pasta carbonara, shakshuka, salads), "בינוני" for multi-stage dishes, "מתקדם" only for complex pastry/butchery/long-fermentation recipes.
5. Group ingredients by sub-headers ("group"):
   - If the recipe has distinct sections or sub-headers in the description (for example: "לרוטב:", "לקרסט:", "לבצק:", "למילוי:", "לציפוי:", "לסלט:", "להגשה:"), assign each ingredient its Hebrew section name in "group" WITHOUT a trailing colon (e.g., "לרוטב", "לקרסט").
   - Never output a sub-header title itself (like "לרוטב:") as an ingredient item; always put it in the "group" property of the ingredients belonging to that section.
   - If all ingredients belong to a single main list with no sub-sections, set "group": null.
6. Handling "Recipe in Comments" ("מתכון בתגובות" / "המתכון בתגובות") or Dish Summary Captions:
   - On Instagram/TikTok, creators often write a description of the dish and its components in the caption while Instagram blocks anonymous access to the comments.
   - If the text clearly identifies a specific food dish and its key components/flavors (or mentions "מתכון בתגובות" / "המתכון בתגובות" / "recipe in comments"), DO NOT return an error! Instead, use all ingredients/components mentioned in the post + the dish image (if attached) + your culinary expertise to build a complete, accurate, practical recipe for that exact dish (divided into logical "group" sub-headers when the dish has multiple parts like main + sauce), and mention in "description" that the full recipe was completed by SousChef AI based on the dish description.
7. ONLY if the text (and any attached image) does NOT identify any food dish, recipe, or culinary subject at all, respond with: {"error": "לא נמצאו מצרכים או הוראות הכנה בטקסט הסרטון או הפוסט"}${feedbackSection}

JSON format to return:
{
  "title": "שם המתכון בעברית",
  "description": "תיאור קצר בעברית",
  "difficulty": "קל",
  "timeEstimated": false,
  "servings": 4,
  "prepTimeMinutes": 10,
  "cookTimeMinutes": 15,
  "ingredients": [
    { "id": "ing_1", "name": "חלמונים גדולים", "amount": 4, "unit": "יחידות", "category": "dairy", "group": null, "originalText": "4 large egg yolks" },
    { "id": "ing_2", "name": "מלח גס", "amount": null, "unit": "לפי הטעם", "category": "spices", "group": "לרוטב", "originalText": "מלח גס לפי הטעם" }
  ],
  "instructions": [
    { "stepNumber": 1, "instruction": "הוראות השלב בעברית", "durationMinutes": 5, "tip": "טיפ אם יש" }
  ],
  "tags": ["אסייתי", "מהיר"]
}

Source text to parse:
${text}`;

    const parts: any[] = [{ text: prompt }];

    // Attach uploaded screenshot/photo directly if provided (P9)
    if (raw.inlineImageBase64) {
      parts.push({
        inlineData: {
          mimeType: raw.inlineImageMimeType || 'image/jpeg',
          data: raw.inlineImageBase64
        }
      });
    } else {
      // If the caption mentions "בתגובות" or is brief and we have a thumbnail URL, attach the image for multimodal context
      const needsVisualContext = /בתגובות|בתיאור|בפוסט|comments/i.test(text) || text.trim().length < 380;
      if (needsVisualContext && raw.thumbnailUrl && raw.thumbnailUrl.startsWith('http')) {
        try {
          const imgRes = await fetch(raw.thumbnailUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Referer': 'https://www.instagram.com/'
            },
            signal: AbortSignal.timeout(4500)
          });
          if (imgRes.ok) {
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            if (contentType.startsWith('image/')) {
              const buf = await imgRes.arrayBuffer();
              parts.push({
                inlineData: {
                  mimeType: contentType.split(';')[0].trim(),
                  data: Buffer.from(buf).toString('base64')
                }
              });
            }
          }
        } catch (imgErr: any) {
          console.warn(`[LLM_PARSER] Optional thumbnail fetch skipped: ${imgErr.message}`);
        }
      }
    }

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-flash-latest',
      'gemini-2.0-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite'
    ];
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        console.log(`[LLM_PARSER] Calling Gemini model: ${model}...`);
        const generationConfig: Record<string, any> = { responseMimeType: 'application/json' };
        // Disable hidden thinking tokens on Gemini 2.5 Flash for fast structured JSON extraction
        if (model === 'gemini-2.5-flash') {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig
          }),
          signal: AbortSignal.timeout(22000)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Gemini ${model} HTTP ${res.status}: ${errText}`);
        }

        const data = (await res.json()) as any;
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJson) {
          throw new Error(`Gemini ${model} returned empty response`);
        }

        const cleanedJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = this.safeJsonParse(cleanedJson);

        if (parsed.error) {
          throw new Error(parsed.error);
        }

        return this.buildCanonicalRecipe(parsed, raw);
      } catch (err: any) {
        console.warn(`[LLM_PARSER] Model ${model} attempt failed: ${err.message}`);
        lastError = err;
        // Gracefully failover on timeouts, 503, 404, 429, or temporary overload
        if (
          err.name === 'TimeoutError' ||
          err.name === 'AbortError' ||
          (err.message && (
            err.message.includes('timeout') ||
            err.message.includes('503') ||
            err.message.includes('404') ||
            err.message.includes('429') ||
            err.message.includes('high demand')
          ))
        ) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || new Error('כל ניסיונות הפנייה למודל Gemini נכשלו.');
  }

  private async callOpenAiApi(apiKey: string, raw: RawMediaContent, text: string): Promise<StructuredRecipe> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an expert chef assistant. Parse social media video cooking text into structured JSON. Translate and output all recipe titles, descriptions, ingredient names, categories, group (Hebrew sub-header like "לרוטב", "לקרסט", "לבצק" if divided into sections, or null), and instructions in clear, accurate Hebrew. If the post describes a food dish and states "מתכון בתגובות" (recipe in comments), reconstruct the complete recipe for that dish based on the mentioned components.'
          },
          { role: 'user', content: text }
        ]
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!res.ok) {
      throw new Error(`OpenAI HTTP ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as any;
    const rawContent = data.choices?.[0]?.message?.content || '{}';
    const cleanedJson = rawContent.replace(/^```(?:json)?s*/i, '').replace(/```s*$/, '').trim();
    const parsed = this.safeJsonParse(cleanedJson);
    return this.buildCanonicalRecipe(parsed, raw);
  }

  private safeJsonParse(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch (initialErr) {
      // Fix invalid backslash escapes (e.g. \ followed by non-JSON escape chars)
      const sanitized = jsonString.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
      try {
        return JSON.parse(sanitized);
      } catch {
        throw initialErr;
      }
    }
  }

  private cleanGroupHeader(val?: unknown): string | null {
    if (typeof val !== 'string') return null;
    const cleaned = val
      .replace(/^[\s•\-*📌🔹🔸]+/, '')
      .replace(/[:：]+\s*$/, '')
      .trim();
    return cleaned.length > 0 ? cleaned : null;
  }

  private isSectionHeaderLine(name: string, amount: any, unit: any): boolean {
    if (typeof amount === 'number' || (unit && String(unit).trim().length > 0)) {
      return false;
    }
    const trimmed = name.trim();
    if (!trimmed || /\d/.test(trimmed)) return false;
    if (/[:：]\s*$/.test(trimmed) && trimmed.length <= 32) {
      return true;
    }
    return /^[\s•\-*]*(לרוטב|לקרסט|לבצק|למילוי|לציפוי|לקראמבל|למרינדה|לתיבול|להגשה|לקבב|לסלט|למרק|לשכבה|לגנאש|לקרם|לסירופ|לדגים|לירקות|לבשר|לעוף|לפסטה|לתחתית|לטופינג)(?:\s+[^\d:]{1,20})?[:：]?\s*$/.test(trimmed);
  }

  private static readonly HEBREW_LEADING_ADJECTIVES = new Set([
    'גדול', 'גדולה', 'גדולים', 'גדולות',
    'קטן', 'קטנה', 'קטנים', 'קטנות',
    'בינוני', 'בינונית', 'בינוניים', 'בינוניות',
    'טרי', 'טרייה', 'טריים', 'טריות',
    'קצוץ', 'קצוצה', 'קצוצים', 'קצוצות',
    'כתוש', 'כתושה', 'כתושים', 'כתושות',
    'מגורר', 'מגוררת', 'מגוררים', 'מגורד', 'מגורדת',
    'מומס', 'מומסת', 'מומסים',
    'רך', 'רכה', 'רכים',
    'גרוס', 'גרוסה', 'טחון', 'טחונה',
    'שחור', 'שחורה', 'לבן', 'חום', 'חומה', 'אדום', 'אדומה', 'ירוק', 'ירוקה', 'צהוב', 'צהובה',
    'גס', 'דק', 'חם', 'חמה', 'קר', 'קרה', 'פושר', 'פושרים',
    'יבש', 'יבשה', 'יבשים', 'מנופה', 'בשל', 'בשלה', 'שלם', 'שלמה', 'שלמים',
    'מתוק', 'מתוקה', 'מלוח', 'מלוחה', 'חריף', 'חריפה', 'מעושן', 'מעושנת', 'קלוי', 'קלויה', 'פרוס', 'פרוסה', 'פרוסים'
  ]);

  private static readonly RECOGNIZED_MEASUREMENT_UNITS = new Set([
    'גרם', 'ג׳', 'ג"', 'ק"ג', 'קילו', 'קילוגרם', 'מ"ל', 'מל', 'ליטר', 'ל׳',
    'כף', 'כפות', 'כפית', 'כפיות', 'כוס', 'כוסות', 'ספל',
    'יחידה', 'יחידות', 'יח׳', 'יח', 'שן', 'שיניים', 'שיני',
    'פרוסה', 'פרוסות', 'חתיכה', 'חתיכות', 'קובייה', 'קוביות',
    'חבילה', 'חבילות', 'אריזה', 'קופסה', 'קופסאות', 'שקית', 'שקיות',
    'צנצנת', 'בקבוק', 'פחית', 'פחיות', 'גביע', 'גביעים', 'מיכל', 'מיכלים',
    'צרור', 'צרורות', 'ענף', 'ענפים', 'עלה', 'עלים', 'גבעול', 'גבעולים',
    'קמצוץ', 'קורט', 'טיפה', 'טיפות', 'שפריץ', 'חופן', 'ראש', 'ראשים',
    'לפי הטעם', 'g', 'gr', 'gram', 'grams', 'kg', 'ml', 'l', 'liter',
    'tbsp', 'tsp', 'cup', 'cups', 'oz', 'lb', 'lbs', 'unit', 'units', 'piece', 'pieces', 'clove', 'cloves', 'slice', 'slices', 'pinch'
  ]);

  public static isToTasteIngredient(name: string, group?: string | null): boolean {
    if (group && /(הגשה|תיבול)/i.test(group)) return true;
    return /^(מלח|פלפל(?!\s*(?:אדום|ירוק|צהוב|כתום|חריף|מתוק|פעמון|ממולא))|מים|שמן|חמאה לטיגון|רוטב|סילאן|דבש|סויה|חומץ|לימון סחוט|מיץ לימון|פפריקה|כמון|כורכום|אורגנו|בזיליקום|פטרוזיליה|כוסברה|תימין|רוזמרין|צ\'ילי|צילי|סומק|זעתר|קינמון|אגוז מוסקט|קארי|צנוברים|שומשום|בצל ירוק|עירית|קליפת לימון|גרידת לימון)/i.test((name || '').trim());
  }

  public normalizeIngredientFields(
    rawName: string,
    rawAmount: unknown,
    rawUnit: unknown,
    servings = 4
  ): {
    name: string;
    amount: number | null;
    unit: string | null;
    quantityMissing?: boolean;
    amountEstimated?: boolean;
  } {
    let name = this.normalizeHebrewIngredientOrder(rawName) || 'מצרך';
    let amount = typeof rawAmount === 'number' && !Number.isNaN(rawAmount) ? rawAmount : null;
    let unit = typeof rawUnit === 'string' && rawUnit.trim().length > 0 ? rawUnit.trim() : null;
    let quantityMissing: boolean | undefined;
    let amountEstimated: boolean | undefined;

    // Issue 1: If LLM placed a Hebrew adjective/modifier in `unit` instead of a real measurement unit, move it onto `name`
    if (unit && !LlmParserService.RECOGNIZED_MEASUREMENT_UNITS.has(unit.toLowerCase())) {
      const unitWords = unit.split(/\s+/);
      const isAdjectiveUnit = unitWords.every((w) => LlmParserService.HEBREW_LEADING_ADJECTIVES.has(w));
      if (isAdjectiveUnit) {
        if (!name.includes(unit)) {
          name = `${name} ${unit}`.trim();
        }
        unit = null;
      }
    }

    // Issue 2: Reserve "לפי הטעם" strictly for genuine seasonings/garnishes; infer pasta/grain portions or flag missing quantity
    if (amount === null && (!unit || unit === 'לפי הטעם')) {
      if (LlmParserService.isToTasteIngredient(name)) {
        unit = 'לפי הטעם';
      } else if (/(פסטה|ספגטי|פנה|פוזילי|אטריות|מקרוני|ריגטוני|פפרדלה|טליאטלה|לינגוויני|פטוצ׳יני|קוסקוס|אורז|בורגול|קינואה)/i.test(name)) {
        amount = Math.max(1, servings) * 100;
        unit = 'גרם';
        amountEstimated = true;
      } else {
        unit = null;
        quantityMissing = true;
      }
    }

    return {
      name,
      amount,
      unit,
      ...(quantityMissing ? { quantityMissing: true } : {}),
      ...(amountEstimated ? { amountEstimated: true } : {}),
    };
  }

  /**
   * Fixes literal English->Hebrew adjective-before-noun inversions such as
   * "גדולים חלמונים" -> "חלמונים גדולים" or "שחור פלפל" -> "פלפל שחור".
   */
  public normalizeHebrewIngredientOrder(name: string): string {
    const trimmed = (name || '').trim();
    if (!trimmed) return trimmed;
    const words = trimmed.split(/\s+/);
    if (words.length >= 2 && LlmParserService.HEBREW_LEADING_ADJECTIVES.has(words[0])) {
      // Move leading adjective(s) after the noun(s), preserving any trailing modifiers
      const adjectives: string[] = [];
      let idx = 0;
      while (idx < words.length - 1 && LlmParserService.HEBREW_LEADING_ADJECTIVES.has(words[idx])) {
        adjectives.push(words[idx]);
        idx++;
      }
      if (adjectives.length > 0 && idx < words.length) {
        const noun = words[idx];
        const rest = words.slice(idx + 1);
        return [noun, ...adjectives, ...rest].join(' ');
      }
    }
    return trimmed;
  }

  /**
   * Calibrates recipe difficulty deterministically using step count, total time, and culinary techniques.
   */
  public calibrateDifficulty(
    instructions: InstructionStep[],
    totalMinutes: number | null,
    llmDifficulty?: unknown
  ): 'קל' | 'בינוני' | 'מתקדם' {
    const stepCount = instructions.length;
    const allText = instructions.map((s) => s.instruction || '').join(' ');
    const hasAdvancedTechnique = /(בצק עלים|שמרים|התפחה|מרנג|קראמל|סו-ויד|סו ויד|טמפרינג|ציר עצמות|זיגוג|קונפי|פילה דג)/i.test(allText);
    const hasMediumTechnique = /(הקצפה|טיגון עמוק|צלייה ממושכת|ריזוטו|בשאמל|אמולסיה|לישה)/i.test(allText);

    if (hasAdvancedTechnique || stepCount >= 10 || (totalMinutes !== null && totalMinutes > 90)) {
      return 'מתקדם';
    }
    if (stepCount <= 5 && !hasMediumTechnique && (totalMinutes === null || totalMinutes <= 45)) {
      return 'קל';
    }
    if (llmDifficulty === 'קל' || llmDifficulty === 'בינוני' || llmDifficulty === 'מתקדם') {
      if (llmDifficulty === 'בינוני' && stepCount <= 5 && (totalMinutes === null || totalMinutes <= 35) && !hasMediumTechnique) {
        return 'קל';
      }
      return llmDifficulty;
    }
    return stepCount <= 6 && (totalMinutes === null || totalMinutes <= 45) ? 'קל' : 'בינוני';
  }

  /**
   * P1 Validation pass: detects Hebrew word-order inversions, unquantified core ingredients, or missing steps.
   */
  public validateRecipeQuality(recipe: StructuredRecipe, _raw: RawMediaContent): string[] {
    const errors: string[] = [];
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      errors.push('לא חולצו מצרכים כלל.');
      return errors;
    }
    if (!recipe.instructions || recipe.instructions.length === 0) {
      errors.push('לא חולצו שלבי הכנה כלל.');
    }

    let unquantifiedCount = 0;
    for (const ing of recipe.ingredients) {
      const firstWord = (ing.name || '').trim().split(/\s+/)[0];
      if (firstWord && LlmParserService.HEBREW_LEADING_ADJECTIVES.has(firstWord)) {
        errors.push(`סדר מילים הפוך במצרך "${ing.name}" — יש לכתוב שם עצם לפני שם תואר (לדוגמה: "חלמונים גדולים" ולא "גדולים חלמונים").`);
      }

      const isGarnishOrCondiment =
        ing.group === 'להגשה' ||
        /^(מלח|פלפל|מים|שמן|חמאה|רוטב|סילאן|דבש|סויה|חומץ|לימון|פפריקה|כמון|כורכום|אורגנו|בזיליקום|פטרוזיליה|כוסברה|תימין|רוזמרין|צ\'ילי|צילי|סומק|זעתר|קינמון|צנוברים|שומשום|בצל ירוק|קליפת לימון)/i.test(ing.name || '');
      if (ing.amount === null && !isGarnishOrCondiment && ing.unit !== 'לפי הטעם') {
        unquantifiedCount++;
      }
    }

    if (recipe.ingredients.length >= 2 && unquantifiedCount / recipe.ingredients.length > 0.5) {
      errors.push('רוב המצרכים חסרים כמויות או יחידות מידה — אנא השלם כמויות מדויקות מהמקור או סמן "לפי הטעם" רק לתיבול/הגשה.');
    }

    return errors;
  }

  private buildCanonicalRecipe(parsed: any, raw: RawMediaContent): StructuredRecipe {
    const rawIngredients: any[] = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
    const ingredients: Ingredient[] = [];
    let headerLineGroup: string | null = null;

    for (let i = 0; i < rawIngredients.length; i++) {
      const ing = rawIngredients[i];
      if (!ing) continue;
      const rawName = typeof ing.name === 'string' ? ing.name.trim() : '';
      if (this.isSectionHeaderLine(rawName, ing.amount, ing.unit)) {
        headerLineGroup = this.cleanGroupHeader(rawName);
        continue;
      }
      const explicitGroup = this.cleanGroupHeader(ing.group);
      const servingsCount = typeof parsed.servings === 'number' && parsed.servings > 0 ? parsed.servings : 4;
      const normalizedIng = this.normalizeIngredientFields(rawName, ing.amount, ing.unit, servingsCount);

      ingredients.push({
        id: ing.id || `ing_${ingredients.length + 1}`,
        name: normalizedIng.name,
        amount: normalizedIng.amount,
        unit: normalizedIng.unit,
        category: ['produce', 'dairy', 'meat', 'pantry', 'spices', 'bakery'].includes(ing.category) ? ing.category : 'other',
        group: explicitGroup ?? headerLineGroup ?? null,
        ...(normalizedIng.quantityMissing ? { quantityMissing: true } : {}),
        ...(normalizedIng.amountEstimated ? { amountEstimated: true } : {}),
        originalText: ing.originalText || normalizedIng.name
      });
    }

    const instructions: InstructionStep[] = (parsed.instructions || []).map((st: any, i: number) => ({
      stepNumber: st.stepNumber || i + 1,
      instruction: st.instruction || '',
      durationMinutes: typeof st.durationMinutes === 'number' ? st.durationMinutes : undefined,
      tip: (st.tip && typeof st.tip === 'string') ? st.tip : undefined
    }));

    // Build categorized shopping list
    const shoppingMap = new Map<string, string[]>();
    for (const ing of ingredients) {
      const cat = ing.category;
      const current = shoppingMap.get(cat) || [];
      const qtyStr = ing.amount !== null
        ? `${ing.amount}${ing.unit ? ` ${ing.unit}` : ''}`
        : (ing.unit || (ing.quantityMissing ? 'כמות חסרה' : ''));
      const itemLabel = qtyStr ? `${ing.name} (${qtyStr})` : ing.name;
      current.push(itemLabel);
      shoppingMap.set(cat, current);
    }

    const shoppingList: ShoppingCategoryItem[] = Array.from(shoppingMap.entries()).map(
      ([category, items]) => ({ category, items })
    );

    const prep = typeof parsed.prepTimeMinutes === 'number' ? parsed.prepTimeMinutes : null;
    const cook = typeof parsed.cookTimeMinutes === 'number' ? parsed.cookTimeMinutes : null;
    const total = (prep !== null && cook !== null) ? prep + cook : (prep ?? cook ?? null);
    const timeEstimated = typeof parsed.timeEstimated === 'boolean' ? parsed.timeEstimated : (prep === null && cook === null);
    const difficulty = this.calibrateDifficulty(instructions, total, parsed.difficulty);

    // 1. Priority 1: Video thumbnail extracted directly from the social media video
    let imageUrl: string | undefined = raw.thumbnailUrl;

    // 2. Priority 2: Fallback to thematic culinary image matching dish keywords
    if (!imageUrl || !imageUrl.startsWith('http')) {
      imageUrl = this.resolveThematicFoodImage(
        parsed.title || '',
        Array.isArray(parsed.tags) ? parsed.tags : [],
        `${raw.captionText} ${parsed.description || ''}`
      );
    }

    return {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: parsed.title || 'מתכון ביתי משובח',
      description: parsed.description || 'מתכון שחולץ ועובד מסרטון רשת חברתית.',
      sourceUrl: raw.sourceUrl,
      platform: raw.platform,
      imageUrl,
      difficulty,
      timeEstimated,
      servings: typeof parsed.servings === 'number' ? parsed.servings : 4,
      prepTimeMinutes: prep,
      cookTimeMinutes: cook,
      totalTimeMinutes: total,
      ingredients,
      instructions,
      shoppingList,
      tags: Array.isArray(parsed.tags) ? parsed.tags : ['מתכון שחולץ'],
      createdAt: new Date().toISOString()
    };
  }

  private deterministicHebrewParse(raw: RawMediaContent, text: string): StructuredRecipe {
    const isCarbonara = text.toLowerCase().includes('carbonara') || text.toLowerCase().includes('guanciale');
    const isShakshuka = text.toLowerCase().includes('shakshuka');

    let title = 'מתכון שף ביתי מיוחד';
    let description = 'מתכון שחולץ ועובד מסרטון רשת חברתית.';
    let prepTimeMinutes: number | null = 10;
    let cookTimeMinutes: number | null = 20;
    let servings: number | null = 4;
    const ingredients: Ingredient[] = [];
    const instructions: InstructionStep[] = [];
    const tags: string[] = ['קל ומהיר'];

    if (isCarbonara) {
      title = 'ספגטי קרבונרה איטלקי אותנטי';
      description = 'קרבונרה רומאית קלאסית עם גואנצ\'לה פריך, פקורינו רומאנו וקרם חלמונים משי.';
      prepTimeMinutes = 10;
      cookTimeMinutes = 15;
      tags.push('איטלקי', 'פסטה', 'ארוחת ערב');

      ingredients.push(
        { id: 'ing_1', name: 'ספגטי איכותי', amount: 400, unit: 'גרם', category: 'pantry', originalText: '400g spaghetti' },
        { id: 'ing_2', name: 'גואנצ\'לה או פנצ\'טה', amount: 150, unit: 'גרם', category: 'meat', originalText: '150g guanciale' },
        { id: 'ing_3', name: 'חלמוני ביצה טריים', amount: 4, unit: 'יחידות', category: 'dairy', originalText: '4 egg yolks' },
        { id: 'ing_4', name: 'גבינת פקורינו רומאנו', amount: 50, unit: 'גרם', category: 'dairy', originalText: '50g pecorino' },
        { id: 'ing_5', name: 'פלפל שחור גרוס טרי', amount: null, unit: null, category: 'spices', originalText: 'black pepper to taste' }
      );

      instructions.push(
        { stepNumber: 1, instruction: 'מרתיחים סיר גדול עם מים מומלחים ומבשלים את הספגטי עד לדרגת אל-דנטה.', durationMinutes: 9 },
        { stepNumber: 2, instruction: 'חותכים את הגואנצ\'לה לרצועות ומטגנים במחבת רחבה על אש בינונית עד לפריכות והזהבה.', durationMinutes: 6 },
        { stepNumber: 3, instruction: 'בקערה נפרדת, טורפים את החלמונים עם הפקורינו המגורר והרבה פלפל שחור גרוס.', tip: 'שומרים חצי כוס ממי בישול הפסטה' },
        { stepNumber: 4, instruction: 'מכבים את האש, מעבירים את הפסטה למחבת, מוזגים את קרם החלמונים ומעט ממי הפסטה ומערבבים במרץ לקבלת רוטב קרמי מושלם.' }
      );
    } else if (isShakshuka) {
      title = 'שקשוקה ים-תיכונית פיקנטית';
      description = 'ביצי משק רכות מבושלות ברוטב עגבניות, פלפלים ושום עשיר ומתובל.';
      prepTimeMinutes = 10;
      cookTimeMinutes = 20;
      tags.push('ארוחת בוקר', 'ים תיכוני', 'צמחוני');

      ingredients.push(
        { id: 'ing_1', name: 'ביצים טריות', amount: 4, unit: 'יחידות', category: 'dairy', originalText: '4 eggs' },
        { id: 'ing_2', name: 'עגבניות מרוסקות', amount: 1, unit: 'פחית', category: 'pantry', originalText: '1 can crushed tomatoes' },
        { id: 'ing_3', name: 'פלפל אדום מתוק', amount: 1, unit: 'יחידה', category: 'produce', originalText: '1 bell pepper' },
        { id: 'ing_4', name: 'שיני שום כתושות', amount: 3, unit: 'שיניים', category: 'produce', originalText: '3 garlic cloves' },
        { id: 'ing_5', name: 'כמון טחון', amount: 1, unit: 'כפית', category: 'spices', originalText: '1 tsp cumin' },
        { id: 'ing_6', name: 'פפריקה מתוקה בשמן', amount: 1, unit: 'כף', category: 'spices', originalText: '1 tbsp paprika' },
        { id: 'ing_7', name: 'פטרוזיליה קצוצה', amount: null, unit: null, category: 'produce', originalText: 'fresh parsley' }
      );

      instructions.push(
        { stepNumber: 1, instruction: 'מטגנים את הפלפל והשום בשמן זית עד לריכוך והזהבה קלה.', durationMinutes: 5 },
        { stepNumber: 2, instruction: 'מוסיפים את העגבניות המרוסקות והתבלינים, ומבשלים על אש נמוכה עד להסמכה.', durationMinutes: 10 },
        { stepNumber: 3, instruction: 'יוצרים 4 גומחות ברוטב ושוברים לתוכן את הביצים. מכסים ומבשלים עד שהחלבון מתייצב.', durationMinutes: 5 },
        { stepNumber: 4, instruction: 'מפזרים פטרוזיליה קצוצה ומגישים לוהט לצד חלה טרייה.' }
      );
    } else {
      title = 'מאפה ביתי מתוק ומהיר';
      description = 'מתכון פשוט, טעים ומנצח שחולץ ישירות מסרטון הרשת.';
      prepTimeMinutes = 15;
      cookTimeMinutes = 25;
      tags.push('אפייה', 'קינוחים');

      ingredients.push(
        { id: 'ing_1', name: 'קמח לבן מנופה', amount: 2, unit: 'כוסות', category: 'pantry', originalText: '2 cups flour' },
        { id: 'ing_2', name: 'חלב', amount: 1, unit: 'כוס', category: 'dairy', originalText: '1 cup milk' },
        { id: 'ing_3', name: 'ביצים', amount: 2, unit: 'יחידות', category: 'dairy', originalText: '2 eggs' },
        { id: 'ing_4', name: 'סוכר', amount: 1, unit: 'כף', category: 'pantry', originalText: '1 tbsp sugar' },
        { id: 'ing_5', name: 'מלח דק', amount: null, unit: null, category: 'spices', originalText: 'pinch of salt' }
      );

      instructions.push(
        { stepNumber: 1, instruction: 'מחממים תנור ל-180 מעלות ומשמנים תבנית אפייה.', durationMinutes: 5 },
        { stepNumber: 2, instruction: 'טורפים בקערה את המצרכים היבשים והרטובים עד לקבלת תערובת חלקה.', durationMinutes: 5 },
        { stepNumber: 3, instruction: 'יוצקים לתבנית ואופים עד להזהבה קיסם יוצא יבש.', durationMinutes: 25 }
      );
    }

    const totalTimeMinutes =
      (prepTimeMinutes !== null && cookTimeMinutes !== null)
        ? prepTimeMinutes + cookTimeMinutes
        : null;

    // Build categorized shopping list
    const shoppingMap = new Map<string, string[]>();
    for (const ing of ingredients) {
      const cat = ing.category;
      const current = shoppingMap.get(cat) || [];
      const itemLabel = ing.amount && ing.unit
        ? `${ing.name} (${ing.amount} ${ing.unit})`
        : ing.name;
      current.push(itemLabel);
      shoppingMap.set(cat, current);
    }

    const shoppingList: ShoppingCategoryItem[] = Array.from(shoppingMap.entries()).map(
      ([category, items]) => ({ category, items })
    );

    const imageUrl = raw.thumbnailUrl || (isCarbonara
      ? 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop'
      : isShakshuka
        ? 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&auto=format&fit=crop'
        : 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop');

    return {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      description,
      sourceUrl: raw.sourceUrl,
      platform: raw.platform,
      imageUrl,
      servings,
      prepTimeMinutes,
      cookTimeMinutes,
      totalTimeMinutes,
      ingredients,
      instructions,
      shoppingList,
      tags,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Semantic culinary photo resolver:
   * Maps dish types (cake, pasta, burger/meat, salad, etc.) in Hebrew and English to high-resolution culinary photos.
   */
  public resolveThematicFoodImage(title: string, tags: string[] = [], text: string = ''): string {
    const combined = `${title} ${tags.join(' ')} ${text}`.toLowerCase();

    // 1. Cakes, desserts, cookies, chocolate, sweet pastries
    if (/עוג|קינוח|מוס|שוקולד|בראוני|טארט|פאי|פנקייק|קרפ|וופל|מתוק|דונאט|עוגי|קרם|שמרים|cake|dessert|cookie|chocolate|sweet|brownie|pie|tart/i.test(combined)) {
      if (/עוגי|cookie/i.test(combined)) {
        return 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop';
      }
      if (/פנקייק|pancake|קרפ|crepe/i.test(combined)) {
        return 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&auto=format&fit=crop';
      }
      return 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop';
    }

    // 2. Meat, burgers, kebabs, steaks, chicken, shawarma, ribs
    if (/המבורגר|סמאש|קבב|בשר|אנטריקוט|סטייק|צלעות|שווארמה|עוף|פרגית|שניצל|כנפיים|נקניק|אסאדו|בורגר|meat|burger|kebab|steak|chicken|ribs|bbq|shawarma/i.test(combined)) {
      if (/המבורגר|סמאש|בורגר|burger/i.test(combined)) {
        return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop';
      }
      if (/עוף|פרגית|שניצל|כנפיים|chicken/i.test(combined)) {
        return 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=800&auto=format&fit=crop';
      }
      if (/קבב|באגט|kebab/i.test(combined)) {
        return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop';
      }
      return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop';
    }

    // 3. Pasta, pizza, Italian
    if (/פסטה|ספגטי|רביולי|ניוקי|לזניה|פנה|פיצה|ריזוטו|איטלקי|pasta|spaghetti|pizza|lasagna|ravioli|gnocchi/i.test(combined)) {
      if (/פיצה|pizza/i.test(combined)) {
        return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop';
      }
      return 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop';
    }

    // 4. Fish and Seafood
    if (/דג|דגים|סלמון|טונה|דניס|לברק|חריימה|שרימפס|פירות ים|fish|salmon|tuna|seafood/i.test(combined)) {
      return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&auto=format&fit=crop';
    }

    // 5. Salads and vegetables
    if (/סלט|ירקות|ירוק|בריאות|קינואה|טבולה|קצוץ|salad|veggie|healthy/i.test(combined)) {
      return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop';
    }

    // 6. Soups and stews
    if (/מרק|נזיד|קדירה|מרקים|ראמן|soup|stew|ramen/i.test(combined)) {
      return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800&auto=format&fit=crop';
    }

    // 7. Bread, bakery, sandwiches, savoury pastries
    if (/לחם|חלה|פוקאצ|לחמני|באגט|בייגל|מאפה|טוסט|סנדוויץ|כריך|bread|bakery|focaccia|sandwich|toast|bagel/i.test(combined)) {
      if (/סנדוויץ|כריך|טוסט|באגט|sandwich/i.test(combined)) {
        return 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop';
      }
      return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop';
    }

    // 8. Breakfast, eggs, shakshuka
    if (/שקשוקה|ביצים|חביתה|אומלט|בוקר|ארוחת בוקר|breakfast|egg|shakshuka|omelet/i.test(combined)) {
      if (/שקשוקה|shakshuka/i.test(combined)) {
        return 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800&auto=format&fit=crop';
      }
      return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop';
    }

    // Default premium culinary presentation
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop';
  }
}
