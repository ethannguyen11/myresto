import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RecipesService } from '../recipes/recipes.service'
import { NotificationsService } from '../notifications/notifications.service'
import { areCompatible } from '../recipes/units'
import { CreateIngredientDto } from './dto/create-ingredient.dto'
import { UpdateIngredientDto } from './dto/update-ingredient.dto'

@Injectable()
export class IngredientsService {
  constructor(
    private prisma: PrismaService,
    private recipesService: RecipesService,
    private notificationsService: NotificationsService,
  ) {}

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

  /**
   * Met à jour un ingrédient.
   *
   * Si le prix change, la réponse porte `impact` : les plats dont le coût
   * bouge, avec leur food cost avant/après et un prix de vente conseillé.
   * Une notification est créée quand des plats à la carte sont touchés.
   */
  async update(id: number, userId: number, dto: UpdateIngredientDto) {
    const ingredient = await this.findOne(id, userId)

    // Changer d'unité ne doit pas rendre incohérentes les recettes qui dosent
    // cet ingrédient dans une unité explicite (200 g → passage en « pièce »)
    if (dto.unit && dto.unit !== ingredient.unit) {
      const usages = await this.prisma.recipeItem.findMany({
        where: { ingredientId: id, unit: { not: null } },
        include: { recipe: { select: { name: true } } },
      })
      const broken = usages.filter((u) => !areCompatible(u.unit, dto.unit))
      if (broken.length > 0) {
        throw new BadRequestException(
          `Impossible de passer en ${dto.unit} : ${[...new Set(broken.map((u) => u.recipe.name))].join(', ')} ` +
            `dose${broken.length > 1 ? 'nt' : ''} cet ingrédient en ${broken[0].unit}.`,
        )
      }
    }

    const priceChanged =
      dto.currentPrice != null && Number(dto.currentPrice) !== Number(ingredient.currentPrice)

    // L'impact se calcule avant l'écriture, tant que l'ancien prix est en base
    const impact = priceChanged
      ? await this.recipesService.priceImpact(userId, new Map([[id, Number(dto.currentPrice)]]))
      : []

    if (priceChanged) {
      await this.prisma.priceHistory.create({
        data: {
          ingredientId: id,
          price: dto.currentPrice!,
          source: 'manual',
        },
      })
    }

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        name: dto.name,
        unit: dto.unit,
        currentPrice: dto.currentPrice,
        category: dto.category,
      },
    })

    if (impact.length > 0) {
      await this.notificationsService.notifyPriceImpact(userId, `Prix de ${updated.name}`, impact)
    }

    return { ...updated, impact }
  }

  // Supprime un ingrédient — refusé s'il entre dans une recette
  async remove(id: number, userId: number) {
    await this.findOne(id, userId)
    const usages = await this.prisma.recipeItem.findMany({
      where: { ingredientId: id },
      include: { recipe: { select: { name: true } } },
    })
    if (usages.length > 0) {
      const names = [...new Set(usages.map((u) => u.recipe.name))]
      throw new ConflictException(
        `Cet ingrédient est utilisé dans : ${names.join(', ')}. Retirez-le de ces recettes d'abord.`,
      )
    }
    // L'historique de prix et les lignes de facture le référencent aussi
    await this.prisma.$transaction([
      this.prisma.priceHistory.deleteMany({ where: { ingredientId: id } }),
      this.prisma.invoiceItem.updateMany({ where: { ingredientId: id }, data: { ingredientId: null } }),
      this.prisma.invoiceMatchMemory.deleteMany({ where: { ingredientId: id, userId } }),
      this.prisma.ingredient.delete({ where: { id } }),
    ])
    return { id }
  }

  // Retourne les ingrédients groupés par catégorie pour la fiche de commande
  async getOrderSheet(userId: number) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, unit: true, currentPrice: true, category: true },
    })

    const groups = new Map<string, typeof ingredients>()
    for (const ing of ingredients) {
      const cat = ing.category ?? 'autre'
      if (!groups.has(cat)) groups.set(cat, [])
      groups.get(cat)!.push(ing)
    }

    return {
      categories: Array.from(groups.entries()).map(([name, items]) => ({ name, ingredients: items })),
      total: ingredients.length,
    }
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