import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateRecipeDto } from './dto/create-recipe.dto'
import { UpdateRecipeDto } from './dto/update-recipe.dto'

@Injectable()
export class RecipesService {
  constructor(private prisma: PrismaService) {}

  private round(n: number): number {
    return Math.round(n * 100) / 100
  }

  private calculateFoodCost(items: any[], sellingPrice: any, recipe?: any) {
    // Coût ingrédients brut
    const ingredientCost = items.reduce((sum, item) => {
      return sum + Number(item.ingredient.currentPrice) * Number(item.quantity)
    }, 0)

    // Coût avec pertes matière
    const wastage = Number(recipe?.wastagePercent ?? 0) / 100
    const ingredientCostWithWaste = ingredientCost * (1 + wastage)

    // Coût total réel = ingrédients + pertes uniquement
    const totalRealCost = ingredientCostWithWaste

    const selling = Number(sellingPrice)

    // Food cost % (ingrédients seulement — métrique classique)
    const foodCostPercent = selling > 0 ? (ingredientCost / selling) * 100 : 0

    // Coût réel % (ingrédients + pertes)
    const realCostPercent = selling > 0 ? (totalRealCost / selling) * 100 : 0

    // RAG Status basé sur le coût réel
    const ragStatus: 'green' | 'amber' | 'red' =
      realCostPercent <= 30 ? 'green' : realCostPercent <= 40 ? 'amber' : 'red'

    return {
      totalCost: this.round(ingredientCost),                    // compat
      ingredientCost: this.round(ingredientCost),
      ingredientCostWithWaste: this.round(ingredientCostWithWaste),
      totalRealCost: this.round(totalRealCost),
      sellingPrice: selling,
      foodCostPercent: this.round(foodCostPercent),
      realCostPercent: this.round(realCostPercent),
      profitPerDish: this.round(selling - ingredientCost),      // compat
      realProfitPerDish: this.round(selling - totalRealCost),
      isRentable: foodCostPercent <= 30,
      ragStatus,
      status: foodCostPercent <= 25
        ? '🟢 Excellent'
        : foodCostPercent <= 30
        ? '🟡 Correct'
        : foodCostPercent <= 35
        ? '🟠 Attention'
        : '🔴 Non rentable',
    }
  }

  async findAll(userId: number) {
    const recipes = await this.prisma.recipe.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        items: { include: { ingredient: true } },
      },
    })

    return recipes.map(recipe => ({
      ...recipe,
      foodCost: this.calculateFoodCost(recipe.items, recipe.sellingPrice, recipe),
    }))
  }

  async findOne(id: number, userId: number) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id, userId },
      include: {
        items: { include: { ingredient: true } },
      },
    })
    if (!recipe) throw new NotFoundException('Recette introuvable')

    return {
      ...recipe,
      foodCost: this.calculateFoodCost(recipe.items, recipe.sellingPrice, recipe),
    }
  }

  async create(userId: number, dto: CreateRecipeDto) {
    const recipe = await this.prisma.recipe.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        sellingPrice: dto.sellingPrice,
        vatRate: dto.vatRate ?? 0.10,
        notes: dto.notes,
        prepTimeMinutes: dto.prepTimeMinutes,
        servings: dto.servings ?? 1,
        wastagePercent: dto.wastagePercent ?? 0,
        items: {
          create: dto.items.map(item => ({
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            notes: item.notes,
          })),
        },
      },
      include: {
        items: { include: { ingredient: true } },
      },
    })

    return {
      ...recipe,
      foodCost: this.calculateFoodCost(recipe.items, recipe.sellingPrice, recipe),
    }
  }

  async update(id: number, userId: number, dto: UpdateRecipeDto) {
    await this.findOne(id, userId)

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
        prepTimeMinutes: dto.prepTimeMinutes,
        ...(dto.servings !== undefined && { servings: dto.servings }),
        ...(dto.wastagePercent !== undefined && { wastagePercent: dto.wastagePercent }),
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
        items: { include: { ingredient: true } },
      },
    })

    return {
      ...recipe,
      foodCost: this.calculateFoodCost(recipe.items, recipe.sellingPrice, recipe),
    }
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId)
    await this.prisma.recipeItem.deleteMany({ where: { recipeId: id } })
    return this.prisma.recipe.delete({ where: { id } })
  }

  async getMenuAnalysis(userId: number) {
    const recipes = await this.findAll(userId)

    const analysis = {
      totalRecipes: recipes.length,
      rentableCount: recipes.filter(r => r.foodCost.isRentable).length,
      nonRentableCount: recipes.filter(r => !r.foodCost.isRentable).length,
      ragGreen: recipes.filter(r => r.foodCost.ragStatus === 'green').length,
      ragAmber: recipes.filter(r => r.foodCost.ragStatus === 'amber').length,
      ragRed: recipes.filter(r => r.foodCost.ragStatus === 'red').length,
      averageFoodCost: 0,
      averageRealCost: 0,
      bestDish: null as any,
      worstDish: null as any,
      alerts: [] as string[],
    }

    if (recipes.length > 0) {
      analysis.averageFoodCost = this.round(
        recipes.reduce((sum, r) => sum + r.foodCost.foodCostPercent, 0) / recipes.length
      )
      analysis.averageRealCost = this.round(
        recipes.reduce((sum, r) => sum + r.foodCost.realCostPercent, 0) / recipes.length
      )

      analysis.bestDish = recipes.reduce((best, r) =>
        r.foodCost.realProfitPerDish > (best?.foodCost.realProfitPerDish ?? -Infinity) ? r : best
      )

      analysis.worstDish = recipes.reduce((worst, r) =>
        r.foodCost.realCostPercent > (worst?.foodCost.realCostPercent ?? -Infinity) ? r : worst
      )

      recipes.forEach(recipe => {
        if (recipe.foodCost.ragStatus === 'red') {
          analysis.alerts.push(
            `⚠️ "${recipe.name}" — coût réel ${recipe.foodCost.realCostPercent}% (food cost ${recipe.foodCost.foodCostPercent}%)`
          )
        }
      })
    }

    return analysis
  }
}
