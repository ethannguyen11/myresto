import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { FRENCH_INGREDIENTS } from './data/ingredients'

function removeAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function normalize(str: string): string {
  return removeAccents(str.toLowerCase().trim())
}

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  search(query?: string, category?: string) {
    let results = [...FRENCH_INGREDIENTS]

    if (category && category !== 'all') {
      results = results.filter((i) => i.category === category)
    }

    if (query && query.trim().length > 0) {
      const q = normalize(query)
      results = results.filter((i) => normalize(i.name).includes(q))
    }

    return results.slice(0, 50).map((i, idx) => ({ ...i, idx: FRENCH_INGREDIENTS.indexOf(i) }))
  }

  getCategories() {
    const cats = [...new Set(FRENCH_INGREDIENTS.map((i) => i.category))]
    return cats.map((cat) => ({
      name: cat,
      count: FRENCH_INGREDIENTS.filter((i) => i.category === cat).length,
    }))
  }

  async importIngredients(userId: number, indices: number[]) {
    let imported = 0
    let skipped = 0

    for (const idx of indices) {
      const lib = FRENCH_INGREDIENTS[idx]
      if (!lib) continue

      const existing = await this.prisma.ingredient.findFirst({
        where: { userId, name: { equals: lib.name, mode: 'insensitive' } },
      })

      if (existing) {
        skipped++
        continue
      }

      await this.prisma.ingredient.create({
        data: {
          userId,
          name: lib.name,
          category: lib.category,
          unit: lib.unit,
          currentPrice: lib.avgPrice,
          priceHistory: {
            create: {
              price: lib.avgPrice,
              source: 'library',
            },
          },
        },
      })
      imported++
    }

    return { imported, skipped }
  }
}
