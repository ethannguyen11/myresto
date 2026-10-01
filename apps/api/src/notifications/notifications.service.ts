import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { PriceImpactRow } from '../recipes/recipes.service'

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async getUnreadCount(userId: number) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    })
    return { count }
  }

  async markAsRead(id: number, userId: number) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    })
  }

  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  }

  async delete(id: number, userId: number) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    })
  }

  async create(userId: number, type: string, title: string, message: string) {
    return this.prisma.notification.create({
      data: { userId, type, title, message },
    })
  }

  async upsertToday(userId: number, type: string, title: string, message: string) {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const existing = await this.prisma.notification.findFirst({
      where: {
        userId,
        type,
        title,
        createdAt: { gte: startOfDay },
      },
    })

    if (existing) return existing

    return this.prisma.notification.create({
      data: { userId, type, title, message },
    })
  }

  /**
   * Notifie l'effet d'un changement de prix sur les plats à la carte.
   * Rien n'est créé si aucun plat actif ne voit son food cost monter.
   */
  async notifyPriceImpact(userId: number, cause: string, rows: PriceImpactRow[]) {
    const hit = rows.filter(
      (r) => !r.isPreparation && r.isActive && r.foodCostAfter > r.foodCostBefore,
    )
    if (hit.length === 0) return null

    const top = hit
      .slice(0, 3)
      .map((r) => `${r.name} ${r.foodCostBefore}% → ${r.foodCostAfter}%`)
      .join(' · ')
    const more = hit.length > 3 ? ` (+${hit.length - 3} autre${hit.length > 4 ? 's' : ''})` : ''

    return this.create(
      userId,
      'price_increase',
      `📈 ${cause} : ${hit.length} plat${hit.length > 1 ? 's' : ''} impacté${hit.length > 1 ? 's' : ''}`,
      `${top}${more}`,
    )
  }
}
