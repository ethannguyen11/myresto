import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaService } from '../prisma/prisma.service'
import { RecipesService } from '../recipes/recipes.service'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface WeeklyAlertResult {
  alert: string
  generatedAt: string
  severity: AlertSeverity
}

@Injectable()
export class WeeklyAlertService {
  private readonly logger = new Logger(WeeklyAlertService.name)
  private readonly client: Anthropic

  constructor(
    private prisma: PrismaService,
    private recipesService: RecipesService,
  ) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async generateWeeklyAlert(userId: number): Promise<WeeklyAlertResult> {
    const since = new Date()
    since.setDate(since.getDate() - 7)

    // 1. Find all ingredients that had a price recorded this week
    const recentHistories = await this.prisma.priceHistory.findMany({
      where: {
        recordedAt: { gte: since },
        ingredient: { userId },
      },
      orderBy: { recordedAt: 'asc' },
      include: {
        ingredient: {
          include: {
            priceHistory: {
              orderBy: { recordedAt: 'desc' },
              take: 2,
            },
          },
        },
      },
    })

    // 2. Group by ingredient and compute variation
    const byIngredient = new Map<
      number,
      {
        name: string
        unit: string
        firstPriceThisWeek: number
        lastPriceThisWeek: number
        currentPrice: number
        variationPct: number
        affectedRecipes: { name: string; sellingPrice: number; newFoodCostPct: number | null }[]
      }
    >()

    for (const h of recentHistories) {
      const ing = h.ingredient
      const existing = byIngredient.get(ing.id)
      const price = Number(h.price)

      if (!existing) {
        // Baseline = most recent price BEFORE the week, or first price in week if none
        const baseline = ing.priceHistory.find(
          (ph) => new Date(ph.recordedAt) < since,
        )
        const baseprice = baseline ? Number(baseline.price) : price

        byIngredient.set(ing.id, {
          name: ing.name,
          unit: (ing as any).unit,
          firstPriceThisWeek: baseprice,
          lastPriceThisWeek: price,
          currentPrice: Number((ing as any).currentPrice),
          variationPct: 0, // computed below
          affectedRecipes: [],
        })
      } else {
        existing.lastPriceThisWeek = price
      }
    }

    // 3. Compute variationPct and affected recipes for each ingredient
    const changedIngredients: typeof byIngredient extends Map<any, infer V> ? V[] : never[] = []

    for (const [ingId, entry] of byIngredient) {
      if (entry.firstPriceThisWeek === 0) continue
      entry.variationPct =
        Math.round(
          ((entry.lastPriceThisWeek - entry.firstPriceThisWeek) /
            entry.firstPriceThisWeek) *
            10000,
        ) / 100

      if (Math.abs(entry.variationPct) < 0.01) continue // unchanged

      // 4. Impact sur les plats à la carte, sous-recettes comprises
      const impact = await this.recipesService.priceImpact(
        userId,
        new Map([[ingId, entry.lastPriceThisWeek]]),
        new Map([[ingId, entry.firstPriceThisWeek]]),
      )
      entry.affectedRecipes = impact
        .filter((row) => !row.isPreparation && row.isActive)
        .map((row) => ({
          name: row.name,
          sellingPrice: row.sellingPrice,
          newFoodCostPct: row.sellingPrice > 0 ? row.foodCostAfter : null,
        }))

      changedIngredients.push(entry)
    }

    // 5. Determine severity
    const maxVariation = changedIngredients.reduce(
      (max, e) => Math.max(max, e.variationPct),
      0,
    )
    const severity: AlertSeverity =
      maxVariation >= 10 ? 'critical' : maxVariation >= 5 ? 'warning' : 'info'

    // 6. Build Claude prompt
    if (changedIngredients.length === 0) {
      const alert =
        'Cette semaine, aucune variation de prix notable n\'a été enregistrée. Vos coûts matière sont stables. Bon travail ! 👍'
      return { alert, generatedAt: new Date().toISOString(), severity: 'info' }
    }

    const ingredientLines = changedIngredients
      .map((e) => {
        const dir = e.variationPct > 0 ? 'augmenté' : 'baissé'
        const recipeStr =
          e.affectedRecipes.length > 0
            ? ` | Recettes impactées : ` +
              e.affectedRecipes
                .map(
                  (r) =>
                    `"${r.name}" → food cost estimé ${r.newFoodCostPct ?? '?'}%`,
                )
                .join(', ')
            : ' | Aucune recette enregistrée'
        return `- ${e.name} (${e.unit}) : a ${dir} de ${Math.abs(e.variationPct)}% (${e.firstPriceThisWeek}€ → ${e.lastPriceThisWeek}€)${recipeStr}`
      })
      .join('\n')

    const systemPrompt =
      `Tu es le conseiller IA d'un restaurateur. Rédige un message d'alerte hebdomadaire ` +
      `bref (5-8 lignes maximum), personnalisé, en français, à la première personne du singulier ` +
      `(comme si tu parlais directement au chef). Mentionne les ingrédients par leur nom, ` +
      `les recettes impactées et le food cost estimé. Sois précis et actionnable. ` +
      `Commence directement par le contenu, sans formule de politesse.`

    const userPrompt =
      `Voici les variations de prix de la semaine :\n${ingredientLines}\n\n` +
      `Gravité globale : ${severity === 'critical' ? 'critique' : severity === 'warning' ? 'modérée' : 'faible'}`

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const alert = message.content[0].type === 'text' ? message.content[0].text : ''
    this.logger.log(`Alerte hebdomadaire générée pour userId ${userId} — gravité: ${severity}`)

    return { alert, generatedAt: new Date().toISOString(), severity }
  }
}
