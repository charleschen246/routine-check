import type { Ingredient, IngredientCategory, IngredientFunction } from './types';

const CATEGORIES = new Set<IngredientCategory>([
  'humectant', 'occlusive', 'emollient', 'exfoliant', 'retinoid',
  'antioxidant', 'soothing', 'antimicrobial', 'sunscreen', 'preservative',
  'fragrance', 'other',
]);

// AHA/BHA/PHA aren't a field in the data, so the matcher resolves them
// against the small fixed sets of INCI names that belong to each class.
const SUB_CLASS_INCI: Record<'aha' | 'bha' | 'pha', Set<string>> = {
  aha: new Set(['glycolic acid', 'lactic acid', 'mandelic acid']),
  bha: new Set(['salicylic acid']),
  pha: new Set(['gluconolactone', 'lactobionic acid']),
};

const ACTIVE_CATEGORIES = new Set<IngredientCategory>([
  'exfoliant', 'retinoid', 'antioxidant', 'antimicrobial',
]);

const ACTIVE_FUNCTIONS = new Set<IngredientFunction>([
  'exfoliation_chemical', 'acne_treatment', 'anti_aging',
  'antioxidant', 'pigmentation',
]);

export function normalize(s: string): string {
  return s.toLowerCase().trim();
}

export function findIngredient(
  token: string,
  ingredients: Ingredient[],
): Ingredient | undefined {
  const target = normalize(token);
  for (const ing of ingredients) {
    if (normalize(ing.inci) === target) return ing;
    if (ing.aliases.some((a) => normalize(a) === target)) return ing;
  }
  return undefined;
}

export function identifyIngredients(
  inciList: string[],
  ingredients: Ingredient[],
): Ingredient[] {
  const found: Ingredient[] = [];
  const seen = new Set<string>();
  for (const token of inciList) {
    const match = findIngredient(token, ingredients);
    if (match && !seen.has(match.inci)) {
      found.push(match);
      seen.add(match.inci);
    }
  }
  return found;
}

export function matchesSelector(ing: Ingredient, selector: string): boolean {
  const sel = normalize(selector);
  if (sel === 'aha' || sel === 'bha' || sel === 'pha') {
    return SUB_CLASS_INCI[sel].has(normalize(ing.inci));
  }
  if (CATEGORIES.has(sel as IngredientCategory)) {
    return ing.category === sel;
  }
  if (normalize(ing.inci) === sel) return true;
  return ing.aliases.some((a) => normalize(a) === sel);
}

export function isActive(ing: Ingredient): boolean {
  if (ACTIVE_CATEGORIES.has(ing.category)) return true;
  return ing.function.some((f) => ACTIVE_FUNCTIONS.has(f));
}
