import type { RoutineEntry } from '@/lib/types';

let nextId = 0;
function entry(
  name: string,
  slot: 'AM' | 'PM' | 'both',
  inci: string[],
  brand?: string,
): RoutineEntry {
  return {
    id: `r-${++nextId}`,
    name,
    brand,
    slot,
    ingredients_inci: inci,
    added_at: 0,
  };
}

export const routines = {
  empty: [] as RoutineEntry[],

  niacinamidePM: [
    entry('The Ordinary Niacinamide 10% + Zinc 1%', 'PM', [
      'Niacinamide',
      'Zinc PCA',
      'Glycerin',
    ]),
  ],

  tretPM: [
    entry('Generic Tretinoin 0.025%', 'PM', ['Tretinoin']),
  ],

  tretPMplusBHA_AM: [
    entry('Generic Tretinoin 0.025%', 'PM', ['Tretinoin']),
    entry("Paula's Choice 2% BHA Liquid", 'AM', ['Salicylic Acid', 'Water']),
  ],

  adapalenePMplusBPPM: [
    entry('Differin Gel', 'PM', ['Adapalene']),
    entry('Generic BP 2.5%', 'PM', ['Benzoyl Peroxide']),
  ],

  threeNoSPF: [
    entry('Niacinamide serum', 'PM', ['Niacinamide']),
    entry('Basic moisturizer', 'both', ['Glycerin', 'Ceramides']),
    entry('Foaming cleanser', 'both', ['Glycerin', 'Water']),
  ],

  retinolPMplusGlycolicPM: [
    entry('Generic Retinol 0.5%', 'PM', ['Retinol']),
    entry('Generic Glycolic Acid 8%', 'PM', ['Glycolic Acid']),
  ],

  vitaminCAM: [
    entry('Generic Vitamin C 15%', 'AM', ['Ascorbic Acid']),
  ],

  twoNiacinamide: [
    entry('The Ordinary Niacinamide', 'PM', ['Niacinamide']),
    entry('Glow Recipe Dew Drops', 'AM', ['Niacinamide']),
  ],

  fourActivesNoBarrier: [
    entry('Generic Retinol', 'PM', ['Retinol']),
    entry('Azelaic Acid 10%', 'PM', ['Azelaic Acid']),
    entry('Kojic Acid serum', 'AM', ['Kojic Acid']),
    entry('Alpha-Arbutin serum', 'AM', ['Alpha-Arbutin']),
  ],

  fullCleanMoistSPFNiac: [
    entry('Gentle Cleanser', 'both', ['Glycerin', 'Water']),
    entry('Moisturizer', 'both', ['Ceramides', 'Glycerin']),
    entry('Mineral SPF', 'AM', ['Zinc Oxide', 'Glycerin']),
    entry('Niacinamide serum', 'PM', ['Niacinamide']),
  ],

  twoAHAsPM: [
    entry('Glycolic toner', 'PM', ['Glycolic Acid']),
    entry('Lactic Acid serum', 'PM', ['Lactic Acid']),
  ],
};

export const products = {
  neutralMoisturizer: {
    name: 'CeraVe-style basic moisturizer',
    brand: 'Generic',
    sku: '000001',
    ingredients_inci: ['Glycerin', 'Ceramides', 'Water'],
  },

  niacinamideDewDrops: {
    name: 'Glow Recipe Niacinamide Dew Drops',
    brand: 'Glow Recipe',
    sku: '000002',
    ingredients_inci: ['Niacinamide', 'Glycerin', 'Water'],
  },

  paulasBHA: {
    name: "Paula's Choice 2% BHA Liquid",
    brand: "Paula's Choice",
    sku: '000003',
    ingredients_inci: ['Salicylic Acid', 'Water', 'Glycerin'],
  },

  sunscreen: {
    name: 'Mineral SPF 30',
    brand: 'Generic',
    sku: '000004',
    ingredients_inci: ['Zinc Oxide', 'Water', 'Glycerin'],
  },

  vitaminCSerum: {
    name: 'Vitamin C 15%',
    brand: 'Generic',
    sku: '000005',
    ingredients_inci: ['Ascorbic Acid', 'Water', 'Glycerin'],
  },

  niacinamideOnly: {
    name: 'Niacinamide serum',
    brand: 'Generic',
    sku: '000006',
    ingredients_inci: ['Niacinamide', 'Water'],
  },

  retinolPlusAHA: {
    name: 'Combined retinol + AHA serum',
    brand: 'Generic',
    sku: '000007',
    ingredients_inci: ['Retinol', 'Glycolic Acid', 'Water'],
  },

  ceramideMoisturizer: {
    name: 'Ceramide moisturizer',
    brand: 'Generic',
    sku: '000008',
    ingredients_inci: ['Ceramides', 'Glycerin', 'Water'],
  },

  parabenProduct: {
    name: 'Plain product with parabens',
    brand: 'Generic',
    sku: '000009',
    ingredients_inci: ['Water', 'Methylparaben', 'Propylparaben'],
  },

  mandelicAHA: {
    name: 'Mandelic Acid 5%',
    brand: 'Generic',
    sku: '000010',
    ingredients_inci: ['Mandelic Acid', 'Water', 'Glycerin'],
  },
};
