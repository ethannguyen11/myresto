import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter } as any)

const USER_ID = 1

// ── Ingredient catalogue ────────────────────────────────────────────────────

const INGREDIENTS = [
  { name: 'Saumon Atlantique frais',   unit: 'kg',  price: 23.50, category: 'poisson' },
  { name: 'Beurre doux AOP',           unit: 'kg',  price: 7.80,  category: 'produit laitier' },
  { name: 'Farine T55',                unit: 'kg',  price: 0.85,  category: 'épicerie' },
  { name: 'Crème fraîche 35%',         unit: 'L',   price: 3.20,  category: 'produit laitier' },
  { name: 'Filet de bœuf',             unit: 'kg',  price: 42.00, category: 'viande' },
  { name: 'Huile d\'olive extra vierge', unit: 'L', price: 12.80, category: 'épicerie' },
  { name: 'Tomates cerises',           unit: 'kg',  price: 4.80,  category: 'légume' },
  { name: 'Parmesan AOP',              unit: 'kg',  price: 18.90, category: 'produit laitier' },
  { name: 'Champignons de Paris',      unit: 'kg',  price: 4.50,  category: 'légume' },
  { name: 'Fond de veau',              unit: 'kg',  price: 22.00, category: 'condiment' },
  { name: 'Magret de canard',          unit: 'kg',  price: 28.00, category: 'viande' },
  { name: 'Saint-Jacques (noix)',      unit: 'kg',  price: 45.00, category: 'poisson' },
  { name: 'Foie gras de canard',       unit: 'kg',  price: 85.00, category: 'viande' },
  { name: 'Crevettes gambas',          unit: 'kg',  price: 32.00, category: 'poisson' },
  { name: 'Truffe noire',              unit: 'kg',  price: 800.00, category: 'épicerie' },
] as const

// ── Price history variations (±% over 30 days) ─────────────────────────────
// Each entry: [daysAgo, variationPct] — positive = price was lower, negative = higher
const PRICE_HISTORY: Record<string, [number, number][]> = {
  'Saumon Atlantique frais':    [[30, -5], [15, -2]],   // hausse récente
  'Beurre doux AOP':            [[28, +4], [12, +2]],   // baisse récente
  'Farine T55':                 [[25, +1], [10, -1]],   // stable
  'Crème fraîche 35%':          [[20, -3], [8,  -1]],   // légère hausse
  'Filet de bœuf':              [[30, -8], [14, -4]],   // forte hausse
  'Huile d\'olive extra vierge': [[27, +6], [13, +3]],  // baisse récente
  'Tomates cerises':            [[22, -10], [7, -5]],   // saisonnalité
  'Parmesan AOP':               [[29, +2], [11, +1]],   // stable
  'Champignons de Paris':       [[26, +5], [9,  +2]],   // légère baisse
  'Fond de veau':               [[30, -3], [15, -1]],   // légère hausse
  'Magret de canard':           [[28, +4], [14, +2]],   // baisse récente
  'Saint-Jacques (noix)':       [[25, -12], [10, -6]],  // forte hausse
  'Foie gras de canard':        [[30, +3], [15, +1]],   // stable
  'Crevettes gambas':           [[27, -7], [12, -3]],   // hausse progressive
  'Truffe noire':               [[30, +15], [14, +7]],  // baisse récente (fin saison)
}

// ── Recipe definitions ──────────────────────────────────────────────────────

type RecipeDef = {
  name: string
  category: string
  sellingPrice: number
  items: { ingredientName: string; quantity: number }[]
}

