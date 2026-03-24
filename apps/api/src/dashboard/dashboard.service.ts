import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RecipesService } from '../recipes/recipes.service'

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private recipesService: RecipesService,
  ) {}

  async getDashboard(userId: number) {
    const [recipes, ingredients] = await Promise.all([
      this.recipesService.findAll(userId),
      this.prisma.ingredient.findMany({
        where: { userId },
        select: {
          name: true,
          priceHistory: {
            orderBy: { recordedAt: 'asc' },
            select: { price: true, recordedAt: true, source: true },
          },
        },
      }),
    ])

    // ── 1. Résumé global ───────────────────────────────────────────────────────
    const totalRecipes = recipes.length
    const rentableCount = recipes.filter((r) => r.foodCost.isRentable).length
    const nonRentableCount = totalRecipes - rentableCount
    const averageFoodCost =
      totalRecipes > 0
        ? Math.round(
            (recipes.reduce((s, r) => s + r.foodCost.foodCostPercent, 0) / totalRecipes) * 100,
          ) / 100
        : 0
    const totalPotentialProfit = Math.round(
      recipes.reduce((s, r) => s + r.foodCost.profitPerDish, 0) * 100,
    ) / 100

    // ── 2 & 3. Top 3 meilleures / pires recettes ──────────────────────────────
    const sorted = [...recipes].sort((a, b) => b.foodCost.profitPerDish - a.foodCost.profitPerDish)
    const topProfitable = sorted.slice(0, 3).map(toRecipeSummary)

    const sortedByFoodCost = [...recipes].sort(
      (a, b) => b.foodCost.foodCostPercent - a.foodCost.foodCostPercent,
    )
    const topExpensive = sortedByFoodCost.slice(0, 3).map(toRecipeSummary)

    // ── 4. Alertes intelligentes ───────────────────────────────────────────────
    const alerts: string[] = []

    // Alerte non-rentabilité
    for (const r of recipes) {
      if (r.foodCost.foodCostPercent > 30) {
        alerts.push(
          `⚠️ ${r.name} : food cost à ${r.foodCost.foodCostPercent}% — non rentable`,
        )
      }
    }

    // Alerte hausse de prix ingrédients (comparer les 2 derniers enregistrements)
    for (const ing of ingredients) {
      const h = ing.priceHistory
      if (h.length < 2) continue
      const prev = Number(h[h.length - 2].price)
      const last = Number(h[h.length - 1].price)
      if (last > prev) {
        const rise = Math.round(((last - prev) / prev) * 100 * 10) / 10
        alerts.push(`📈 ${ing.name} : prix en hausse de ${rise}% depuis la dernière facture`)
      }
    }

    // Alerte conseil prix de vente (recettes non rentables)
    for (const r of recipes) {
      if (!r.foodCost.isRentable && r.foodCost.totalCost > 0) {
        const requiredPrice = r.foodCost.totalCost / 0.3
        const increase = Math.ceil((requiredPrice - r.foodCost.sellingPrice) * 100) / 100
        if (increase > 0) {
          alerts.push(
            `💡 ${r.name} : augmenter le prix de vente de ${increase}€ pour atteindre 30% de food cost`,
          )
        }
      }
    }

    // ── 5. Évolution des prix ──────────────────────────────────────────────────
    const priceEvolution = ingredients
      .filter((ing) => ing.priceHistory.length >= 2)
      .map((ing) => {
        const first = Number(ing.priceHistory[0].price)
        const last = Number(ing.priceHistory[ing.priceHistory.length - 1].price)
        const variationPercent = Math.round(((last - first) / first) * 100 * 100) / 100
        return {
          ingredientName: ing.name,
          firstPrice: first,
          lastPrice: last,
          variationPercent,
        }
      })
      .sort((a, b) => Math.abs(b.variationPercent) - Math.abs(a.variationPercent))

    return {
      summary: {
        totalRecipes,
        averageFoodCost,
        rentableCount,
        nonRentableCount,
        totalPotentialProfit,
      },
      topProfitable,
      topExpensive,
      alerts,
      priceEvolution,
    }
  }
}

function toRecipeSummary(r: any) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    sellingPrice: r.foodCost.sellingPrice,
    foodCostPercent: r.foodCost.foodCostPercent,
    profitPerDish: r.foodCost.profitPerDish,
    status: r.foodCost.status,
  }
}
