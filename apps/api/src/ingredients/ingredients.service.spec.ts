import { Test, TestingModule } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { IngredientsService } from './ingredients.service'
import { PrismaService } from '../prisma/prisma.service'

describe('IngredientsService', () => {
  let service: IngredientsService
  let prisma: {
    ingredient: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock; findMany: jest.Mock }
    priceHistory: { create: jest.Mock }
  }

  beforeEach(async () => {
    prisma = {
      ingredient: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, currentPrice: 10, name: 'Beurre' }),
        create: jest.fn().mockResolvedValue({ id: 1, currentPrice: 10 }),
        update: jest.fn().mockResolvedValue({ id: 1, currentPrice: 12 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      priceHistory: { create: jest.fn().mockResolvedValue({}) },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [IngredientsService, { provide: PrismaService, useValue: prisma }],
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
})
