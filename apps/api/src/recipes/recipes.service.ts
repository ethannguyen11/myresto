import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  // Calcule le food cost d'une recette
  private calculateFoodCost(items: any[], sellingPrice: any) {
    // Coût total des ingrédients
    const totalCost = items.reduce((sum, item) => {
      const ingredientPrice = Number(item.ingredient.currentPrice)
      const quantity = Number(item.quantity)
      return sum + ingredientPrice * quantity
    }, 0)

    const selling = Number(sellingPrice)
    const foodCostPercent = selling > 0 ? (totalCost / selling) * 100 : 0
    const profitPerDish = selling - totalCost
    const isRentable = foodCostPercent <= 30 // seuil standard restauration

    return {
      totalCost: Math.round(totalCost * 100) / 100,
      sellingPrice: selling,
      foodCostPercent: Math.round(foodCostPercent * 100) / 100,
      profitPerDish: Math.round(profitPerDish * 100) / 100,
      isRentable,
      status: foodCostPercent <= 25
        ? '🟢 Excellent'
        : foodCostPercent <= 30
        ? '🟡 Correct'
        : foodCostPercent <= 35
        ? '🟠 Attention'
        : '🔴 Non rentable',
    }
  }

  // Récupère toutes les recettes avec leur food cost calculé
  async findAll(userId: number) {
    const recipes = await this.prisma.recipe.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
    })

    return recipes.map(recipe => ({
      ...recipe,
      foodCost: this.calculateFoodCost(recipe.items, recipe.sellingPrice),
    }))
  }

  // Récupère une recette par ID
  async findOne(id: number, userId: number) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
    })
    if (!recipe) throw new NotFoundException('Recette introuvable')

    return {
      ...recipe,
      foodCost: this.calculateFoodCost(recipe.items, recipe.sellingPrice),
    }
  }

  // Crée une recette avec ses ingrédients
  async create(userId: number, dto: CreateRecipeDto) {
    const recipe = await this.prisma.recipe.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        sellingPrice: dto.sellingPrice,
        vatRate: dto.vatRate ?? 0.10,
        notes: dto.notes,
        items: {
          create: dto.items.map(item => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
    })

    return {
      ...recipe,
      foodCost: this.calculateFoodCost(recipe.items, recipe.sellingPrice),
    }
  }

  // Met à jour une recette
  async update(id: number, userId: number, dto: UpdateRecipeDto) {
    await this.findOne(id, userId)

    // Si les items sont mis à jour, on supprime les anciens et recrée
    if (dto.items) {
      await this.prisma.recipeItem.deleteMany({ where: { recipeId: id } })
    }

    const recipe = await this.prisma.recipe.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        sellingPrice: dto.sellingPrice,
        vatRate: dto.vatRate,
        notes: dto.notes,
        ...(dto.items && {
          items: {
            create: dto.items.map(item => ({
              ingredientId: item.ingredientId,
              quantity: item.quantity,
              notes: item.notes,
            })),
          },
        }),
      },
      include: {
        items: {
          include: { ingredient: true },
        },
      },
    })

    return {
      ...recipe,
      foodCost: this.calculateFoodCost(recipe.items, recipe.sellingPrice),
    }
  }

  // Supprime une recette
  async remove(id: number, userId: number) {
    await this.findOne(id, userId)
    await this.prisma.recipeItem.deleteMany({ where: { recipeId: id } })
    return this.prisma.recipe.delete({ where: { id } })
  }

  // Analyse de rentabilité globale de la carte
  async getMenuAnalysis(userId: number) {
    const recipes = await this.findAll(userId)

    const analysis = {
      totalRecipes: recipes.length,
      rentableCount: recipes.filter(r => r.foodCost.isRentable).length,
      nonRentableCount: recipes.filter(r => !r.foodCost.isRentable).length,
      averageFoodCost: 0,
      bestDish: null as any,
      worstDish: null as any,
      alerts: [] as string[],
    }

    if (recipes.length > 0) {
      analysis.averageFoodCost = Math.round(
        recipes.reduce((sum, r) => sum + r.foodCost.foodCostPercent, 0) / recipes.length * 100
      ) / 100

      analysis.bestDish = recipes.reduce((best, r) =>
        r.foodCost.profitPerDish > (best?.foodCost.profitPerDish ?? -Infinity) ? r : best
      )

      analysis.worstDish = recipes.reduce((worst, r) =>
        r.foodCost.foodCostPercent > (worst?.foodCost.foodCostPercent ?? -Infinity) ? r : worst
      )

      // Génère des alertes
      recipes.forEach(recipe => {
        if (recipe.foodCost.foodCostPercent > 35) {
          analysis.alerts.push(
            `⚠️ "${recipe.name}" a un food cost de ${recipe.foodCost.foodCostPercent}% — non rentable`
          )
        }
      })
    }

    return analysis
  }
}