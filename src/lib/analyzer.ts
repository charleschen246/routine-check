import type {
  AnalysisGapFill,
  AnalysisResult,
  AnalysisWarning,
  ConflictRule,
  GapRule,
  Ingredient,
  RoutineEntry,
  UserPreferences,
} from './types';
import {
  identifyIngredients,
  isActive,
  matchesSelector,
} from './ingredients';

export interface AnalyzeProductInput {
  name: string;
  brand: string;
  sku: string;
  ingredients_inci: string[];
  // Slot the user intends to use this product in. Unknown when scraping a
  // Sephora page; defaults to 'either' which makes same_slot_only rules
  // conservatively fire against any routine slot.
  intended_slot?: 'AM' | 'PM' | 'both' | 'either';
}

type Slot = 'AM' | 'PM' | 'both' | 'either';

interface IngredientInstance {
  ingredient: Ingredient;
  source: 'product' | 'routine';
  slot: Slot;
  routineEntry?: RoutineEntry;
}

function slotsOverlap(a: Slot, b: Slot): boolean {
  if (a === 'either' || b === 'either') return true;
  if (a === 'both' || b === 'both') return true;
  return a === b;
}

function pairIsSuppressed(
  a: IngredientInstance,
  b: IngredientInstance,
  synergies: ConflictRule[],
): boolean {
  for (const syn of synergies) {
    const direct =
      matchesSelector(a.ingredient, syn.ingredient_a) &&
      matchesSelector(b.ingredient, syn.ingredient_b);
    const reverse =
      matchesSelector(a.ingredient, syn.ingredient_b) &&
      matchesSelector(b.ingredient, syn.ingredient_a);
    if (direct || reverse) return true;
  }
  return false;
}

function countRoutineActives(
  routine: RoutineEntry[],
  ingredients: Ingredient[],
): number {
  let count = 0;
  for (const entry of routine) {
    const found = identifyIngredients(entry.ingredients_inci, ingredients);
    if (found.some(isActive)) count++;
  }
  return count;
}

export function analyze(
  product: AnalyzeProductInput,
  routine: RoutineEntry[],
  rules: ConflictRule[],
  gapRules: GapRule[],
  ingredients: Ingredient[],
  prefs: UserPreferences = {},
): AnalysisResult {
  const productIngredients = identifyIngredients(
    product.ingredients_inci,
    ingredients,
  );
  const productSlot: Slot = product.intended_slot ?? 'either';

  const instances: IngredientInstance[] = productIngredients.map((ing) => ({
    ingredient: ing,
    source: 'product',
    slot: productSlot,
  }));
  for (const entry of routine) {
    const found = identifyIngredients(entry.ingredients_inci, ingredients);
    for (const ing of found) {
      instances.push({
        ingredient: ing,
        source: 'routine',
        slot: entry.slot,
        routineEntry: entry,
      });
    }
  }

  const synergies = rules.filter((r) => r.type === 'synergy');
  const warnings: AnalysisWarning[] = [];
  const firedRuleIds = new Set<string>();

  // MULTI_ACTIVE sentinel — count distinct actives per concrete slot bucket.
  for (const rule of rules) {
    if (rule.ingredient_a !== 'MULTI_ACTIVE') continue;
    for (const bucket of ['AM', 'PM'] as const) {
      const inSlot = instances.filter(
        (i) => slotsOverlap(i.slot, bucket) && isActive(i.ingredient),
      );
      const distinctInci = new Set(inSlot.map((i) => i.ingredient.inci));
      if (distinctInci.size >= 3) {
        warnings.push({
          rule_id: rule.id,
          type: 'caution',
          severity: rule.severity,
          short_message: rule.short_message,
          long_explanation: rule.long_explanation,
          sources: rule.sources,
        });
        firedRuleIds.add(rule.id);
        break;
      }
    }
  }

  // Standard pair-based rules.
  for (const rule of rules) {
    if (rule.type === 'synergy') continue;
    if (rule.ingredient_a === 'MULTI_ACTIVE') continue;
    if (firedRuleIds.has(rule.id)) continue;

    const aMatches = instances.filter((i) =>
      matchesSelector(i.ingredient, rule.ingredient_a),
    );
    const bMatches = instances.filter((i) =>
      matchesSelector(i.ingredient, rule.ingredient_b),
    );

    let fired = false;
    let withProduct: string | undefined;

    outer: for (const a of aMatches) {
      for (const b of bMatches) {
        if (a === b) continue;
        if (rule.same_slot_only && !slotsOverlap(a.slot, b.slot)) continue;
        if (pairIsSuppressed(a, b, synergies)) continue;

        fired = true;
        const routineSide =
          a.source === 'routine' ? a : b.source === 'routine' ? b : undefined;
        if (routineSide?.routineEntry) {
          withProduct = routineSide.routineEntry.name;
        }
        break outer;
      }
    }

    if (!fired) continue;

    // Severity escalation: a redundancy rule that matches the same selector
    // on both sides (multiple_niacinamide, multiple_hyaluronic_acid, etc.)
    // gets bumped to medium once two or more routine products already
    // contain the ingredient.
    let severity = rule.severity;
    if (
      rule.type === 'redundancy' &&
      normalize(rule.ingredient_a) === normalize(rule.ingredient_b)
    ) {
      const routineMatches = instances.filter(
        (i) =>
          i.source === 'routine' &&
          matchesSelector(i.ingredient, rule.ingredient_a),
      ).length;
      if (routineMatches >= 2 && severity === 'low') severity = 'medium';
    }

    const warningType: AnalysisWarning['type'] =
      rule.type === 'conflict'
        ? 'conflict'
        : rule.type === 'redundancy'
          ? 'redundancy'
          : 'caution';

    warnings.push({
      rule_id: rule.id,
      type: warningType,
      severity,
      with_product: withProduct,
      short_message: rule.short_message,
      long_explanation: rule.long_explanation,
      sources: rule.sources,
    });
    firedRuleIds.add(rule.id);
  }

  // Gap fills — only when the routine has at least 3 products, to avoid
  // spamming users mid-onboarding.
  const gap_fills: AnalysisGapFill[] = [];
  if (routine.length >= 3) {
    const routineActiveCount = countRoutineActives(routine, ingredients);

    for (const gap of gapRules) {
      if (gap.condition) {
        const [key, value] = gap.condition.split(':');
        if (key === 'routine_active_count_gte') {
          if (routineActiveCount < parseInt(value, 10)) continue;
        } else if (key === 'user_preference') {
          if (!prefs[value as keyof UserPreferences]) continue;
        }
      }

      const routineHasFunction = routine.some((entry) => {
        if (
          gap.slot !== 'either' &&
          entry.slot !== gap.slot &&
          entry.slot !== 'both'
        ) {
          return false;
        }
        const found = identifyIngredients(entry.ingredients_inci, ingredients);
        return found.some((i) => i.function.includes(gap.required_function));
      });
      if (routineHasFunction) continue;

      const productHasFunction = productIngredients.some((i) =>
        i.function.includes(gap.required_function),
      );
      if (!productHasFunction) continue;

      gap_fills.push({
        rule_id: gap.id,
        function: gap.required_function,
        message: gap.message,
      });
    }
  }

  const detected_actives = productIngredients
    .filter(isActive)
    .map((i) => ({ inci: i.inci, function: i.function }));

  return {
    product: {
      name: product.name,
      brand: product.brand,
      sku: product.sku,
    },
    detected_actives,
    warnings,
    gap_fills,
    neutral: warnings.length === 0 && gap_fills.length === 0,
  };
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}
