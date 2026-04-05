import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class MatchingService {
  constructor(private prisma: PrismaService) {}

  normalizeText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // retire accents
      .toLowerCase()
      .replace(/\b\d+[\.,]?\d*\s*(kg|g|l|cl|ml|pcs?|pièces?|litres?|litre|kilo|kilos)\b/gi, '') // retire quantités+unités
      .replace(/\b(frais|fraiche|fraîche|surgelé|surgelée|surgele|congelé|congelee|aop|igp|bio|label\s*rouge|extra|vierge|doux|douce|entier|entière|entiere|superieur|superieure|pur|pure|nature|naturel|naturelle)\b/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private levenshtein(a: string, b: string): number {
    const m = a.length
    const n = b.length
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    )
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1]
        else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
    return dp[m][n]
  }

  similarityScore(a: string, b: string): number {
    if (a === b) return 1
    const maxLen = Math.max(a.length, b.length)
    if (maxLen === 0) return 1
    const dist = this.levenshtein(a, b)
    return 1 - dist / maxLen
  }

  findBestMatch(
    rawName: string,
    ingredients: { id: number; name: string }[],
  ): { ingredientId: number | null; score: number; method: string } {
    const normalizedRaw = this.normalizeText(rawName)

    let bestScore = 0
    let bestIngredientId: number | null = null

    for (const ing of ingredients) {
      const normalizedIng = this.normalizeText(ing.name)

      // Score direct
      let score = this.similarityScore(normalizedRaw, normalizedIng)

      // Bonus si l'un contient l'autre (cas "BEURRE DOUX AOP 1KG" vs "beurre")
      if (normalizedRaw.includes(normalizedIng) || normalizedIng.includes(normalizedRaw)) {
        score = Math.max(score, 0.85)
      }

      if (score > bestScore) {
        bestScore = score
        bestIngredientId = ing.id
      }
    }

    if (bestScore >= 0.8) {
      return { ingredientId: bestIngredientId, score: bestScore, method: 'auto' }
    } else if (bestScore >= 0.5) {
      return { ingredientId: bestIngredientId, score: bestScore, method: 'suggestion' }
    } else {
      return { ingredientId: null, score: bestScore, method: 'none' }
    }
  }

  async findBestMatchWithMemory(
    userId: number,
    rawName: string,
    ingredients: { id: number; name: string }[],
  ): Promise<{ ingredientId: number | null; score: number; method: string }> {
    const memory = await this.prisma.invoiceMatchMemory.findUnique({
      where: { userId_rawName: { userId, rawName } },
    })
    if (memory) {
      return { ingredientId: memory.ingredientId, score: 1, method: 'memory' }
    }
    return this.findBestMatch(rawName, ingredients)
  }

  async rememberMatch(userId: number, rawName: string, ingredientId: number): Promise<void> {
    await this.prisma.invoiceMatchMemory.upsert({
      where: { userId_rawName: { userId, rawName } },
      update: { ingredientId, confirmedAt: new Date() },
      create: { userId, rawName, ingredientId },
    })
  }
}
