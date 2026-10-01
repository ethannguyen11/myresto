// Miroir de apps/api/src/recipes/units.ts — sert à l'aperçu du coût en direct.
// L'API reste la source de vérité : elle refuse les unités incompatibles.

export type Dimension = 'mass' | 'volume' | 'count';

const UNITS: Record<string, { dimension: Dimension; factor: number }> = {
  kg: { dimension: 'mass', factor: 1 },
  g: { dimension: 'mass', factor: 0.001 },
  mg: { dimension: 'mass', factor: 0.000001 },
  l: { dimension: 'volume', factor: 1 },
  dl: { dimension: 'volume', factor: 0.1 },
  cl: { dimension: 'volume', factor: 0.01 },
  ml: { dimension: 'volume', factor: 0.001 },
  piece: { dimension: 'count', factor: 1 },
  douzaine: { dimension: 'count', factor: 12 },
};

const ALIASES: Record<string, string> = {
  kilo: 'kg', kilos: 'kg', kgs: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  gr: 'g', grs: 'g', gramme: 'g', grammes: 'g',
  litre: 'l', litres: 'l', lt: 'l', ltr: 'l',
  centilitre: 'cl', centilitres: 'cl', millilitre: 'ml', millilitres: 'ml',
  pc: 'piece', pcs: 'piece', pce: 'piece', pces: 'piece', 'pièce': 'piece', 'pièces': 'piece',
  pieces: 'piece', u: 'piece', un: 'piece', unite: 'piece', 'unité': 'piece', 'unités': 'piece', unites: 'piece',
  dz: 'douzaine', douzaines: 'douzaine',
};

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase().replace(/\.$/, '');
  if (!u) return null;
  return ALIASES[u] ?? u;
}

/** quantité_en_to = quantité_en_from × facteur ; null si non convertible */
export function conversionFactor(from: string | null | undefined, to: string | null | undefined): number | null {
  const f = normalizeUnit(from);
  const t = normalizeUnit(to);
  if (!f || !t) return f === t ? 1 : null;
  if (f === t) return 1;
  const fd = UNITS[f];
  const td = UNITS[t];
  if (!fd || !td || fd.dimension !== td.dimension) return null;
  return fd.factor / td.factor;
}

const CHOICES: Record<Dimension, string[]> = {
  mass: ['kg', 'g'],
  volume: ['L', 'cl', 'ml'],
  count: ['pièce'],
};

/**
 * Unités proposées pour doser une référence vendue/rendue en `baseUnit`.
 * Une unité hors table (botte, colis…) ne propose qu'elle-même.
 */
export function unitChoices(baseUnit: string | null | undefined): string[] {
  const u = normalizeUnit(baseUnit);
  if (!u) return [];
  const def = UNITS[u];
  if (!def) return [baseUnit!];
  return CHOICES[def.dimension];
}
