import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private resend: any = null

  constructor(private prisma: PrismaService) {
    const apiKey = process.env.RESEND_API_KEY
    if (apiKey && apiKey !== 're_xxx') {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { Resend } = require('resend')
        this.resend = new Resend(apiKey)
      } catch {
        this.logger.warn('Resend module not available')
      }
    }
  }

  async sendWeeklyReport(userId: number): Promise<{ sent: boolean; reason?: string }> {
    if (!this.resend) {
      return { sent: false, reason: 'RESEND_API_KEY not configured' }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) return { sent: false, reason: 'User not found' }

    const recipes = await this.prisma.recipe.findMany({
      where: { userId },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
    })

    // Compute food costs
    const recipesWithFc = recipes.map((r) => {
      const totalCost = r.items.reduce((sum, item) => {
        return sum + Number(item.quantity) * Number(item.ingredient.currentPrice)
      }, 0)
      const sellingPrice = Number(r.sellingPrice)
      const fcPct = sellingPrice > 0 ? (totalCost / sellingPrice) * 100 : 0
      return { name: r.name, category: r.category, fcPct: Math.round(fcPct * 10) / 10, sellingPrice, totalCost }
    })

    const avgFc = recipesWithFc.length
      ? recipesWithFc.reduce((s, r) => s + r.fcPct, 0) / recipesWithFc.length
      : 0

    const toWatch = recipesWithFc.filter((r) => r.fcPct > 30).sort((a, b) => b.fcPct - a.fcPct)

    // Price evolution
    const ingredients = await this.prisma.ingredient.findMany({
      where: { userId },
      include: {
        priceHistory: { orderBy: { recordedAt: 'desc' }, take: 2 },
      },
    })

    const priceAlerts = ingredients
      .filter((ing) => ing.priceHistory.length >= 2)
      .map((ing) => {
        const latest = Number(ing.priceHistory[0].price)
        const prev = Number(ing.priceHistory[1].price)
        const rise = prev > 0 ? ((latest - prev) / prev) * 100 : 0
        return { name: ing.name, rise: Math.round(rise * 10) / 10, latest }
      })
      .filter((a) => Math.abs(a.rise) >= 5)
      .sort((a, b) => Math.abs(b.rise) - Math.abs(a.rise))

    const restaurantName = user.restaurant || `${user.firstName} ${user.lastName}`
    const fcColor = avgFc <= 25 ? '#10b981' : avgFc <= 30 ? '#f59e0b' : '#ef4444'

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0a0a0f 0%,#111118 100%);padding:32px 40px;text-align:center;">
          <div style="font-size:32px;margin-bottom:8px;">🍳</div>
          <div style="color:#f59e0b;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Chef IA</div>
          <div style="color:#a1a1aa;font-size:13px;margin-top:4px;">Rapport hebdomadaire — ${restaurantName}</div>
        </td></tr>

        <!-- Food cost -->
        <tr><td style="padding:32px 40px 0;">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:13px;color:#64748b;margin-bottom:8px;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;">Food Cost Moyen de la semaine</div>
            <div style="font-size:56px;font-weight:800;color:${fcColor};line-height:1;">${avgFc.toFixed(1)} %</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px;">Seuil recommandé : ≤ 30 %</div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:24px;">
            <tr>
              <td style="text-align:center;padding:8px;">
                <div style="font-size:24px;font-weight:700;color:#0f172a;">${recipes.length}</div>
                <div style="font-size:11px;color:#64748b;">recettes</div>
              </td>
              <td style="text-align:center;padding:8px;border-left:1px solid #e2e8f0;">
                <div style="font-size:24px;font-weight:700;color:#10b981;">${recipesWithFc.filter((r) => r.fcPct <= 30).length}</div>
                <div style="font-size:11px;color:#64748b;">rentables</div>
              </td>
              <td style="text-align:center;padding:8px;border-left:1px solid #e2e8f0;">
                <div style="font-size:24px;font-weight:700;color:#ef4444;">${toWatch.length}</div>
                <div style="font-size:11px;color:#64748b;">à surveiller</div>
              </td>
            </tr>
          </table>
        </td></tr>

        ${toWatch.length > 0 ? `
        <!-- Recipes to watch -->
        <tr><td style="padding:0 40px 24px;">
          <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:12px;">⚠️ Recettes à surveiller</div>
          ${toWatch.slice(0, 5).map((r) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#fff8f0;border:1px solid #fed7aa;border-radius:8px;margin-bottom:8px;">
            <div>
              <div style="font-size:13px;font-weight:600;color:#92400e;">${r.name}</div>
              ${r.category ? `<div style="font-size:11px;color:#b45309;">${r.category}</div>` : ''}
            </div>
            <div style="font-size:16px;font-weight:700;color:#ef4444;">${r.fcPct} %</div>
          </div>`).join('')}
        </td></tr>` : `
        <tr><td style="padding:0 40px 24px;">
          <div style="text-align:center;padding:20px;background:#f0fdf4;border-radius:12px;">
            <div style="font-size:20px;margin-bottom:4px;">✅</div>
            <div style="font-size:13px;color:#166534;font-weight:500;">Toutes vos recettes sont rentables !</div>
          </div>
        </td></tr>`}

        ${priceAlerts.length > 0 ? `
        <!-- Price alerts -->
        <tr><td style="padding:0 40px 24px;">
          <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:12px;">📈 Variations de prix notables</div>
          ${priceAlerts.slice(0, 4).map((a) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid #f1f5f9;">
            <div style="font-size:13px;color:#334155;">${a.name}</div>
            <div style="font-size:13px;font-weight:600;color:${a.rise > 0 ? '#ef4444' : '#10b981'};">${a.rise > 0 ? '+' : ''}${a.rise} %</div>
          </div>`).join('')}
        </td></tr>` : ''}

        <!-- CTA -->
        <tr><td style="padding:24px 40px 40px;text-align:center;">
          <a href="${process.env.FRONTEND_URL || 'https://chefai-web.vercel.app'}/dashboard"
             style="display:inline-block;background:#f59e0b;color:#000000;font-weight:700;font-size:15px;padding:14px 32px;border-radius:999px;text-decoration:none;">
            Voir mon dashboard →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <div style="font-size:11px;color:#94a3b8;">Chef IA · Rapport automatique du lundi · <a href="#" style="color:#94a3b8;">Se désabonner</a></div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

    try {
      await this.resend.emails.send({
        from: 'Chef IA <rapport@chefai.fr>',
        to: user.email,
        subject: `📊 Votre rapport hebdomadaire — Food cost moyen : ${avgFc.toFixed(1)} %`,
        html,
      })
      this.logger.log(`Weekly report sent to ${user.email}`)
      return { sent: true }
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${user.email}: ${err.message}`)
      return { sent: false, reason: err.message }
    }
  }
}
