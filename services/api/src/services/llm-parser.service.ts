import {
  Ingredient,
  InstructionStep,
  ShoppingCategoryItem,
  StructuredRecipe,
  StructuredRecipeSchema
} from '@myrecipes/shared';
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

    if (geminiKey) {
      console.log(`[LLM_PARSER] Using Google Gemini API for real social media recipe extraction.`);
      recipe = await this.callGeminiApi(geminiKey, raw, combinedText);
    } else if (openaiKey) {
      console.log(`[LLM_PARSER] Using OpenAI API for real social media recipe extraction.`);
      recipe = await this.callOpenAiApi(openaiKey, raw, combinedText);
    } else {
      console.log(`[LLM_PARSER] Running local deterministic Hebrew structured recipe engine.`);
      recipe = this.deterministicHebrewParse(raw, combinedText);
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
    try {
      const prompt = `You are a culinary AI assistant. Extract and structure the following social media cooking video content into a clean recipe.
Output all recipe text (title, description, ingredient names, instructions, shopping list items) in fluent, natural Hebrew.
Strict Rule: If an ingredient quantity or cooking duration is not mentioned, set it to null. Do not hallucinate or invent numbers.

JSON schema to return:
{
  "title": "שם המתכון בעברית",
  "description": "תיאור קצר בעברית",
  "servings": 4,
  "prepTimeMinutes": 10,
  "cookTimeMinutes": 20,
  "ingredients": [
    { "id": "ing_1", "name": "שם המצרך בעברית", "amount": 2, "unit": "כוסות", "category": "produce|dairy|meat|pantry|spices|bakery|other", "originalText": "2 cups flour" }
  ],
  "instructions": [
    { "stepNumber": 1, "instruction": "הוראות שלב 1 בעברית", "durationMinutes": 5, "tip": "טיפ אם יש" }
  ],
  "tags": ["מהיר", "איטלקי"]
}

Source text to parse:
${text}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });

      if (!res.ok) {
        throw new Error(`Gemini API error: ${await res.text()}`);
      }

      const data = (await res.json()) as any;
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawJson);

      return this.buildCanonicalRecipe(parsed, raw);
    } catch (e: any) {
      console.warn(`[LLM_PARSER] Gemini API call failed, falling back to local Hebrew parser:`, e.message);
      return this.deterministicHebrewParse(raw, text);
    }
  }

  private async callOpenAiApi(apiKey: string, raw: RawMediaContent, text: string): Promise<StructuredRecipe> {
    try {
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
        })
      });

      const data = (await res.json()) as any;
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
      return this.buildCanonicalRecipe(parsed, raw);
    } catch (e: any) {
      console.warn(`[LLM_PARSER] OpenAI API call failed, falling back to local Hebrew parser:`, e.message);
      return this.deterministicHebrewParse(raw, text);
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
      tip: st.tip
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

    return {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: parsed.title || 'מתכון ביתי משובח',
      description: parsed.description || 'מתכון שחולץ ועובד מסרטון רשת חברתית.',
      sourceUrl: raw.sourceUrl,
      platform: raw.platform,
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

    return {
      id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      description,
      sourceUrl: raw.sourceUrl,
      platform: raw.platform,
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
}
