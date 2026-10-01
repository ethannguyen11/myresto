import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RecipesService } from '../recipes/recipes.service'
import { NotificationsService } from './notifications.service'

/** Seuil de food cost au-delà duquel un plat déclenche une alerte (en %). */
const FOOD_COST_ALERT_THRESHOLD = 35

/** Hausse de prix minimale pour alerter, entre les deux derniers relevés (en %). */
const PRICE_RISE_ALERT_THRESHOLD = 5

export interface AlertsSummary {
  foodCostAlerts: number
  priceIncreaseAlerts: number
}

/**
 * Génération des alertes « food cost » et « hausse de prix ».
 *
 * Cette logique vivait dans DashboardService.getDashboard() : les alertes
 * n'étaient donc créées qu'au moment où quelqu'un ouvrait le dashboard.
 * Un utilisateur qui ne se connectait pas n'était jamais alerté — alors que
 * c'est précisément lui qui en avait besoin.
 *
 * Elle est désormais appelée des deux côtés :
 *   - par AlertsScheduler, tous les matins, pour tout le monde ;
 *   - par le dashboard, pour l'utilisateur courant, afin qu'une recette
 *     tout juste saisie déclenche son alerte immédiatement.
 *
 * upsertToday() rend l'opération idempotente : deux passages le même jour ne
 * produisent pas de doublon.
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name)

  constructor(
    private prisma: PrismaService,
    private recipesService: RecipesService,
    private notificationsService: NotificationsService,
  ) {}

  async refreshForUser(userId: number): Promise<AlertsSummary> {
    const [recipes, ingredients] = await Promise.all([
      // Seuls les plats à la carte : inutile d'alerter sur un plat retiré.
      this.recipesService.findAll(userId, true),
      this.prisma.ingredient.findMany({
        where: { userId },
        select: {
          name: true,
          priceHistory: {
            orderBy: { recordedAt: 'asc' },
            select: { price: true },
          },
        },
      }),
    ])

    const summary: AlertsSummary = { foodCostAlerts: 0, priceIncreaseAlerts: 0 }

    for (const recipe of recipes) {
      if (recipe.foodCost.foodCostPercent <= FOOD_COST_ALERT_THRESHOLD) continue

      await this.notificationsService.upsertToday(
        userId,
        'food_cost',
        '⚠️ Recette non rentable',
        `${recipe.name} a un food cost de ${recipe.foodCost.foodCostPercent}%`,
      )
      summary.foodCostAlerts++
    }

    for (const ingredient of ingredients) {
      const history = ingredient.priceHistory
      if (history.length < 2) continue

      const previous = Number(history[history.length - 2].price)
      const latest = Number(history[history.length - 1].price)
      if (previous <= 0 || latest <= previous) continue

      const rise = Math.round(((latest - previous) / previous) * 1000) / 10
      if (rise < PRICE_RISE_ALERT_THRESHOLD) continue

      await this.notificationsService.upsertToday(
        userId,
        'price_increase',
        '📈 Hausse de prix',
        `${ingredient.name} a augmenté de ${rise}%`,
      )
      summary.priceIncreaseAlerts++
    }

    return summary
  }

  /**
   * Variante non bloquante, pour les appels depuis un chemin de lecture.
   * Une alerte qui n'a pas pu s'écrire ne doit jamais faire échouer
   * l'affichage du dashboard — mais elle doit se voir dans les logs, ce que
   * l'ancien `.catch(() => {})` empêchait.
   */
  refreshInBackground(userId: number): void {
    this.refreshForUser(userId).catch((err) => {
      this.logger.error(
        `Génération des alertes impossible pour l'utilisateur ${userId} : ${(err as Error).message}`,
      )
    })
  }
}
