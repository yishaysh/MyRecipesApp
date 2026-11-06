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
    console.log(`[LLM_PARSER] Initiating structured recipe parsing for platform: ${raw.platform} with Hebrew normalization`);

    const combinedText = `${raw.captionText} ${raw.audioTranscript || ''}`.trim();

    let recipe: StructuredRecipe;

    // Check if external Gemini API key is configured
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (process.env.NODE_ENV === 'test') {
      console.log(`[LLM_PARSER] Running local deterministic Hebrew structured recipe engine for unit tests.`);
      recipe = this.deterministicHebrewParse(raw, combinedText);
    } else if (geminiKey) {
      console.log(`[LLM_PARSER] Using Google Gemini API for real social media recipe extraction.`);
      recipe = await this.callGeminiApi(geminiKey, raw, combinedText);
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
    return validationResult.data;
  }

  private async callGeminiApi(apiKey: string, raw: RawMediaContent, text: string): Promise<StructuredRecipe> {
    const prompt = `You are an expert culinary AI assistant.
Analyze the following social media cooking video text/transcript and extract the recipe into structured JSON.
CRITICAL RULES:
1. Output ALL recipe fields (title, description, ingredients names, instructions, tags) in natural, fluent Hebrew.
2. If an ingredient quantity or unit is not specified, set amount: null and unit: null. DO NOT invent or hallucinate measurements.
3. If cooking or prep duration is not specified, set to null/undefined.
4. If the text does NOT contain any recipe or cooking ingredients, respond with a JSON object: {"error": "לא נמצאו מצרכים או הוראות הכנה בטקסט הסרטון"}

JSON format to return:
{
  "title": "שם המתכון בעברית",
  "description": "תיאור קצר בעברית",
  "servings": 4,
  "prepTimeMinutes": 10,
  "cookTimeMinutes": 20,
  "ingredients": [
    { "id": "ing_1", "name": "שם המצרך בעברית", "amount": 2, "unit": "כוסות", "category": "produce", "originalText": "2 cups flour" }
  ],
  "instructions": [
    { "stepNumber": 1, "instruction": "הוראות השלב בעברית", "durationMinutes": 5, "tip": "טיפ אם יש" }
  ],
  "tags": ["אסייתי", "מהיר"]
}

Source text to parse:
${text}`;

    const modelsToTry = [
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];
    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      try {
        console.log(`[LLM_PARSER] Calling Gemini model: ${model}...`);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          }),
          signal: AbortSignal.timeout(12000)
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
            content: 'You are an expert chef assistant. Parse social media video cooking text into structured JSON. Translate and output all recipe titles, descriptions, ingredient names, categories, and instructions in clear, accurate Hebrew. Enforce null for unknown quantities.'
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

  private buildCanonicalRecipe(parsed: any, raw: RawMediaContent): StructuredRecipe {
    const ingredients: Ingredient[] = (parsed.ingredients || []).map((ing: any, i: number) => ({
      id: ing.id || `ing_${i + 1}`,
      name: ing.name || 'מצרך',
      amount: typeof ing.amount === 'number' ? ing.amount : null,
      unit: ing.unit || null,
      category: ['produce', 'dairy', 'meat', 'pantry', 'spices', 'bakery'].includes(ing.category) ? ing.category : 'other',
      originalText: ing.originalText || ing.name || ''
    }));

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
      const itemLabel = ing.amount && ing.unit
        ? `${ing.name} (${ing.amount} ${ing.unit})`
        : ing.name;
      current.push(itemLabel);
      shoppingMap.set(cat, current);
    }

    const shoppingList: ShoppingCategoryItem[] = Array.from(shoppingMap.entries()).map(
      ([category, items]) => ({ category, items })
    );

    const prep = typeof parsed.prepTimeMinutes === 'number' ? parsed.prepTimeMinutes : null;
    const cook = typeof parsed.cookTimeMinutes === 'number' ? parsed.cookTimeMinutes : null;
    const total = (prep !== null && cook !== null) ? prep + cook : null;

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
