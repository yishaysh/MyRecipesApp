import { z } from 'zod';

export const IngredientCategorySchema = z.enum([
  'produce',
  'dairy',
  'meat',
  'pantry',
  'spices',
  'bakery',
  'other'
]);

export const RecipePlatformSchema = z.enum([
  'instagram',
  'tiktok',
  'facebook',
  'youtube',
  'web'
]);

export const IngredientSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).substring(2, 9)),
  name: z.string().min(1),
  amount: z.number().nullable().default(null),
  unit: z.string().nullable().default(null),
  category: IngredientCategorySchema.default('other'),
  group: z.string().nullable().optional(),
  originalText: z.string().min(1)
});

export const InstructionStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  instruction: z.string().min(1),
  durationMinutes: z.number().positive().nullable().optional(),
  tip: z.string().nullable().optional()
});

export const ShoppingCategoryItemSchema = z.object({
  category: z.string(),
  items: z.array(z.string())
});

export const StructuredRecipeSchema = z.object({
  id: z.string().default(() => 'rec_' + Math.random().toString(36).substring(2, 11)),
  title: z.string().min(1),
  description: z.string().default(''),
  sourceUrl: z.string().url(),
  platform: RecipePlatformSchema.default('web'),
  imageUrl: z.string().url().nullable().optional(),
  category: z.string().nullable().optional(),
  isBookmarked: z.boolean().default(false),
  servings: z.number().int().positive().nullable().default(null),
  prepTimeMinutes: z.number().int().nonnegative().nullable().default(null),
  cookTimeMinutes: z.number().int().nonnegative().nullable().default(null),
  totalTimeMinutes: z.number().int().nonnegative().nullable().default(null),
  difficulty: z.string().nullable().optional(),
  timeEstimated: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  isUserEdited: z.boolean().optional(),
  cookCount: z.number().int().nonnegative().optional(),
  lastCookedAt: z.string().nullable().optional(),
  ingredients: z.array(IngredientSchema).min(1),
  instructions: z.array(InstructionStepSchema).min(1),
  shoppingList: z.array(ShoppingCategoryItemSchema).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().default(() => new Date().toISOString()),
  updatedAt: z.string().optional()
});

export const ParseRecipeRequestSchema = z.object({
  sourceUrl: z.preprocess((val) => {
    if (typeof val === 'string') {
      const match = val.match(/https?:\/\/[^\s"'<>]+/i);
      return match ? match[0] : val.trim();
    }
    return val;
  }, z.string().url({ message: 'Must be a valid URL' })),
  userId: z.string().optional()
});

export type IngredientSchemaType = z.infer<typeof IngredientSchema>;
export type InstructionStepSchemaType = z.infer<typeof InstructionStepSchema>;
export type StructuredRecipeSchemaType = z.infer<typeof StructuredRecipeSchema>;
export type ParseRecipeRequestSchemaType = z.infer<typeof ParseRecipeRequestSchema>;
