import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
import { IngredientsService } from './ingredients.service'
import { PrismaService } from '../prisma/prisma.service'
import { RecipesService } from '../recipes/recipes.service'
import { NotificationsService } from '../notifications/notifications.service'

describe('IngredientsService', () => {
  let service: IngredientsService
  let recipes: { priceImpact: jest.Mock }
  let notifications: { notifyPriceImpact: jest.Mock }
  let prisma: {
    ingredient: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; findMany: jest.Mock }
    priceHistory: { create: jest.Mock }
    recipeItem: { findMany: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      ingredient: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, currentPrice: 10, name: 'Beurre' }),
        create: jest.fn().mockResolvedValue({ id: 1, currentPrice: 10 }),
        update: jest.fn().mockResolvedValue({ id: 1, currentPrice: 12, name: 'Beurre' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      priceHistory: { create: jest.fn().mockResolvedValue({}) },
      recipeItem: { findMany: jest.fn().mockResolvedValue([]) },
    }

    recipes = { priceImpact: jest.fn().mockResolvedValue([]) }
    notifications = { notifyPriceImpact: jest.fn().mockResolvedValue(null) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngredientsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RecipesService, useValue: recipes },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile()

    service = module.get<IngredientsService>(IngredientsService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('historique des prix', () => {
    it('enregistre le prix initial à la création', async () => {
      await service.create(1, { name: 'Beurre', unit: 'kg', currentPrice: 10 } as any)

      expect(prisma.priceHistory.create).toHaveBeenCalledWith({
        data: { ingredientId: 1, price: 10, source: 'manual' },
      })
    })

    it('enregistre une ligne quand le prix change', async () => {
      await service.update(1, 1, { currentPrice: 12 } as any)

      expect(prisma.priceHistory.create).toHaveBeenCalledWith({
        data: { ingredientId: 1, price: 12, source: 'manual' },
      })
    })

    it("n'enregistre rien quand le prix est identique", async () => {
      await service.update(1, 1, { currentPrice: 10 } as any)

      expect(prisma.priceHistory.create).not.toHaveBeenCalled()
    })

    it("n'enregistre rien quand la mise à jour ne touche pas au prix", async () => {
      await service.update(1, 1, { name: 'Beurre doux' } as any)

      expect(prisma.priceHistory.create).not.toHaveBeenCalled()
    })
  })

  describe('cloisonnement par utilisateur', () => {
    it('filtre toujours sur userId', async () => {
      await service.findOne(1, 42)

      expect(prisma.ingredient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, userId: 42 } }),
      )
    })

    it("lève une 404 pour un ingrédient qui n'appartient pas à l'utilisateur", async () => {
      prisma.ingredient.findFirst.mockResolvedValue(null)

      await expect(service.findOne(1, 42)).rejects.toThrow(NotFoundException)
    })
  })

  describe('impact des changements de prix', () => {
    it("calcule l'impact avec le nouveau prix et notifie", async () => {
      const row = { recipeId: 3, name: 'Croissant', isPreparation: false, isActive: true,
        sellingPrice: 2, costBefore: 0.4, costAfter: 0.5, foodCostBefore: 20, foodCostAfter: 25, suggestedPrice: 2.5 }
      recipes.priceImpact.mockResolvedValue([row])

      const result = await service.update(1, 1, { currentPrice: 12 } as any)

      expect(recipes.priceImpact).toHaveBeenCalledWith(1, new Map([[1, 12]]))
      expect(notifications.notifyPriceImpact).toHaveBeenCalledWith(1, 'Prix de Beurre', [row])
      expect(result.impact).toEqual([row])
    })

    it('ne calcule rien quand le prix ne change pas', async () => {
      await service.update(1, 1, { name: 'Beurre doux' } as any)

      expect(recipes.priceImpact).not.toHaveBeenCalled()
      expect(notifications.notifyPriceImpact).not.toHaveBeenCalled()
    })
  })

  describe('garde-fous', () => {
    it("refuse la suppression d'un ingrédient utilisé dans une recette", async () => {
      prisma.recipeItem.findMany.mockResolvedValue([{ recipe: { name: 'Croissant' } }])

      await expect(service.remove(1, 1)).rejects.toThrow(ConflictException)
    })

    it("refuse un changement d'unité incompatible avec les dosages existants", async () => {
      prisma.ingredient.findFirst.mockResolvedValue({ id: 1, currentPrice: 10, name: 'Beurre', unit: 'kg' })
      prisma.recipeItem.findMany.mockResolvedValue([{ unit: 'g', recipe: { name: 'Croissant' } }])

      await expect(service.update(1, 1, { unit: 'pièce' } as any)).rejects.toThrow(BadRequestException)
    })
  })
})
