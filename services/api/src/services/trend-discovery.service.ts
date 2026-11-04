import { TrendingRecipe, TrendingResponse, StructuredRecipe } from '../shared/index.js';

export class TrendDiscoveryService {
  private static instance: TrendDiscoveryService;

  private cachedTrends: TrendingRecipe[] = [
    {
      id: 'trend-dubai-chocolate',
      rank: 1,
      title: 'שוקולד דובאי עם קרם פיסטוק וקדאיף קראנצ׳י',
      description: 'הטרנד הויראלי הכי גדול בעולם: טבלת שוקולד עבה במילוי שערות קדאיף פריכות בחמאה וקרם פיסטוק עשיר.',
      creator: '@fixdessertchocolatier',
      platform: 'tiktok',
      sourceUrl: 'https://www.tiktok.com/@fixdessertchocolatier/video/7382910481234567890',
      imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800&auto=format&fit=crop',
      viewsCount: '18.4M צפיות',
      likesCount: '2.1M לייקים',
      totalTimeMinutes: 25,
      category: 'קינוחים',
      tags: ['ויראלי', 'שוקולד', 'פיסטוק', 'דובאי', 'טיקטוק'],
      recipe: {
        id: 'rec-dubai-choc',
        title: 'שוקולד דובאי ויראלי עם קדאיף ופיסטוק',
        description: 'שוקולד מריר וחלב במילוי שערות קדאיף מטוגנות בחמאה עם מחית פיסטוק וטחינה גולמית.',
        sourceUrl: 'https://www.tiktok.com/@fixdessertchocolatier/video/7382910481234567890',
        platform: 'tiktok',
        imageUrl: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=800&auto=format&fit=crop',
        category: 'קינוחים',
        servings: 6,
        prepTimeMinutes: 15,
        cookTimeMinutes: 10,
        totalTimeMinutes: 25,
        ingredients: [
          { id: 'i1', name: 'שערות קדאיף קצוצות דק', amount: 150, unit: 'גרם', category: 'bakery', originalText: '150g shredded phyllo / kataifi dough' },
          { id: 'i2', name: 'חמאה מומסת לטיגון', amount: 40, unit: 'גרם', category: 'dairy', originalText: '40g melted butter' },
          { id: 'i3', name: 'מחית פיסטוק איכותית 100%', amount: 200, unit: 'גרם', category: 'pantry', originalText: '200g pistachio cream' },
          { id: 'i4', name: 'טחינה גולמית', amount: 1, unit: 'כף', category: 'pantry', originalText: '1 tbsp tahini' },
          { id: 'i5', name: 'שוקולד חלב איכותי', amount: 250, unit: 'גרם', category: 'pantry', originalText: '250g milk chocolate' },
          { id: 'i6', name: 'שוקולד מריר 60%', amount: 150, unit: 'גרם', category: 'pantry', originalText: '150g dark chocolate' }
        ],
        instructions: [
          { stepNumber: 1, instruction: 'קוצצים את שערות הקדאיף ומטגנים במחבת עם חמאה על אש בינונית עד לקבלת גוון זהוב-שחום וקראנצ׳י לחלוטין (כ-8 דקות). מצננים.', durationMinutes: 8 },
          { stepNumber: 2, instruction: 'מערבבים בקערה את הקדאיף המצונן עם מחית הפיסטוק וכף טחינה גולמית עד לקבלת מילוי סמיך ומרוכז.' },
          { stepNumber: 3, instruction: 'ממיסים את השוקולד המריר והחלב ויוצקים שכבה ראשונה בתחתית ובדפנות תבנית סיליקון לטבלאות שוקולד. מקפיאים 10 דקות להתייצבות.', durationMinutes: 10 },
          { stepNumber: 4, instruction: 'ממלאים את התבנית בקרם הפיסטוק והקדאיף, משטחים, ויוצקים מעל את יתרת השוקולד המומס. מקפיאים שעה, מחלצים ושוברים בהנאה!', durationMinutes: 60 }
        ],
        shoppingList: [
          { category: 'bakery', items: ['שערות קדאיף (150 גרם)'] },
          { category: 'dairy', items: ['חמאה (40 גרם)'] },
          { category: 'pantry', items: ['מחית פיסטוק (200 גרם)', 'טחינה גולמית', 'שוקולד חלב (250 גרם)', 'שוקולד מריר (150 גרם)'] }
        ],
        tags: ['שוקולד', 'פיסטוק', 'דובאי', 'ויראלי'],
        createdAt: new Date().toISOString()
      }
    },
    {
      id: 'trend-smash-baguette',
      rank: 2,
      title: 'באגט סמאש קבב קריספי עם סלט אבוקדו וחלפיניו',
      description: 'הלהיט שמשגע את האינסטגרם: קבב בקר מתובל נמעך ישירות על חצי באגט פריך, נצלה על פלאנצ׳ה לוהטת ומקבל רוטב חלפיניו חריף.',
      creator: '@israelifoodie',
      platform: 'instagram',
      sourceUrl: 'https://www.instagram.com/reel/DfSRWBFuroS/',
      imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop',
      viewsCount: '4.2M צפיות',
      likesCount: '310K לייקים',
      totalTimeMinutes: 20,
      category: 'בשר',
      tags: ['סמאש קבב', 'באגט', 'בשר', 'אינסטגרם', 'חריף'],
      recipe: {
        id: 'rec-smash-baguette',
        title: 'באגט סמאש קבב עסיסי עם סלט אבוקדו',
        description: 'באגט צרפתי פריך ממולא בבשר בקר טחון שנמעך ונצרב על מחבת פסים לוהטת.',
        sourceUrl: 'https://www.instagram.com/reel/DfSRWBFuroS/',
        platform: 'instagram',
        imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop',
        category: 'בשר',
        servings: 4,
        prepTimeMinutes: 10,
        cookTimeMinutes: 10,
        totalTimeMinutes: 20,
        ingredients: [
          { id: 'b1', name: 'בשר בקר טחון עם 20% שומן', amount: 500, unit: 'גרם', category: 'meat', originalText: '500g ground beef' },
          { id: 'b2', name: 'באגט טרי חתוך לאורכו', amount: 2, unit: 'יחידות', category: 'bakery', originalText: '2 fresh baguettes' },
          { id: 'b3', name: 'בצל סגול קצוץ דק', amount: 1, unit: 'יחידה', category: 'produce', originalText: '1 red onion chopped' },
          { id: 'b4', name: 'פטרוזיליה קצוצה', amount: 0.5, unit: 'צרור', category: 'produce', originalText: '1/2 bunch parsley' },
          { id: 'b5', name: 'אבוקדו בשל מעוך עם לימון', amount: 1, unit: 'יחידה', category: 'produce', originalText: '1 ripe avocado' },
          { id: 'b6', name: 'פלפל חלפיניו פרוס', amount: 1, unit: 'יחידה', category: 'produce', originalText: '1 jalapeno pepper sliced' },
          { id: 'b7', name: 'בהרט לקבב ומלח גס', amount: 1, unit: 'כפית', category: 'spices', originalText: '1 tsp baharat and salt' }
        ],
        instructions: [
          { stepNumber: 1, instruction: 'מתבלים את הבשר הטחון עם בצל, פטרוזיליה, בהרט ומלח ומערבבים קלות.' },
          { stepNumber: 2, instruction: 'מורחים שכבה דקה של בשר על החלק הפנימי של חצאי הבאגט תוך לחיצה והידוק חזק.' },
          { stepNumber: 3, instruction: 'מניחים את הבאגט עם צד הבשר ישירות על מחבת פסים לוהטת או פלאנצ׳ה עם מעט שמן ומועכים עם משקולת 4 דקות עד השחמה עמוקה.', durationMinutes: 4 },
          { stepNumber: 4, instruction: 'הופכים לצד הלחם לדקה לפריכות, מורחים סלט אבוקדו, מוסיפים חלפיניו וטחינה וסוגרים.' }
        ],
        shoppingList: [
          { category: 'meat', items: ['בשר בקר טחון (500 גרם)'] },
          { category: 'bakery', items: ['באגט טרי (2 יחידות)'] },
          { category: 'produce', items: ['בצל סגול', 'פטרוזיליה', 'אבוקדו', 'פלפל חלפיניו'] },
          { category: 'spices', items: ['בהרט לקבב', 'מלח גס'] }
        ],
        tags: ['קבב', 'באגט', 'סמאש', 'בשרי'],
        createdAt: new Date().toISOString()
      }
    },
    {
      id: 'trend-baked-feta-pasta',
      rank: 3,
      title: 'פסטה פטה צלויה בתנור עם עגבניות שרי ושום',
      description: 'המתכון שרוקן את מדפי הגבינה בעולם: גוש פטה אפוי במרכז תבנית עם שרי מתוקות, שמן זית ושום הנמסים לרוטב פסטה קטיפתי.',
      creator: '@feelgoodfoodie',
      platform: 'tiktok',
      sourceUrl: 'https://www.tiktok.com/@feelgoodfoodie/video/6922572123456789012',
      imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281093?w=800&auto=format&fit=crop',
      viewsCount: '12.8M צפיות',
      likesCount: '1.6M לייקים',
      totalTimeMinutes: 35,
      category: 'איטלקי',
      tags: ['פטה', 'פסטה', 'איטלקי', 'טיקטוק', 'קל להכנה'],
      recipe: {
        id: 'rec-feta-pasta',
        title: 'פסטה פטה צלויה וקרמית עם עגבניות שרי',
        description: 'פסטה קלה להכנה בתבנית אחת בתנור, רוטב גבינת פטה עשיר ושום ארומטי.',
        sourceUrl: 'https://www.tiktok.com/@feelgoodfoodie/video/6922572123456789012',
        platform: 'tiktok',
        imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281093?w=800&auto=format&fit=crop',
        category: 'איטלקי',
        servings: 4,
        prepTimeMinutes: 5,
        cookTimeMinutes: 30,
        totalTimeMinutes: 35,
        ingredients: [
          { id: 'f1', name: 'גבינת פטה כבשים שלמה', amount: 200, unit: 'גרם', category: 'dairy', originalText: '200g Greek feta block' },
          { id: 'f2', name: 'עגבניות שרי תמר מתוקות', amount: 500, unit: 'גרם', category: 'produce', originalText: '500g cherry tomatoes' },
          { id: 'f3', name: 'שמן זית כתית מעולה', amount: 0.25, unit: 'כוס', category: 'pantry', originalText: '1/4 cup extra virgin olive oil' },
          { id: 'f4', name: 'שיני שום כתושות', amount: 4, unit: 'שיניים', category: 'produce', originalText: '4 garlic cloves minced' },
          { id: 'f5', name: 'פסטה קצרה (פוזילי או פנה)', amount: 350, unit: 'גרם', category: 'pantry', originalText: '350g pasta' },
          { id: 'f6', name: 'עלי בזיליקום טריים', amount: 1, unit: 'חופן', category: 'produce', originalText: 'Fresh basil leaves' }
        ],
        instructions: [
          { stepNumber: 1, instruction: 'מניחים את עגבניות השרי בתבנית אפייה, יוצקים שמן זית, שום, מלח ופלפל ומערבבים.' },
          { stepNumber: 2, instruction: 'מניחים את גוש גבינת הפטה במרכז התבנית ומזלפים מעליה עוד מעט שמן זית ופתיתי צ׳ילי.' },
          { stepNumber: 3, instruction: 'אופים בתנור שחומם מראש ל-200 מעלות כ-30 דקות, עד שהעגבניות מתפוצצות והפטה מקבלת צבע זהוב.', durationMinutes: 30 },
          { stepNumber: 4, instruction: 'מועכים את הפטה והעגבניות למחית קרמית אחידה, מערבבים פנימה פסטה מבושלת ועלי בזיליקום קרועים.' }
        ],
        shoppingList: [
          { category: 'dairy', items: ['גבינת פטה כבשים (200 גרם)'] },
          { category: 'produce', items: ['עגבניות שרי (500 גרם)', 'שום', 'בזיליקום טרי'] },
          { category: 'pantry', items: ['שמן זית', 'פסטה פוזילי או פנה (350 גרם)'] }
        ],
        tags: ['פסטה', 'פטה', 'עגבניות', 'תנור'],
        createdAt: new Date().toISOString()
      }
    },
    {
      id: 'trend-salmon-rice-bowl',
      rank: 4,
      title: 'קערת סלמון קריספי עם אורז, אבוקדו ומיונז סריראצ׳ה',
      description: 'הטרנד של אמילי מריקו: סלמון אפוי מפורר עם אורז חם, קוביית קרח במיקרוגל, אבוקדו, סויה ומיונז יפני באצות נורי.',
      creator: '@emilymariko',
      platform: 'tiktok',
      sourceUrl: 'https://www.tiktok.com/@emilymariko/video/7012345678901234567',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop',
      viewsCount: '15.6M צפיות',
      likesCount: '2.4M לייקים',
      totalTimeMinutes: 10,
      category: 'מהיר',
      tags: ['סלמון', 'אורז', 'מהיר', 'אבוקדו', 'בריא'],
      recipe: {
        id: 'rec-salmon-bowl',
        title: 'קערת סלמון אסייתי מהירה עם אבוקדו ואצות',
        description: 'ארוחת צהריים מאוזנת וטעימה להפליא של סלמון מפורר על מצע אורז יסמין ואבוקדו.',
        sourceUrl: 'https://www.tiktok.com/@emilymariko/video/7012345678901234567',
        platform: 'tiktok',
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop',
        category: 'מהיר',
        servings: 1,
        prepTimeMinutes: 5,
        cookTimeMinutes: 5,
        totalTimeMinutes: 10,
        ingredients: [
          { id: 's1', name: 'פילה סלמון מבושל או אפוי', amount: 150, unit: 'גרם', category: 'meat', originalText: '1 cooked salmon fillet' },
          { id: 's2', name: 'אורז לבן או יסמין מבושל', amount: 1, unit: 'כוס', category: 'pantry', originalText: '1 cup cooked rice' },
          { id: 's3', name: 'רוטב סויה איכותי', amount: 1, unit: 'כף', category: 'pantry', originalText: '1 tbsp soy sauce' },
          { id: 's4', name: 'רוטב סריראצ׳ה ומיונז יפני (קיופי)', amount: 1, unit: 'כף', category: 'pantry', originalText: 'Sriracha and Kewpie mayo' },
          { id: 's5', name: 'חצי אבוקדו פרוס', amount: 0.5, unit: 'יחידה', category: 'produce', originalText: '1/2 avocado sliced' },
          { id: 's6', name: 'חבילת דפי אצות נורי קלויות', amount: 1, unit: 'חבילה', category: 'pantry', originalText: 'Seaweed snack sheets' }
        ],
        instructions: [
          { stepNumber: 1, instruction: 'מפוררים את פילה הסלמון בעזרת מזלג בצלחת עמוקה ומניחים מעליו את האורז.' },
          { stepNumber: 2, instruction: 'מניחים קוביית קרח במרכז, מכסים בנייר אפייה ומחממים במיקרוגל דקה לאידוי ורכות מושלמת.', durationMinutes: 1 },
          { stepNumber: 3, instruction: 'מוציאים את הקרח, מזלפים רוטב סויה, סריראצ׳ה ומיונז ומערבבים הכל יחד.' },
          { stepNumber: 4, instruction: 'מגישים לצד פרוסות אבוקדו טרי ואוכלים בעזרת דפי אצות נורי קראנצ׳יות!' }
        ],
        shoppingList: [
          { category: 'meat', items: ['פילה סלמון (150 גרם)'] },
          { category: 'pantry', items: ['אורז יסמין', 'רוטב סויה', 'סריראצ׳ה', 'מיונז', 'דפי אצות נורי'] },
          { category: 'produce', items: ['אבוקדו'] }
        ],
        tags: ['סלמון', 'אורז', 'מהיר', 'אבוקדו'],
        createdAt: new Date().toISOString()
      }
    },
    {
      id: 'trend-cucumber-salad',
      rank: 5,
      title: 'סלט מלפפונים קוריאני קראנצ׳י בצנצנת',
      description: 'הטרנד של לוגן ששיגע את הרשת: מלפפונים שלמים פרוסים דק במנדולינה, מעורבבים בשמן שומשום קלוי, רוטב צ׳ילי וסויה.',
      creator: '@logagm',
      platform: 'tiktok',
      sourceUrl: 'https://www.tiktok.com/@logagm/video/7391234567890123456',
      imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop',
      viewsCount: '9.3M צפיות',
      likesCount: '1.1M לייקים',
      totalTimeMinutes: 5,
      category: 'בריא',
      tags: ['מלפפונים', 'סלט', 'קוריאני', 'בריא', 'טיקטוק'],
      recipe: {
        id: 'rec-cucumber-salad',
        title: 'סלט מלפפונים אסייתי משוקשק',
        description: 'סלט מרענן, פריך ומלא אומאמי שמכינים ב-3 דקות בתוך מכל או צנצנת.',
        sourceUrl: 'https://www.tiktok.com/@logagm/video/7391234567890123456',
        platform: 'tiktok',
        imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop',
        category: 'בריא',
        servings: 2,
        prepTimeMinutes: 5,
        cookTimeMinutes: 0,
        totalTimeMinutes: 5,
        ingredients: [
          { id: 'c1', name: 'מלפפונים טריים ופריכים', amount: 3, unit: 'יחידות', category: 'produce', originalText: '3 Persian cucumbers' },
          { id: 'c2', name: 'שמן שומשום קלוי', amount: 1, unit: 'כף', category: 'pantry', originalText: '1 tbsp toasted sesame oil' },
          { id: 'c3', name: 'רוטב סויה בהיר', amount: 1.5, unit: 'כפות', category: 'pantry', originalText: '1.5 tbsp soy sauce' },
          { id: 'c4', name: 'שמן צ׳ילי קראנץ׳ חריף', amount: 1, unit: 'כפית', category: 'pantry', originalText: '1 tsp chili crunch' },
          { id: 'c5', name: 'גרגירי שומשום קלוי', amount: 1, unit: 'כף', category: 'spices', originalText: '1 tbsp toasted sesame seeds' },
          { id: 'c6', name: 'שן שום מגוררת דק', amount: 1, unit: 'שן', category: 'produce', originalText: '1 grated garlic clove' }
        ],
        instructions: [
          { stepNumber: 1, instruction: 'פורסים את המלפפונים לרצועות דקיקות ישירות לתוך קופסה עם מכסה או צנצנת זכוכית.' },
          { stepNumber: 2, instruction: 'מוסיפים שמן שומשום, סויה, שמן צ׳ילי חריף, שום מגורר וגרגירי שומשום קלוי.' },
          { stepNumber: 3, instruction: 'סוגרים היטב את המכסה ומשקשקים בעוצמה במשך 30 שניות עד שכל הפרוסות עטופות ברוטב המשגע. אוכלים מיד!' }
        ],
        shoppingList: [
          { category: 'produce', items: ['מלפפונים טריים', 'שום'] },
          { category: 'pantry', items: ['שמן שומשום קלוי', 'רוטב סויה', 'שמן צ׳ילי קראנץ׳'] },
          { category: 'spices', items: ['שומשום קלוי'] }
        ],
        tags: ['מלפפונים', 'סלט', 'אסייתי', 'דיאטטי'],
        createdAt: new Date().toISOString()
      }
    },
    {
      id: 'trend-microwave-mug-cake',
      rank: 6,
      title: 'עוגת לבה שוקולד עסיסית בספל ב-90 שניות',
      description: 'הקינוח הלילי המושלם מיוטיוב שורטס: עוגת שוקולד אישית ונימוחה עם לב שוקולד נוזלי שמכינים במיקרוגל בקלי קלות.',
      creator: '@quicktreats',
      platform: 'youtube',
      sourceUrl: 'https://www.youtube.com/shorts/microwave-cake-viral',
      imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop',
      viewsCount: '5.1M צפיות',
      likesCount: '480K לייקים',
      totalTimeMinutes: 5,
      category: 'קינוחים',
      tags: ['עוגה', 'שוקולד', 'מיקרוגל', 'יוטיוב', 'מתוק'],
      recipe: {
        id: 'rec-mug-cake',
        title: 'עוגת שוקולד לבה מהירה בספל',
        description: 'עוגת שוקולד חמה ועשירה עם מרכז שוקולד נמס שמוכנה תוך פחות מ-2 דקות.',
        sourceUrl: 'https://www.youtube.com/shorts/microwave-cake-viral',
        platform: 'youtube',
        imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop',
        category: 'קינוחים',
        servings: 1,
        prepTimeMinutes: 2,
        cookTimeMinutes: 2,
        totalTimeMinutes: 4,
        ingredients: [
          { id: 'm1', name: 'קמח לבן רגיל', amount: 3, unit: 'כפות', category: 'bakery', originalText: '3 tbsp all purpose flour' },
          { id: 'm2', name: 'קקאו איכותי מנופה', amount: 1.5, unit: 'כפות', category: 'pantry', originalText: '1.5 tbsp cocoa powder' },
          { id: 'm3', name: 'סוכר חום או לבן', amount: 2, unit: 'כפות', category: 'pantry', originalText: '2 tbsp sugar' },
          { id: 'm4', name: 'חלב (או משקה שיבולת שועל)', amount: 3, unit: 'כפות', category: 'dairy', originalText: '3 tbsp milk' },
          { id: 'm5', name: 'שמן קנולה או חמאה מומסת', amount: 1, unit: 'כף', category: 'pantry', originalText: '1 tbsp oil or melted butter' },
          { id: 'm6', name: 'קוביות שוקולד מריר או נוטלה', amount: 2, unit: 'קוביות', category: 'pantry', originalText: '2 chocolate squares or Nutella' }
        ],
        instructions: [
          { stepNumber: 1, instruction: 'בתוך ספל רחב מערבבים במזלג את הקמח, הקקאו, הסוכר וקורט מלח ואבקת אפייה.' },
          { stepNumber: 2, instruction: 'מוסיפים חלב ושמן ומערבבים לבלילה חלקה ללא גושים.' },
          { stepNumber: 3, instruction: 'דוחפים בעדינות 2 קוביות שוקולד או כפית נוטלה למרכז הבלילה.' },
          { stepNumber: 4, instruction: 'מחממים במיקרוגל בעוצמה גבוהה 70 עד 90 שניות. מגישים חם לצד כדור גלידה וניל!', durationMinutes: 1 }
        ],
        shoppingList: [
          { category: 'bakery', items: ['קמח'] },
          { category: 'pantry', items: ['קקאו', 'סוכר', 'שוקולד מריר או נוטלה'] },
          { category: 'dairy', items: ['חלב'] }
        ],
        tags: ['שוקולד', 'עוגה בספל', 'מיקרוגל'],
        createdAt: new Date().toISOString()
      }
    }
  ];

