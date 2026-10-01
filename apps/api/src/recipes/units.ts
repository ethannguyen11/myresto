/**
 * Conversion d'unités.
 *
 * Un ingrédient a une unité d'achat (celle de son prix : €/kg, €/L, €/pièce).
 * Une ligne de recette peut être saisie dans une autre unité de la même
 * dimension (g pour un ingrédient au kg, cl pour un ingrédient au L).
 * Sans conversion, « 200 g de beurre à 9 €/kg » coûterait 1 800 € au lieu de 1,80 €.
 *
 * Les unités hors masse/volume (pièce, botte, colis…) ne se convertissent
 * qu'entre elles si elles sont identiques. Le passage colis → kg d'une facture
 * passe par un facteur saisi par l'utilisateur (voir InvoicesService).
 */

export type Dimension = 'mass' | 'volume' | 'count'

interface UnitDef {
  dimension: Dimension
  /** Combien d'unités de base (kg, L, pièce) vaut 1 de cette unité */
  factor: number
}

const UNITS: Record<string, UnitDef> = {
  // masse — base kg
  kg: { dimension: 'mass', factor: 1 },
  g: { dimension: 'mass', factor: 0.001 },
  mg: { dimension: 'mass', factor: 0.000001 },
  // volume — base L
  l: { dimension: 'volume', factor: 1 },
  dl: { dimension: 'volume', factor: 0.1 },
  cl: { dimension: 'volume', factor: 0.01 },
  ml: { dimension: 'volume', factor: 0.001 },
  // comptage — base pièce
  piece: { dimension: 'count', factor: 1 },
  douzaine: { dimension: 'count', factor: 12 },
}

/** Variantes d'écriture rencontrées dans les saisies et sur les factures */
const ALIASES: Record<string, string> = {
  kilo: 'kg', kilos: 'kg', kgs: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  gr: 'g', grs: 'g', gramme: 'g', grammes: 'g',
  litre: 'l', litres: 'l', lt: 'l', ltr: 'l',
  centilitre: 'cl', centilitres: 'cl',
  millilitre: 'ml', millilitres: 'ml',
  pc: 'piece', pcs: 'piece', pce: 'piece', pces: 'piece', 'pièce': 'piece', 'pièces': 'piece',
  pieces: 'piece', u: 'piece', un: 'piece', unite: 'piece', 'unité': 'piece', 'unités': 'piece', unites: 'piece',
  dz: 'douzaine', douzaines: 'douzaine',
}

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null
  const u = unit.trim().toLowerCase().replace(/\.$/, '')
  if (!u) return null
  return ALIASES[u] ?? u
}

export function unitDimension(unit: string | null | undefined): Dimension | null {
  const u = normalizeUnit(unit)
  return u && UNITS[u] ? UNITS[u].dimension : null
}

/**
 * Facteur pour passer de `from` à `to` : quantité_en_to = quantité_en_from × facteur.
 * Renvoie null si les unités ne sont pas convertibles entre elles.
 */
export function conversionFactor(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  const f = normalizeUnit(from)
  const t = normalizeUnit(to)
  if (!f || !t) return f === t ? 1 : null
  if (f === t) return 1
  const fd = UNITS[f]
  const td = UNITS[t]
  if (!fd || !td || fd.dimension !== td.dimension) return null
  return fd.factor / td.factor
}

export function areCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  return conversionFactor(a, b) !== null
}

/** Unités proposées dans les listes déroulantes, par dimension */
export const UNIT_CHOICES: Record<Dimension, string[]> = {
  mass: ['kg', 'g'],
  volume: ['L', 'cl', 'ml'],
  count: ['pièce'],
}
