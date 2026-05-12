import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

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
}
