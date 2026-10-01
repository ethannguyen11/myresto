import { conversionFactor, normalizeUnit } from './units'

/**
 * Moteur de coût des recettes — logique pure, sans base de données.
 *
 * Une recette contient des lignes qui pointent soit vers un ingrédient,
 * soit vers une autre recette marquée « préparation » (sauce, fond, pâte…).
 * Le coût d'une préparation est ramené à son unité de rendement :
 * 1,5 L de béarnaise qui coûte 12 € → 8 €/L, puis chaque plat qui en
 * utilise 5 cl paie 0,40 €. Le calcul est récursif et mémoïsé.
 *
 * `priceOverrides` permet de simuler un autre prix pour certains ingrédients
 * (impact d'une hausse) sans toucher à la base.
 */

export interface EngineIngredient {
  id: number
  name: string
  unit: string
  currentPrice: unknown
}

export interface EngineItem {
  ingredientId: number | null
  ingredient?: EngineIngredient | null
  subRecipeId: number | null
  quantity: unknown
  unit?: string | null
}

export interface EngineRecipe {
  id: number
  name: string
  sellingPrice: unknown
  wastagePercent?: unknown
  isPreparation?: boolean
  yieldQuantity?: unknown
  yieldUnit?: string | null
  items: EngineItem[]
}

export interface CostLine {
  kind: 'ingredient' | 'preparation'
  refId: number
  name: string
  quantity: number
  unit: string | null
  /** Coût de la ligne en € */
  cost: number
  /** Vrai si l'unité saisie n'est pas convertible vers celle de la référence */
  unitMismatch: boolean
}

export interface RecipeCost {
  ingredientCost: number
  lines: CostLine[]
  /** Coût par unité de rendement — uniquement pour les préparations */
  unitCost: number | null
  /** Tous les ingrédients dont dépend la recette, sous-recettes comprises */
  ingredientIds: Set<number>
}

export class RecipeCycleError extends Error {
  constructor(public readonly path: string[]) {
    super(`Boucle de sous-recettes : ${path.join(' → ')}`)
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Rendement effectif d'une préparation : 1 portion si rien n'est renseigné */
export function yieldOf(recipe: Pick<EngineRecipe, 'yieldQuantity' | 'yieldUnit'>) {
  const q = Number(recipe.yieldQuantity ?? 0)
  return {
    quantity: q > 0 ? q : 1,
    unit: q > 0 ? (recipe.yieldUnit ?? null) : null,
  }
}

export class CostEngine {
  private readonly memo = new Map<number, RecipeCost>()

  constructor(
    private readonly recipes: Map<number, EngineRecipe>,
    private readonly priceOverrides: Map<number, number> = new Map(),
  ) {}

  static from(recipes: EngineRecipe[], priceOverrides?: Map<number, number>) {
    return new CostEngine(new Map(recipes.map((r) => [r.id, r])), priceOverrides)
  }

  cost(recipeId: number): RecipeCost {
    return this.compute(recipeId, [])
  }

  private priceOf(ing: EngineIngredient): number {
    return this.priceOverrides.has(ing.id)
      ? this.priceOverrides.get(ing.id)!
      : Number(ing.currentPrice)
  }

  private compute(recipeId: number, stack: number[]): RecipeCost {
    const cached = this.memo.get(recipeId)
    if (cached) return cached

    const recipe = this.recipes.get(recipeId)
    if (!recipe) {
      return { ingredientCost: 0, lines: [], unitCost: null, ingredientIds: new Set() }
    }
    if (stack.includes(recipeId)) {
      const names = [...stack, recipeId].map((id) => this.recipes.get(id)?.name ?? `#${id}`)
      throw new RecipeCycleError(names)
    }

    const lines: CostLine[] = []
    const ingredientIds = new Set<number>()

    for (const item of recipe.items) {
      const quantity = Number(item.quantity)
      const itemUnit = item.unit ?? null

      if (item.subRecipeId != null) {
        const sub = this.recipes.get(item.subRecipeId)
        if (!sub) continue
        const subCost = this.compute(sub.id, [...stack, recipeId])
        const y = yieldOf(sub)
        // Sans unité saisie, la quantité est exprimée dans l'unité de rendement
        const factor = itemUnit == null ? 1 : conversionFactor(itemUnit, y.unit)
        subCost.ingredientIds.forEach((id) => ingredientIds.add(id))
        lines.push({
          kind: 'preparation',
          refId: sub.id,
          name: sub.name,
          quantity,
          unit: itemUnit ?? y.unit,
          cost: quantity * (factor ?? 1) * (subCost.unitCost ?? 0),
          unitMismatch: factor === null,
        })
        continue
      }

      const ing = item.ingredient
      if (!ing) continue
      ingredientIds.add(ing.id)
      const factor = itemUnit == null ? 1 : conversionFactor(itemUnit, ing.unit)
      lines.push({
        kind: 'ingredient',
        refId: ing.id,
        name: ing.name,
        quantity,
        unit: itemUnit ?? ing.unit,
        cost: quantity * (factor ?? 1) * this.priceOf(ing),
        unitMismatch: factor === null,
      })
    }

    const ingredientCost = lines.reduce((s, l) => s + l.cost, 0)
    const result: RecipeCost = {
      ingredientCost,
      lines,
      unitCost: recipe.isPreparation ? ingredientCost / yieldOf(recipe).quantity : null,
      ingredientIds,
    }
    this.memo.set(recipeId, result)
    return result
  }

  /**
   * Vérifie qu'ajouter ces sous-recettes à `recipeId` ne crée pas de boucle
   * (A contient B qui contient A). Lève RecipeCycleError sinon.
   */
  assertNoCycle(recipeId: number | null, subRecipeIds: number[]) {
    const reaches = (from: number, target: number, seen: Set<number>): boolean => {
      if (from === target) return true
      if (seen.has(from)) return false
      seen.add(from)
      const r = this.recipes.get(from)
      return !!r?.items.some((i) => i.subRecipeId != null && reaches(i.subRecipeId, target, seen))
    }
    for (const subId of subRecipeIds) {
      if (recipeId != null && reaches(subId, recipeId, new Set())) {
        const self = this.recipes.get(recipeId)?.name ?? 'cette recette'
        const sub = this.recipes.get(subId)?.name ?? `#${subId}`
        throw new RecipeCycleError([self, sub, self])
      }
    }
  }
}

/** Unité normalisée pour l'affichage (kg, g, L, cl, ml, pièce) */
export function displayUnit(unit: string | null | undefined): string | null {
  const u = normalizeUnit(unit)
  if (u === 'l') return 'L'
  if (u === 'dl') return 'dL'
  if (u === 'piece') return 'pièce'
  return u
}