const RECIPES: RecipeDef[] = [
  {
    name: 'Pavé de saumon beurre blanc',
    category: 'plat',
    sellingPrice: 24.00,
    items: [
      { ingredientName: 'Saumon Atlantique frais', quantity: 0.180 },
      { ingredientName: 'Beurre doux AOP',         quantity: 0.040 },
      { ingredientName: 'Crème fraîche 35%',       quantity: 0.030 },
    ],
  },
  {
    name: 'Tartare de bœuf maison',
    category: 'entrée',
    sellingPrice: 22.00,
    items: [
      { ingredientName: 'Filet de bœuf',             quantity: 0.150 },
      { ingredientName: 'Huile d\'olive extra vierge', quantity: 0.010 },
      { ingredientName: 'Tomates cerises',           quantity: 0.050 },
    ],
  },
  {
    name: 'Risotto aux champignons',
    category: 'plat',
    sellingPrice: 18.00,
    items: [
      { ingredientName: 'Champignons de Paris', quantity: 0.120 },
      { ingredientName: 'Parmesan AOP',         quantity: 0.030 },
      { ingredientName: 'Crème fraîche 35%',    quantity: 0.050 },
      { ingredientName: 'Beurre doux AOP',      quantity: 0.020 },
    ],
  },
  {
    name: 'Magret de canard aux figues',
    category: 'plat',
    sellingPrice: 28.00,
    items: [
      { ingredientName: 'Magret de canard', quantity: 0.200 },
      { ingredientName: 'Fond de veau',     quantity: 0.030 },
      { ingredientName: 'Beurre doux AOP',  quantity: 0.015 },
    ],
  },
  {
    name: 'Saint-Jacques poêlées',
    category: 'entrée',
    sellingPrice: 32.00,
    items: [
      { ingredientName: 'Saint-Jacques (noix)', quantity: 0.180 },
      { ingredientName: 'Beurre doux AOP',      quantity: 0.030 },
      { ingredientName: 'Crème fraîche 35%',    quantity: 0.020 },
    ],
  },
  {
    name: 'Foie gras maison',
    category: 'entrée',
    sellingPrice: 22.00,
    items: [
      { ingredientName: 'Foie gras de canard', quantity: 0.080 },
      { ingredientName: 'Beurre doux AOP',     quantity: 0.010 },
    ],
  },
  {
    name: 'Gambas à la plancha',
    category: 'plat',
    sellingPrice: 26.00,
    items: [
      { ingredientName: 'Crevettes gambas',          quantity: 0.200 },
      { ingredientName: 'Huile d\'olive extra vierge', quantity: 0.015 },
      { ingredientName: 'Beurre doux AOP',           quantity: 0.020 },
    ],
  },
  {
    name: 'Pasta truffe et parmesan',
    category: 'plat',
    sellingPrice: 45.00,
    items: [
      { ingredientName: 'Farine T55',          quantity: 0.120 },
      { ingredientName: 'Parmesan AOP',        quantity: 0.040 },
      { ingredientName: 'Truffe noire',        quantity: 0.005 },
      { ingredientName: 'Beurre doux AOP',     quantity: 0.025 },
      { ingredientName: 'Crème fraîche 35%',   quantity: 0.040 },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function priceAt(basePrice: number, variationPct: number): number {
  return Math.round(basePrice * (1 + variationPct / 100) * 100) / 100
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Démarrage du seed pour userId =', USER_ID)

  // ── 1. Ingredients ────────────────────────────────────────────────────────

  let ingredientsCreated = 0
  let ingredientsSkipped = 0
  const ingredientMap = new Map<string, number>() // name → id

  for (const ing of INGREDIENTS) {
    const existing = await prisma.ingredient.findFirst({
      where: { userId: USER_ID, name: ing.name },
    })

    let id: number
    if (existing) {
      id = existing.id
      ingredientsSkipped++
    } else {
      const created = await prisma.ingredient.create({
        data: {
          userId: USER_ID,
          name: ing.name,
          unit: ing.unit,
          currentPrice: ing.price,
          category: ing.category,
        },
      })
      id = created.id

      // Initial manual price entry
      await prisma.priceHistory.create({
        data: {
          ingredientId: id,
          price: ing.price,
          source: 'manual',
          recordedAt: daysAgo(35),
        },
      })

      // Simulated invoice price variations over 30 days
      const variations = PRICE_HISTORY[ing.name] ?? []
      for (const [days, pct] of variations) {
        await prisma.priceHistory.create({
          data: {
            ingredientId: id,
            price: priceAt(ing.price, pct),
            source: 'invoice',
            recordedAt: daysAgo(days),
          },
        })
      }

      ingredientsCreated++
    }
    ingredientMap.set(ing.name, id)
  }

  console.log(`  ✅ Ingrédients : ${ingredientsCreated} créés, ${ingredientsSkipped} déjà présents`)

  // ── 2. Recipes ────────────────────────────────────────────────────────────

  let recipesCreated = 0
  let recipesSkipped = 0

  for (const recipe of RECIPES) {
    const existing = await prisma.recipe.findFirst({
      where: { userId: USER_ID, name: recipe.name },
    })

    if (existing) {
      recipesSkipped++
      continue
    }

    const items = recipe.items.map((item) => {
      const ingredientId = ingredientMap.get(item.ingredientName)
      if (!ingredientId) throw new Error(`Ingrédient introuvable : ${item.ingredientName}`)
      return { ingredientId, quantity: item.quantity }
    })

    await prisma.recipe.create({
      data: {
        userId: USER_ID,
        name: recipe.name,
        category: recipe.category,
        sellingPrice: recipe.sellingPrice,
        vatRate: 0.10,
        items: { create: items },
      },
    })

    recipesCreated++
  }

  console.log(`  ✅ Recettes    : ${recipesCreated} créées, ${recipesSkipped} déjà présentes`)

  // ── 3. Summary ────────────────────────────────────────────────────────────

  const totalIngredients = await prisma.ingredient.count({ where: { userId: USER_ID } })
  const totalRecipes     = await prisma.recipe.count({ where: { userId: USER_ID } })
  const totalHistory     = await prisma.priceHistory.count()

  console.log('\n📊 État final de la base :')
  console.log(`  Ingrédients   : ${totalIngredients}`)
  console.log(`  Recettes      : ${totalRecipes}`)
  console.log(`  PriceHistory  : ${totalHistory} entrées`)
}

main()
  .catch((e) => { console.error('❌ Seed échoué :', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
