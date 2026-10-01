import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRecipeDto, RecipeItemDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'
import { CostEngine, EngineRecipe, RecipeCycleError, round2, yieldOf, displayUnit } from './cost-engine'
import { areCompatible } from './units'

const RECIPE_INCLUDE = {
  items: {
    include: {
      ingredient: true,
      subRecipe: { select: { id: true, name: true, yieldQuantity: true, yieldUnit: true } },
    },
  },
} as const

/** Ligne de l'impact d'un changement de prix sur un plat */
export interface PriceImpactRow {
  recipeId: number
  name: string
  isPreparation: boolean
  isActive: boolean
  sellingPrice: number
  costBefore: number
  costAfter: number
  foodCostBefore: number
  foodCostAfter: number
  /** Prix de vente qui ramène le food cost à son niveau d'avant */
  suggestedPrice: number | null
}

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  private round(n: number): number {
    return round2(n)
  }

  /**
   * Verdicts de rentabilité à partir du coût matière.
   * `ingredientCost` inclut déjà le coût des sous-recettes.
   */
  calculateFoodCost(ingredientCost: number, sellingPrice: unknown, wastagePercent?: unknown) {
    // Coût avec pertes matière
    const wastage = Number(wastagePercent ?? 0) / 100
    const ingredientCostWithWaste = ingredientCost * (1 + wastage)

    // Coût total réel = ingrédients + pertes uniquement
    const totalRealCost = ingredientCostWithWaste

    const selling = Number(sellingPrice)

    // Food cost % (ingrédients seulement — métrique classique)
    const foodCostPercent = selling > 0 ? (ingredientCost / selling) * 100 : 0

    // Coût réel % (ingrédients + pertes)
    const realCostPercent = selling > 0 ? (totalRealCost / selling) * 100 : 0

    // RAG Status basé sur le coût réel
    const ragStatus: 'green' | 'amber' | 'red' =
      realCostPercent <= 30 ? 'green' : realCostPercent <= 40 ? 'amber' : 'red'

    return {
      totalCost: this.round(ingredientCost),                    // compat
      ingredientCost: this.round(ingredientCost),
      ingredientCostWithWaste: this.round(ingredientCostWithWaste),
      totalRealCost: this.round(totalRealCost),
      sellingPrice: selling,
      foodCostPercent: this.round(foodCostPercent),
      realCostPercent: this.round(realCostPercent),
      profitPerDish: this.round(selling - ingredientCost),      // compat
      realProfitPerDish: this.round(selling - totalRealCost),
      isRentable: foodCostPercent <= 30,
      ragStatus,
      status: foodCostPercent <= 25
        ? '🟢 Excellent'
        : foodCostPercent <= 30
        ? '🟡 Correct'
        : foodCostPercent <= 35
        ? '🟠 Attention'
        : '🔴 Non rentable',
    }
  }

  /** Toutes les recettes de l'utilisateur, nécessaires pour résoudre les sous-recettes */
  private loadAll(userId: number) {
    return this.prisma.recipe.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: RECIPE_INCLUDE,
    })
  }

  private withCost<R extends EngineRecipe & { wastagePercent?: unknown; sellingPrice: unknown }>(
    recipe: R,
    engine: CostEngine,
    all: EngineRecipe[],
  ) {
    const cost = engine.cost(recipe.id)
    const y = yieldOf(recipe)
    return {
      ...recipe,
      foodCost: this.calculateFoodCost(cost.ingredientCost, recipe.sellingPrice, recipe.wastagePercent),
      costLines: cost.lines.map((l) => ({ ...l, cost: this.round(l.cost), unit: displayUnit(l.unit) })),
      // Pour une préparation : coût par unité de rendement (€/L, €/kg, €/portion)
      unitCost: cost.unitCost != null ? this.round(cost.unitCost) : null,
      unitCostUnit: recipe.isPreparation ? (displayUnit(y.unit) ?? 'portion') : null,
      usedIn: all
        .filter((r) => r.items.some((i) => i.subRecipeId === recipe.id))
        .map((r) => ({ id: r.id, name: r.name })),
    }
  }

  /**
   * @param activeOnly  N'inclut que les plats actuellement à la carte.
   *
   * Par défaut on renvoie tout, y compris les plats désactivés et les
   * préparations : l'écran de gestion des recettes doit pouvoir les afficher.
   * En revanche, tout ce qui juge la rentabilité du menu (analyse, dashboard,
   * rapport hebdomadaire) doit passer `true` — sinon un plat d'hiver retiré
   * de la carte, ou une sauce qui n'est pas vendue seule, pèse sur les
   * moyennes et déclenche des alertes.
   */
  async findAll(userId: number, activeOnly = false) {
    const all = await this.loadAll(userId)
    const engine = CostEngine.from(all)
    const visible = activeOnly ? all.filter((r) => r.isActive && !r.isPreparation) : all
    return visible.map((r) => this.withCost(r, engine, all))
  }

  /** Préparations de base (sauces, fonds…) utilisables comme sous-recettes */
  async findPreparations(userId: number) {
    const recipes = await this.findAll(userId)
    return recipes.filter((r) => r.isPreparation)
  }

  async findOne(id: number, userId: number) {
    const all = await this.loadAll(userId)
    const recipe = all.find((r) => r.id === id)
    if (!recipe) throw new NotFoundException('Recette introuvable')
    return this.withCost(recipe, CostEngine.from(all), all)
  }

  /**
   * Vérifie chaque ligne : une seule cible, appartenant à l'utilisateur,
   * unité compatible, quantité positive, et pas de boucle de sous-recettes.
   */
  private async assertItemsValid(userId: number, recipeId: number | null, items: RecipeItemDto[]) {
    const all = await this.loadAll(userId)
    const ingredientIds = [...new Set(items.map((i) => i.ingredientId).filter((x): x is number => x != null))]
    const ingredients = ingredientIds.length
      ? await this.prisma.ingredient.findMany({ where: { id: { in: ingredientIds }, userId } })
      : []
    const ingById = new Map(ingredients.map((i) => [i.id, i]))
    const recipeById = new Map(all.map((r) => [r.id, r]))

    for (const item of items) {
      const hasIng = item.ingredientId != null
      const hasSub = item.subRecipeId != null
      if (hasIng === hasSub) {
        throw new BadRequestException(
          'Chaque ligne doit référencer soit un ingrédient, soit une préparation.',
        )
      }
      if (!(Number(item.quantity) > 0)) {
        throw new BadRequestException('Les quantités doivent être positives.')
      }

      if (hasIng) {
        const ing = ingById.get(item.ingredientId!)
        if (!ing) throw new BadRequestException(`Ingrédient #${item.ingredientId} introuvable.`)
        if (item.unit && !areCompatible(item.unit, ing.unit)) {
          throw new BadRequestException(
            `« ${ing.name} » est acheté en ${ing.unit} : impossible de le doser en ${item.unit}.`,
          )
        }
      } else {
        const sub = recipeById.get(item.subRecipeId!)
        if (!sub) throw new BadRequestException(`Préparation #${item.subRecipeId} introuvable.`)
        if (!sub.isPreparation) {
          throw new BadRequestException(`« ${sub.name} » n'est pas marquée comme préparation.`)
        }
        if (sub.id === recipeId) {
          throw new BadRequestException('Une recette ne peut pas se contenir elle-même.')
        }
        const y = yieldOf(sub)
        if (item.unit && !areCompatible(item.unit, y.unit)) {
          throw new BadRequestException(
            `« ${sub.name} » rend en ${y.unit ?? 'portions'} : impossible de la doser en ${item.unit}.`,
          )
        }
      }
    }

    try {
      CostEngine.from(all).assertNoCycle(
        recipeId,
        items.map((i) => i.subRecipeId).filter((x): x is number => x != null),
      )
    } catch (e) {
      if (e instanceof RecipeCycleError) throw new BadRequestException(e.message)
      throw e
    }
  }

  private itemData(items: RecipeItemDto[]) {
    return items.map((item) => ({
      ingredientId: item.ingredientId ?? null,
      subRecipeId: item.subRecipeId ?? null,
      quantity: item.quantity,
      unit: item.unit || null,
      notes: item.notes,
    }))
  }

  async create(userId: number, dto: CreateRecipeDto) {
    const items = dto.items ?? []
    await this.assertItemsValid(userId, null, items)

    const recipe = await this.prisma.recipe.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        sellingPrice: dto.sellingPrice ?? 0,
        vatRate: dto.vatRate ?? 0.10,
        notes: dto.notes,
        prepTimeMinutes: dto.prepTimeMinutes,
        servings: dto.servings ?? 1,
        wastagePercent: dto.wastagePercent ?? 0,
        isPreparation: dto.isPreparation ?? false,
        yieldQuantity: dto.yieldQuantity ?? null,
        yieldUnit: dto.yieldUnit || null,
        items: { create: this.itemData(items) },
      },
    })

    return this.findOne(recipe.id, userId)
  }

  async update(id: number, userId: number, dto: UpdateRecipeDto) {
    const existing = await this.findOne(id, userId)

    if (dto.isPreparation === false && existing.isPreparation && existing.usedIn.length > 0) {
      throw new ConflictException(
        `Cette préparation est utilisée par : ${existing.usedIn.map((r) => r.name).join(', ')}. ` +
          'Retirez-la de ces recettes avant de la transformer en plat.',
      )
    }

    if (dto.items) {
      await this.assertItemsValid(userId, id, dto.items)
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.recipeItem.deleteMany({ where: { recipeId: id } })
      }
      await tx.recipe.update({
        where: { id },
        data: {
          name: dto.name,
          category: dto.category,
          sellingPrice: dto.sellingPrice,
          vatRate: dto.vatRate,
          notes: dto.notes,
          prepTimeMinutes: dto.prepTimeMinutes,
          ...(dto.servings !== undefined && { servings: dto.servings }),
          ...(dto.wastagePercent !== undefined && { wastagePercent: dto.wastagePercent }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isPreparation !== undefined && { isPreparation: dto.isPreparation }),
          ...(dto.yieldQuantity !== undefined && { yieldQuantity: dto.yieldQuantity }),
          ...(dto.yieldUnit !== undefined && { yieldUnit: dto.yieldUnit || null }),
          ...(dto.items && { items: { create: this.itemData(dto.items) } }),
        },
      })
    })

    return this.findOne(id, userId)
  }

  /**
   * Retire un plat de la carte, ou l'y remet.
   *
   * C'est l'alternative non destructive à la suppression : l'historique de
   * coût du plat et ses fiches techniques sont conservés, mais il ne compte
   * plus dans l'analyse de rentabilité. Pensé pour la saisonnalité.
   */
  async setActive(id: number, userId: number, isActive: boolean) {
    await this.findOne(id, userId)
    await this.prisma.recipe.update({ where: { id }, data: { isActive } })
    return this.findOne(id, userId)
  }

  async remove(id: number, userId: number) {
    const recipe = await this.findOne(id, userId)
    if (recipe.usedIn.length > 0) {
      throw new ConflictException(
        `Cette préparation est utilisée par : ${recipe.usedIn.map((r) => r.name).join(', ')}.`,
      )
    }
    await this.prisma.recipeItem.deleteMany({ where: { recipeId: id } })
    return this.prisma.recipe.delete({ where: { id } })
  }

  /**
   * Impact d'un ou plusieurs changements de prix sur les plats.
   *
   * Recalcule chaque recette avec les nouveaux prix (sous-recettes comprises)
   * et ne garde que celles dont le coût bouge. Le prix conseillé est celui qui
   * ramène le food cost au pourcentage qu'il avait avant la hausse, arrondi
   * aux 10 centimes supérieurs.
   *
   * @param newPrices  ingredientId → nouveau prix (dans l'unité de l'ingrédient)
   * @param oldPrices  ingredientId → prix de référence ; par défaut le prix en base.
   *                   Utile quand la base est déjà à jour (après validation de facture).
   */
  async priceImpact(
    userId: number,
    newPrices: Map<number, number>,
    oldPrices?: Map<number, number>,
  ): Promise<PriceImpactRow[]> {
    const all = await this.loadAll(userId)
    const before = CostEngine.from(all, oldPrices)
    const after = CostEngine.from(all, newPrices)
    const changed = new Set(newPrices.keys())

    const rows: PriceImpactRow[] = []
    for (const r of all) {
      const b = before.cost(r.id)
      if (![...b.ingredientIds].some((id) => changed.has(id))) continue
      const a = after.cost(r.id)
      if (Math.abs(a.ingredientCost - b.ingredientCost) < 0.005) continue

      const selling = Number(r.sellingPrice)
      const fcBefore = selling > 0 ? (b.ingredientCost / selling) * 100 : 0
      const fcAfter = selling > 0 ? (a.ingredientCost / selling) * 100 : 0
      const suggested =
        !r.isPreparation && fcBefore > 0
          ? Math.ceil((a.ingredientCost / (fcBefore / 100)) * 10) / 10
          : null

      rows.push({
        recipeId: r.id,
        name: r.name,
        isPreparation: r.isPreparation,
        isActive: r.isActive,
        sellingPrice: selling,
        costBefore: this.round(r.isPreparation ? (b.unitCost ?? 0) : b.ingredientCost),
        costAfter: this.round(r.isPreparation ? (a.unitCost ?? 0) : a.ingredientCost),
        foodCostBefore: this.round(fcBefore),
        foodCostAfter: this.round(fcAfter),
        suggestedPrice: suggested,
      })
    }

    // Plats d'abord, les plus touchés en tête ; préparations ensuite
    return rows.sort(
      (x, y) =>
        Number(x.isPreparation) - Number(y.isPreparation) ||
        (y.foodCostAfter - y.foodCostBefore) - (x.foodCostAfter - x.foodCostBefore),
    )
  }

  async getMenuAnalysis(userId: number) {
    const recipes = await this.findAll(userId, true)

    const analysis = {
      totalRecipes: recipes.length,
      rentableCount: recipes.filter(r => r.foodCost.isRentable).length,
      nonRentableCount: recipes.filter(r => !r.foodCost.isRentable).length,
      ragGreen: recipes.filter(r => r.foodCost.ragStatus === 'green').length,
      ragAmber: recipes.filter(r => r.foodCost.ragStatus === 'amber').length,
      ragRed: recipes.filter(r => r.foodCost.ragStatus === 'red').length,
      averageFoodCost: 0,
      averageRealCost: 0,
      bestDish: null as any,
      worstDish: null as any,
      alerts: [] as string[],
    }

    if (recipes.length > 0) {
      analysis.averageFoodCost = this.round(
        recipes.reduce((sum, r) => sum + r.foodCost.foodCostPercent, 0) / recipes.length
      )
      analysis.averageRealCost = this.round(
        recipes.reduce((sum, r) => sum + r.foodCost.realCostPercent, 0) / recipes.length
      )

      analysis.bestDish = recipes.reduce((best, r) =>
        r.foodCost.realProfitPerDish > (best?.foodCost.realProfitPerDish ?? -Infinity) ? r : best
      )

      analysis.worstDish = recipes.reduce((worst, r) =>
        r.foodCost.realCostPercent > (worst?.foodCost.realCostPercent ?? -Infinity) ? r : worst
      )

      recipes.forEach(recipe => {
        if (recipe.foodCost.ragStatus === 'red') {
          analysis.alerts.push(
            `⚠️ "${recipe.name}" — coût réel ${recipe.foodCost.realCostPercent}% (food cost ${recipe.foodCost.foodCostPercent}%)`
          )
        }
      })
    }

    return analysis
  }
}
