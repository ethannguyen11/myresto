import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaService } from '../prisma/prisma.service'
import { RecipesService } from '../recipes/recipes.service'
import { DashboardService } from '../dashboard/dashboard.service'

const SYSTEM_PROMPT = `Tu es un conseiller financier expert en restauration. \
Analyse les données du restaurant et génère un rapport structuré en français avec : \
1) Analyse de la rentabilité globale \
2) Top 3 recommandations prioritaires \
3) Alertes sur les prix en hausse \
4) Suggestions d'optimisation des recettes \
Sois concis, actionnable et bienveillant. \
Utilise des emojis pour structurer.`

@Injectable()
export class AdvisorService {
  private readonly logger = new Logger(AdvisorService.name)
  private readonly client: Anthropic

  constructor(
    private prisma: PrismaService,
    private recipesService: RecipesService,
    private dashboardService: DashboardService,
  ) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  // ── Build restaurant context string ────────────────────────────────────

  private async buildContext(userId: number): Promise<string> {
    const [recipes, ingredients, dashboard] = await Promise.all([
      this.recipesService.findAll(userId),
      this.prisma.ingredient.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
        include: {
          priceHistory: {
            orderBy: { recordedAt: 'desc' },
            take: 5,
            select: { price: true, recordedAt: true, source: true },
          },
        },
      }),
      this.dashboardService.getDashboard(userId),
    ])

    const recipeLines = recipes
      .map((r) =>
        `- ${r.name} (${r.category ?? 'sans catégorie'}) : ` +
        `prix vente ${r.foodCost.sellingPrice}€, coût ${r.foodCost.totalCost}€, ` +
        `food cost ${r.foodCost.foodCostPercent}%, marge ${r.foodCost.profitPerDish}€ — ${r.foodCost.status}`,
      )
      .join('\n')

    const ingredientLines = ingredients
      .map((ing) => {
        const prices = ing.priceHistory.map((h) => Number(h.price))
        const trend =
          prices.length >= 2
            ? prices[0] > prices[1]
              ? `↑ hausse (${prices[1]}€ → ${prices[0]}€)`
              : prices[0] < prices[1]
              ? `↓ baisse (${prices[1]}€ → ${prices[0]}€)`
              : 'stable'
            : 'pas d\'historique'
        return `- ${ing.name} (${(ing as any).unit}) : prix actuel ${Number((ing as any).currentPrice)}€ — ${trend}`
      })
      .join('\n')

    return `
=== DONNÉES DU RESTAURANT ===

RÉSUMÉ GLOBAL
- Total recettes : ${dashboard.summary.totalRecipes}
- Food cost moyen : ${dashboard.summary.averageFoodCost}%
- Recettes rentables : ${dashboard.summary.rentableCount}/${dashboard.summary.totalRecipes}
- Profit potentiel / service : ${dashboard.summary.totalPotentialProfit}€

RECETTES (${recipes.length})
${recipeLines || 'Aucune recette enregistrée.'}

INGRÉDIENTS (${ingredients.length})
${ingredientLines || 'Aucun ingrédient enregistré.'}

ALERTES ACTIVES
${dashboard.alerts.length > 0 ? dashboard.alerts.join('\n') : 'Aucune alerte.'}
`.trim()
  }

  // ── POST /advisor/report ────────────────────────────────────────────────

  async generateReport(userId: number): Promise<{ report: string; generatedAt: string }> {
    const context = await this.buildContext(userId)

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: context,
        },
      ],
    })

    const report = message.content[0].type === 'text' ? message.content[0].text : ''
    this.logger.log(`Rapport généré pour userId ${userId} (${report.length} chars)`)

    return { report, generatedAt: new Date().toISOString() }
  }

  // ── POST /advisor/chat ──────────────────────────────────────────────────

  async chat(
    userId: number,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ): Promise<{ reply: string }> {
    const context = await this.buildContext(userId)

    const systemWithContext = `${SYSTEM_PROMPT}

Tu as accès aux données actuelles du restaurant :

${context}

Réponds en français, de manière concise et pratique.`

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message },
    ]

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemWithContext,
      messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''
    return { reply }
  }
}
