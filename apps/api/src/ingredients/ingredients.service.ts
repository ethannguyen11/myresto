import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateIngredientDto } from './dto/create-ingredient.dto'
import { UpdateIngredientDto } from './dto/update-ingredient.dto'

@Injectable()
export class IngredientsService {
  constructor(private prisma: PrismaService) {}

  // Récupère tous les ingrédients d'un utilisateur
  async findAll(userId: number) {
    return this.prisma.ingredient.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'desc' },
          take: 5,
        },
      },
    })
  }

  // Récupère un ingrédient par ID
  async findOne(id: number, userId: number) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, userId },
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'desc' },
        },
      },
    })
    if (!ingredient) throw new NotFoundException('Ingrédient introuvable')
    return ingredient
  }

  // Crée un ingrédient + enregistre le prix dans l'historique
  async create(userId: number, dto: CreateIngredientDto) {
    const ingredient = await this.prisma.ingredient.create({
      data: {
        userId,
        name: dto.name,
        unit: dto.unit,
        currentPrice: dto.currentPrice,
        category: dto.category,
      },
    })

    // Enregistre le prix initial dans l'historique
    await this.prisma.priceHistory.create({
      data: {
        ingredientId: ingredient.id,
        price: dto.currentPrice,
        source: 'manual',
      },
    })

    return ingredient
  }

  // Met à jour un ingrédient
  async update(id: number, userId: number, dto: UpdateIngredientDto) {
    const ingredient = await this.findOne(id, userId)

    // Si le prix change, on l'enregistre dans l'historique
    if (dto.currentPrice && dto.currentPrice !== Number(ingredient.currentPrice)) {
      await this.prisma.priceHistory.create({
        data: {
          ingredientId: id,
          price: dto.currentPrice,
          source: 'manual',
        },
      })
    }

    return this.prisma.ingredient.update({
      where: { id },
      data: {
        name: dto.name,
        unit: dto.unit,
        currentPrice: dto.currentPrice,
        category: dto.category,
      },
    })
  }

  // Supprime un ingrédient
  async remove(id: number, userId: number) {
    await this.findOne(id, userId)
    return this.prisma.ingredient.delete({ where: { id } })
  }

  // Récupère l'historique des prix d'un ingrédient
  async getPriceHistory(id: number, userId: number) {
    await this.findOne(id, userId)
    return this.prisma.priceHistory.findMany({
      where: { ingredientId: id },
      orderBy: { recordedAt: 'desc' },
    })
  }
}