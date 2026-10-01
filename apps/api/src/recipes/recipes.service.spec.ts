import { Test, TestingModule } from '@nestjs/testing'
import { BadRequestException, ConflictException } from '@nestjs/common'
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
    isPreparation: false,
    items: [
      { ingredientId: 1, subRecipeId: null, quantity: 0.2, unit: null,
        ingredient: { id: 1, name: 'Saumon', unit: 'kg', currentPrice: 10 } },
    ],
    ...overrides,
  }
}

describe('RecipesService', () => {
  let service: RecipesService
  let prisma: {
    recipe: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock }
    ingredient: { findMany: jest.Mock }
    recipeItem: { deleteMany: jest.Mock }
    $transaction: jest.Mock
  }

  beforeEach(async () => {
    prisma = {
      recipe: {
        findMany: jest.fn().mockResolvedValue([buildRecipe()]),
        findFirst: jest.fn().mockResolvedValue(buildRecipe()),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve(buildRecipe({ isActive: data.isActive })),
        ),
      },
      ingredient: { findMany: jest.fn().mockResolvedValue([]) },
      recipeItem: { deleteMany: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
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
        buildRecipe({ items: [{ ingredientId: 1, subRecipeId: null, quantity: 0.5, unit: null,
          ingredient: { id: 1, name: 'Saumon', unit: 'kg', currentPrice: 10 } }] }),
      ])

      const [recipe] = await service.findAll(1)

      expect(recipe.foodCost.ragStatus).toBe('red')
      expect(recipe.foodCost.isRentable).toBe(false)
    })
  })

  describe('plats actifs', () => {
    const menu = () => [
      buildRecipe({ id: 1, name: 'Saumon' }),
      buildRecipe({ id: 2, name: 'Pot-au-feu', isActive: false }),
      buildRecipe({ id: 3, name: 'Béarnaise', isPreparation: true, yieldQuantity: 1, yieldUnit: 'L' }),
    ]

    it('renvoie tout par défaut, plats retirés et préparations compris', async () => {
      prisma.recipe.findMany.mockResolvedValue(menu())

      const recipes = await service.findAll(1)

      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      )
      expect(recipes.map((r) => r.name)).toEqual(['Saumon', 'Pot-au-feu', 'Béarnaise'])
    })

    it('restreint aux plats à la carte quand activeOnly est demandé', async () => {
      prisma.recipe.findMany.mockResolvedValue(menu())

      const recipes = await service.findAll(1, true)

      expect(recipes.map((r) => r.name)).toEqual(['Saumon'])
    })

    it("exclut plats retirés et préparations de l'analyse de menu", async () => {
      prisma.recipe.findMany.mockResolvedValue(menu())

      const analysis = await service.getMenuAnalysis(1)

      expect(analysis.totalRecipes).toBe(1)
    })

    it('bascule isActive sans supprimer la recette', async () => {
      let active = true
      prisma.recipe.findMany.mockImplementation(() => Promise.resolve([buildRecipe({ isActive: active })]))
      prisma.recipe.update.mockImplementation(({ data }) => {
        active = data.isActive
        return Promise.resolve({})
      })

      const result = await service.setActive(1, 1, false)

      expect(prisma.recipe.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { isActive: false } })
      expect(result.isActive).toBe(false)
      expect(result.foodCost).toBeDefined()
    })
  })

  describe('sous-recettes', () => {
    // Béarnaise : 0,5 kg de beurre à 10 €/kg = 5 € pour 1 L → 5 €/L
    // Entrecôte : 0,3 kg de bœuf à 30 €/kg (9 €) + 10 cl de béarnaise (0,50 €), vendue 30 €
    const bearnaise = () =>
      buildRecipe({
        id: 10,
        name: 'Béarnaise',
        sellingPrice: 0,
        isPreparation: true,
        yieldQuantity: 1,
        yieldUnit: 'L',
        items: [{ ingredientId: 1, subRecipeId: null, quantity: 0.5, unit: null,
          ingredient: { id: 1, name: 'Beurre', unit: 'kg', currentPrice: 10 } }],
      })
    const entrecote = () =>
      buildRecipe({
        id: 11,
        name: 'Entrecôte',
        sellingPrice: 30,
        items: [
          { ingredientId: 2, subRecipeId: null, quantity: 300, unit: 'g',
            ingredient: { id: 2, name: 'Bœuf', unit: 'kg', currentPrice: 30 } },
          { ingredientId: null, subRecipeId: 10, quantity: 10, unit: 'cl', ingredient: null },
        ],
      })

    beforeEach(() => {
      prisma.recipe.findMany.mockResolvedValue([bearnaise(), entrecote()])
    })

    it('intègre le coût de la préparation, unités converties', async () => {
      const recipes = await service.findAll(1)
      const plat = recipes.find((r) => r.id === 11)!
      const sauce = recipes.find((r) => r.id === 10)!

      expect(sauce.unitCost).toBe(5)
      expect(sauce.unitCostUnit).toBe('L')
      expect(sauce.usedIn).toEqual([{ id: 11, name: 'Entrecôte' }])
      expect(plat.foodCost.ingredientCost).toBe(9.5)
      expect(plat.foodCost.foodCostPercent).toBe(31.67)
    })

    it('propage une hausse de prix à travers la sous-recette', async () => {
      // Beurre 10 → 20 €/kg : sauce 10 €/L, entrecôte 9 + 1 = 10 €
      const impact = await service.priceImpact(1, new Map([[1, 20]]))

      const plat = impact.find((r) => r.recipeId === 11)!
      expect(plat.costBefore).toBe(9.5)
      expect(plat.costAfter).toBe(10)
      // Prix qui ramène le food cost à 31,67 % : 10 / 0,3167 ≈ 31,58 → 31,60
      expect(plat.suggestedPrice).toBe(31.6)
      // Les plats passent avant les préparations
      expect(impact[0].recipeId).toBe(11)
    })

    it('refuse la suppression d’une préparation encore utilisée', async () => {
      await expect(service.remove(10, 1)).rejects.toThrow(ConflictException)
    })

    it('refuse une boucle de sous-recettes', async () => {
      // La béarnaise devient elle-même un plat contenant… l'entrecôte, qui la contient
      const sauceUsingDish = bearnaise()
      prisma.recipe.findMany.mockResolvedValue([
        sauceUsingDish,
        { ...entrecote(), isPreparation: true, yieldQuantity: 1, yieldUnit: null },
      ])
      prisma.ingredient.findMany.mockResolvedValue([])

      await expect(
        service.update(10, 1, { items: [{ subRecipeId: 11, quantity: 1 }] }),
      ).rejects.toThrow(BadRequestException)
    })

    it("refuse un dosage dans une unité incompatible avec l'ingrédient", async () => {
      prisma.ingredient.findMany.mockResolvedValue([{ id: 1, name: 'Beurre', unit: 'kg' }])

      await expect(
        service.create(1, { name: 'Test', items: [{ ingredientId: 1, quantity: 2, unit: 'cl' }] }),
      ).rejects.toThrow(BadRequestException)
    })
  })
})
