// Shared types for the extension. Mirrors PROJECT_BRIEF.md §7 with two
// documented deviations (see HANDOFF.md):
//   - `cleanser` is added to IngredientFunction so the missing-cleanser
//     gap rule from §8d can be expressed as a function.
//   - GapRule has an optional `condition` field for the §8d qualifiers
//     ("if 2+ actives", "if user opts into anti-aging").

export type IngredientFunction =
  | 'hydration'
  | 'barrier_repair'
  | 'exfoliation_chemical'
  | 'pigmentation'
  | 'anti_aging'
  | 'acne_treatment'
  | 'antioxidant'
  | 'soothing'
  | 'sun_protection'
  | 'cleanser';

export type IngredientCategory =
  | 'humectant'
  | 'occlusive'
  | 'emollient'
  | 'exfoliant'
  | 'retinoid'
  | 'antioxidant'
  | 'soothing'
  | 'antimicrobial'
  | 'sunscreen'
  | 'preservative'
  | 'fragrance'
  | 'other';

export interface Ingredient {
  inci: string;
  aliases: string[];
  function: IngredientFunction[];
  category: IngredientCategory;
  typical_pct_range?: [number, number];
  comedogenic_rating?: 0 | 1 | 2 | 3 | 4 | 5;
  notes?: string;
  sources: string[];
}

export type RuleType = 'conflict' | 'redundancy' | 'synergy' | 'caution';
export type Severity = 'low' | 'medium' | 'high';

export interface ConflictRule {
  id: string;
  ingredient_a: string;
  ingredient_b: string;
  type: RuleType;
  same_slot_only: boolean;
  severity: Severity;
  short_message: string;
  long_explanation: string;
  sources: string[];
}

export interface GapRule {
  id: string;
  required_function: IngredientFunction;
  slot: 'AM' | 'PM' | 'either';
  severity: Severity;
  message: string;
  condition?: string;
}

export interface RoutineEntry {
  id: string;
  name: string;
  brand?: string;
  slot: 'AM' | 'PM' | 'both';
  ingredients_inci: string[];
  added_at: number;
}

export interface UserPreferences {
  acne_prone?: boolean;
  pigmentation?: boolean;
  anti_aging?: boolean;
  sensitivity?: boolean;
  dryness?: boolean;
}

export interface ExtractedProduct {
  name: string;
  brand: string;
  sku: string;
  ingredients_inci: string[];
}

export interface DetectedActive {
  inci: string;
  function: IngredientFunction[];
}

export interface AnalysisWarning {
  rule_id: string;
  type: 'conflict' | 'redundancy' | 'caution';
  severity: Severity;
  with_product?: string;
  short_message: string;
  long_explanation: string;
  sources: string[];
}

export interface AnalysisGapFill {
  rule_id: string;
  function: IngredientFunction;
  message: string;
}

export interface AnalysisResult {
  product: { name: string; brand: string; sku: string };
  detected_actives: DetectedActive[];
  warnings: AnalysisWarning[];
  gap_fills: AnalysisGapFill[];
  neutral: boolean;
}