  public static getInstance(): TrendDiscoveryService {
    if (!TrendDiscoveryService.instance) {
      TrendDiscoveryService.instance = new TrendDiscoveryService();
    }
    return TrendDiscoveryService.instance;
  }

  /**
   * Retrieves trending culinary recipes with optional category and platform filters.
   */
  public async getTrends(category?: string, platform?: string, search?: string): Promise<TrendingResponse> {
    let results = [...this.cachedTrends];

    if (platform && platform !== 'all') {
      results = results.filter((t) => t.platform === platform);
    }

    if (category && category !== 'הכל' && category !== 'all') {
      if (category === 'ויראלי' || category === '🔥 ויראלי') {
        results = results.filter((t) => t.tags.includes('ויראלי'));
      } else {
        results = results.filter((t) => t.category === category || t.tags.includes(category));
      }
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.creator.toLowerCase().includes(q) ||
          t.tags.some((tag: string) => tag.toLowerCase().includes(q))
      );
    }

    return {
      trends: results,
      categories: ['הכל', '🔥 ויראלי', '🍫 קינוחים', '🥩 בשר', '🍝 איטלקי', '⚡ מהיר', '🥗 בריא'],
      platforms: ['all', 'tiktok', 'instagram', 'youtube'],
      lastUpdated: new Date().toISOString()
    };
  }
}
