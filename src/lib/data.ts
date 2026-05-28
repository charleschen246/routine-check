import ingredientsJson from '@/data/ingredients.json';
import conflictRulesJson from '@/data/conflict-rules.json';
import gapRulesJson from '@/data/gap-rules.json';
import type { Ingredient, ConflictRule, GapRule } from './types';

export const ingredients: Ingredient[] = ingredientsJson as Ingredient[];
export const conflictRules: ConflictRule[] = conflictRulesJson as ConflictRule[];
export const gapRules: GapRule[] = gapRulesJson as GapRule[];
