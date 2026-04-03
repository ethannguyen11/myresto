import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import PDFDocument from 'pdfkit'
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

  // ── POST /advisor/simulate ─────────────────────────────────────────────

  async simulate(
    userId: number,
    targetFoodCost: number,
  ): Promise<{
    currentAvgFoodCost: number
    targetFoodCost: number
    suggestions: string
    recipes: object[]
  }> {
    const recipes = await this.recipesService.findAll(userId)

    const currentAvgFoodCost =
      recipes.length > 0
        ? Math.round(
            (recipes.reduce((sum, r) => sum + r.foodCost.foodCostPercent, 0) / recipes.length) * 100,
          ) / 100
        : 0

    const nonCompliant = recipes.filter(
      (r) => r.foodCost.foodCostPercent > targetFoodCost,
    )

    const recipesSummary = nonCompliant.map((r) => {
      const { totalCost, sellingPrice, foodCostPercent } = r.foodCost
      const newSellingPrice =
        totalCost > 0
          ? Math.round((totalCost / (targetFoodCost / 100)) * 100) / 100
          : null

      // Most impactful ingredient (highest line cost)
      const mostImpactful = r.items.reduce(
        (best: any, item: any) => {
          const lineCost =
            Number(item.ingredient.currentPrice) * Number(item.quantity)
          return lineCost > (best?.lineCost ?? -Infinity)
            ? { name: item.ingredient.name, lineCost, quantity: Number(item.quantity), unit: item.ingredient.unit }
            : best
        },
        null as any,
      )

      return {
        name: r.name,
        category: r.category ?? null,
        currentFoodCost: foodCostPercent,
        currentSellingPrice: sellingPrice,
        totalIngredientCost: totalCost,
        requiredSellingPrice: newSellingPrice,
        priceDelta: newSellingPrice != null ? Math.round((newSellingPrice - sellingPrice) * 100) / 100 : null,
        mostImpactfulIngredient: mostImpactful,
      }
    })

    const prompt =
      nonCompliant.length === 0
        ? `Toutes les ${recipes.length} recettes respectent déjà le food cost cible de ${targetFoodCost}%. Félicite le restaurateur et donne 2 conseils pour maintenir cette performance.`
        : `Food cost cible : ${targetFoodCost}%\nFood cost moyen actuel : ${currentAvgFoodCost}%\n\nRecettes non conformes :\n${JSON.stringify(recipesSummary, null, 2)}`

    const systemPrompt =
      `Tu es un consultant en restauration expert en optimisation des coûts. ` +
      `Analyse ces recettes et propose les 3 ajustements les plus impactants pour atteindre le food cost cible de ${targetFoodCost}%. ` +
      `Pour chaque suggestion : nom du plat, action concrète, impact chiffré. Sois précis et actionnable.`

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    })

    const suggestions =
      message.content[0].type === 'text' ? message.content[0].text : ''

    return {
      currentAvgFoodCost,
      targetFoodCost,
      suggestions,
      recipes: recipesSummary,
    }
  }

  // ── GET /advisor/report/pdf ────────────────────────────────────────────

  async generatePdfReport(userId: number): Promise<{ buffer: Buffer; filename: string }> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const [recipes, ingredients, invoices, dashboard] = await Promise.all([
      this.recipesService.findAll(userId),
      this.prisma.ingredient.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
        include: {
          priceHistory: {
            orderBy: { recordedAt: 'desc' },
            take: 3,
            select: { price: true, recordedAt: true, source: true },
          },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          userId,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      }),
      this.dashboardService.getDashboard(userId),
    ])

    // Build rich context for Claude
    const recipeLines = recipes.map((r) =>
      `- ${r.name} (${r.category ?? 'sans catégorie'}) : ` +
      `prix vente ${r.foodCost.sellingPrice}€, coût matière ${r.foodCost.totalCost}€, ` +
      `food cost ${r.foodCost.foodCostPercent}%, marge ${r.foodCost.profitPerDish}€ — ${r.foodCost.status}`,
    ).join('\n')

    const ingredientLines = ingredients.map((ing) => {
      const prices = ing.priceHistory.map((h) => Number(h.price))
      const trend = prices.length >= 2
        ? prices[0] > prices[1] ? `↑ hausse (${prices[1]}€ → ${prices[0]}€)` : `↓ stable/baisse`
        : 'pas d\'historique'
      return `- ${ing.name} (${(ing as any).unit}) : ${Number((ing as any).currentPrice)}€ — ${trend}`
    }).join('\n')

    const invoiceLines = invoices.length === 0
      ? 'Aucune facture ce mois-ci.'
      : invoices.map((inv) =>
          `- ${inv.supplierName ?? 'Fournisseur inconnu'} : ${inv.totalAmount ? Number(inv.totalAmount) + '€' : 'montant inconnu'} ` +
          `(${inv.status}) — ${inv.items.length} ligne(s)`,
        ).join('\n')

    const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount ?? 0), 0)

    const context = `
=== RAPPORT MENSUEL — ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()} ===

RÉSUMÉ GLOBAL
- Recettes actives : ${dashboard.summary.totalRecipes}
- Food cost moyen : ${dashboard.summary.averageFoodCost}%
- Recettes rentables : ${dashboard.summary.rentableCount}/${dashboard.summary.totalRecipes}
- Profit potentiel / service : ${dashboard.summary.totalPotentialProfit}€

FACTURES DU MOIS (${invoices.length} facture(s)) — Total : ${totalInvoiced.toFixed(2)}€
${invoiceLines}

RECETTES (${recipes.length})
${recipeLines || 'Aucune recette.'}

INGRÉDIENTS (${ingredients.length})
${ingredientLines || 'Aucun ingrédient.'}

ALERTES ACTIVES
${dashboard.alerts.length > 0 ? dashboard.alerts.join('\n') : 'Aucune alerte.'}
`.trim()

    const systemPrompt =
      `Tu es un conseiller financier expert en restauration. ` +
      `Génère un rapport mensuel structuré en markdown avec exactement ces 4 sections :\n` +
      `# Résumé exécutif\n` +
      `(food cost moyen du mois, tendance, points clés en 3-4 lignes)\n\n` +
      `# Analyse recette par recette\n` +
      `(tableau ou liste de chaque plat avec son food cost et statut)\n\n` +
      `# Top 3 alertes du mois\n` +
      `(les 3 points critiques les plus urgents à traiter)\n\n` +
      `# Recommandations pour le mois suivant\n` +
      `(3-5 actions concrètes et chiffrées)\n\n` +
      `Sois factuel, précis et actionnable. Utilise des chiffres. Rédige en français.`

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: context }],
    })

    const markdown = message.content[0].type === 'text' ? message.content[0].text : ''
    this.logger.log(`Rapport PDF généré pour userId ${userId} (${markdown.length} chars)`)

    const buffer = await this.renderMarkdownToPdf(markdown, now)
    const month = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      .replace(' ', '-').toLowerCase()
    const filename = `rapport-chef-ia-${month}.pdf`

    return { buffer, filename }
  }

  // ── PDF renderer (markdown → pdfkit buffer) ────────────────────────────

  private renderMarkdownToPdf(markdown: string, date: Date): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

      // ── Cover header ──
      doc.rect(0, 0, doc.page.width, 80).fill('#059669')
      doc.fillColor('#ffffff')
        .font('Helvetica-Bold').fontSize(22)
        .text('Chef IA — Rapport mensuel', 50, 22, { align: 'left' })
      doc.font('Helvetica').fontSize(11)
        .text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), 50, 52, { align: 'left' })
      doc.fillColor('#000000').moveDown(3)

      // ── Render markdown lines ──
      const lines = markdown.split('\n')
      for (const line of lines) {
        const raw = line.trimEnd()

        if (/^---+$/.test(raw.trim())) {
          doc.moveDown(0.3)
          doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
            .strokeColor('#d1d5db').lineWidth(0.5).stroke()
          doc.moveDown(0.3)
          continue
        }

        if (raw.trim() === '') {
          doc.moveDown(0.4)
          continue
        }

        if (raw.startsWith('# ')) {
          doc.moveDown(0.6)
          doc.rect(45, doc.y, 4, 16).fill('#059669')
          doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827')
            .text(raw.slice(2).replace(/\*\*/g, ''), 56, doc.y - 16, { lineGap: 4 })
          doc.moveDown(0.4)
          continue
        }

        if (raw.startsWith('## ')) {
          doc.moveDown(0.4)
          doc.font('Helvetica-Bold').fontSize(12).fillColor('#374151')
            .text(raw.slice(3).replace(/\*\*/g, ''), { lineGap: 2 })
          doc.moveDown(0.2)
          continue
        }

        if (raw.startsWith('### ')) {
          doc.font('Helvetica-Bold').fontSize(10).fillColor('#6b7280')
            .text(raw.slice(4).replace(/\*\*/g, ''), { lineGap: 2 })
          continue
        }

        if (/^[-•]\s/.test(raw.trim())) {
          const content = raw.trim().slice(2)
          this.renderInlinePdf(doc, '• ' + content, { indent: 16, lineGap: 1 })
          continue
        }

        if (/^\d+[\.\)]\s/.test(raw.trim())) {
          this.renderInlinePdf(doc, raw.trim(), { indent: 16, lineGap: 1 })
          continue
        }

        this.renderInlinePdf(doc, raw, { lineGap: 1 })
      }

      // ── Footer ──
      doc.moveDown(2)
      doc.fontSize(8).fillColor('#9ca3af')
        .text(
          `Généré le ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — Chef IA · myresto`,
          { align: 'center' },
        )

      doc.end()
    })
  }

  private renderInlinePdf(doc: PDFKit.PDFDocument, text: string, opts: Record<string, any> = {}) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0)
    if (parts.length === 0) return

    doc.fontSize(10).fillColor('#1f2937')

    if (parts.length === 1) {
      const isBold = parts[0].startsWith('**') && parts[0].endsWith('**')
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .text(isBold ? parts[0].slice(2, -2) : parts[0], opts)
      return
    }

    parts.forEach((part, i) => {
      const isBold = part.startsWith('**') && part.endsWith('**')
      const content = isBold ? part.slice(2, -2) : part
      if (!content) return
      const isLast = i === parts.length - 1
      doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica')
        .text(content, { ...opts, continued: !isLast })
    })
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
