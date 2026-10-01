import { Test, TestingModule } from '@nestjs/testing'
import { RecipesService } from './recipes.service'
import { PrismaService } from '../prisma/prisma.service'

/**
 * Recette factice : 0,2 kg d'un ingrédient à 10 €/kg = 2 € de coût,
 * vendue 10 € → food cost de 20 %.
 */
function buildRecipe(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    userId: 1,
    name: 'Filet de saumon',
    sellingPrice: 10,
    wastagePercent: 0,
    isActive: true,
    items: [
      { quantity: 0.2, ingredient: { currentPrice: 10 } },
    ],
    ...overrides,
  }
}

describe('RecipesService', () => {
  let service: RecipesService
  let prisma: { recipe: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock } }

  beforeEach(async () => {
    prisma = {
      recipe: {
        findMany: jest.fn().mockResolvedValue([buildRecipe()]),
        findFirst: jest.fn().mockResolvedValue(buildRecipe()),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve(buildRecipe({ isActive: data.isActive })),
        ),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [RecipesService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<RecipesService>(RecipesService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('calcul du food cost', () => {
    it('calcule le pourcentage et la marge à partir des ingrédients', async () => {
      const [recipe] = await service.findAll(1)

      expect(recipe.foodCost.ingredientCost).toBe(2)
      expect(recipe.foodCost.foodCostPercent).toBe(20)
      expect(recipe.foodCost.profitPerDish).toBe(8)
      expect(recipe.foodCost.isRentable).toBe(true)
      expect(recipe.foodCost.status).toContain('Excellent')
    })

    it('applique les pertes matière au coût réel, pas au food cost classique', async () => {
      prisma.recipe.findMany.mockResolvedValue([buildRecipe({ wastagePercent: 50 })])

      const [recipe] = await service.findAll(1)

      // Le food cost classique ignore les pertes...
      expect(recipe.foodCost.foodCostPercent).toBe(20)
      // ...mais le coût réel les intègre : 2 € × 1,5 = 3 € sur 10 €.
      expect(recipe.foodCost.ingredientCostWithWaste).toBe(3)
      expect(recipe.foodCost.realCostPercent).toBe(30)
      expect(recipe.foodCost.realProfitPerDish).toBe(7)
    })

    it('ne divise pas par zéro quand le prix de vente est nul', async () => {
      prisma.recipe.findMany.mockResolvedValue([buildRecipe({ sellingPrice: 0 })])

      const [recipe] = await service.findAll(1)

      expect(recipe.foodCost.foodCostPercent).toBe(0)
      expect(recipe.foodCost.realCostPercent).toBe(0)
    })

    it('classe un plat en rouge au-delà de 40 % de coût réel', async () => {
      // 0,5 kg à 10 €/kg = 5 €, vendu 10 € → 50 %
      prisma.recipe.findMany.mockResolvedValue([
        buildRecipe({ items: [{ quantity: 0.5, ingredient: { currentPrice: 10 } }] }),
      ])

      const [recipe] = await service.findAll(1)

      expect(recipe.foodCost.ragStatus).toBe('red')
      expect(recipe.foodCost.isRentable).toBe(false)
    })
  })

  describe('plats actifs', () => {
    it('renvoie tous les plats par défaut', async () => {
      await service.findAll(1)

      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      )
    })

    it("restreint aux plats à la carte quand activeOnly est demandé", async () => {
      await service.findAll(1, true)

      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, isActive: true } }),
      )
    })

    it("exclut les plats retirés de la carte de l'analyse de menu", async () => {
      await service.getMenuAnalysis(1)

      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, isActive: true } }),
      )
    })

    it('bascule isActive sans supprimer la recette', async () => {
      const result = await service.setActive(1, 1, false)

      expect(prisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 }, data: { isActive: false } }),
      )
      expect(result.isActive).toBe(false)
      expect(result.foodCost).toBeDefined()
    })
  })
})
