import { describe, expect, it } from 'vitest';
import { analyze } from '@/lib/analyzer';
import { ingredients, conflictRules, gapRules } from '@/lib/data';
import { products, routines } from './fixtures/sample-routines';

function run(
  product: Parameters<typeof analyze>[0],
  routine: Parameters<typeof analyze>[1],
  prefs: Parameters<typeof analyze>[5] = {},
) {
  return analyze(product, routine, conflictRules, gapRules, ingredients, prefs);
}

describe('analyzer — §14 acceptance tests', () => {
  it('#1 empty routine + neutral product → neutral, no warnings, no gaps', () => {
    const r = run(products.neutralMoisturizer, routines.empty);
    expect(r.warnings).toEqual([]);
    expect(r.gap_fills).toEqual([]);
    expect(r.neutral).toBe(true);
  });

  it('#2 routine has niacinamide; viewing another niacinamide → redundancy warning', () => {
    const r = run(products.niacinamideDewDrops, routines.niacinamidePM);
    const niacinRedundancy = r.warnings.find(
      (w) => w.rule_id === 'multiple_niacinamide',
    );
    expect(niacinRedundancy).toBeDefined();
    expect(niacinRedundancy?.type).toBe('redundancy');
    expect(niacinRedundancy?.with_product).toContain('Niacinamide');
  });

  it('#3 tret PM + viewing BHA intended PM → retinoid + BHA same slot conflict', () => {
    const r = run(
      { ...products.paulasBHA, intended_slot: 'PM' },
      routines.tretPM,
    );
    const hit = r.warnings.find(
      (w) => w.rule_id === 'retinoid_bha_same_slot',
    );
    expect(hit).toBeDefined();
    expect(hit?.type).toBe('conflict');
  });

  it('#4 tret PM + BHA AM in vault; viewing BHA intended AM → no retinoid+BHA conflict', () => {
    const r = run(
      { ...products.paulasBHA, intended_slot: 'AM' },
      routines.tretPMplusBHA_AM,
    );
    const hit = r.warnings.find(
      (w) => w.rule_id === 'retinoid_bha_same_slot',
    );
    expect(hit).toBeUndefined();
  });

  it('#5 adapalene + benzoyl peroxide in routine → synergy suppresses retinoid+BP conflict', () => {
    const r = run(products.neutralMoisturizer, routines.adapalenePMplusBPPM);
    const hit = r.warnings.find(
      (w) => w.rule_id === 'retinoid_benzoyl_peroxide_same_slot',
    );
    expect(hit).toBeUndefined();
  });

  it('#6 routine has 3 products no SPF; viewing sunscreen → AM SPF gap fill', () => {
    const r = run(products.sunscreen, routines.threeNoSPF);
    const hit = r.gap_fills.find((g) => g.rule_id === 'missing_spf_am');
    expect(hit).toBeDefined();
  });

  it('#7 retinol PM + glycolic PM; viewing vitamin C intended AM → no same-slot conflicts with C', () => {
    const r = run(
      { ...products.vitaminCSerum, intended_slot: 'AM' },
      routines.retinolPMplusGlycolicPM,
    );
    const cRetinoid = r.warnings.find(
      (w) => w.rule_id === 'ascorbic_acid_retinoid_same_slot',
    );
    const cAHA = r.warnings.find(
      (w) => w.rule_id === 'ascorbic_acid_aha_same_slot',
    );
    expect(cRetinoid).toBeUndefined();
    expect(cAHA).toBeUndefined();
  });

  it('#8 empty routine + basic glycerin/ceramide moisturizer → neutral', () => {
    const r = run(products.neutralMoisturizer, routines.empty);
    expect(r.neutral).toBe(true);
  });

  it('#9 vitamin C AM + viewing niacinamide → NO conflict (debunked myth guard)', () => {
    const r = run(products.niacinamideOnly, routines.vitaminCAM);
    expect(r.warnings).toEqual([]);
  });

  it('#10 two niacinamide products in routine + third niacinamide product → redundancy with severity escalated to medium', () => {
    const r = run(products.niacinamideOnly, routines.twoNiacinamide);
    const hit = r.warnings.find((w) => w.rule_id === 'multiple_niacinamide');
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe('medium');
  });

  it('#11 empty routine + product with retinol + AHA in one ingredient list → in-product conflict', () => {
    const r = run(products.retinolPlusAHA, routines.empty);
    const hit = r.warnings.find(
      (w) => w.rule_id === 'retinoid_aha_same_slot',
    );
    expect(hit).toBeDefined();
  });

  it('#12 routine with 4 actives no barrier; viewing ceramide moisturizer → barrier gap fill', () => {
    const r = run(products.ceramideMoisturizer, routines.fourActivesNoBarrier);
    const hit = r.gap_fills.find(
      (g) => g.rule_id === 'missing_barrier_when_multi_active',
    );
    expect(hit).toBeDefined();
  });

  it('#13 routine has cleanser, moisturizer, SPF, niacinamide; viewing paraben product → no warnings (credibility guard)', () => {
    const r = run(products.parabenProduct, routines.fullCleanMoistSPFNiac);
    expect(r.warnings).toEqual([]);
    expect(r.gap_fills).toEqual([]);
  });

  it('#14 two AHAs PM in routine + viewing third AHA → multiple-AHA conflict, severity medium', () => {
    const r = run(products.mandelicAHA, routines.twoAHAsPM);
    const hit = r.warnings.find(
      (w) => w.rule_id === 'multiple_ahas_same_slot',
    );
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe('medium');
  });

  it('#15 brand-new install: empty routine, no prefs → neutral result', () => {
    const r = run(products.neutralMoisturizer, routines.empty, {});
    expect(r.warnings).toEqual([]);
    expect(r.gap_fills).toEqual([]);
    expect(r.neutral).toBe(true);
  });
});
