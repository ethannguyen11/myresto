import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaService } from '../prisma/prisma.service'
import { CreateTechSheetDto } from './dto/create-tech-sheet.dto'
import { UpdateTechSheetDto } from './dto/update-tech-sheet.dto'
import { ValidateTechSheetDto } from './dto/validate-tech-sheet.dto'

// Shape returned by the AI and sent to the frontend for validation
export interface GeneratedTechSheet {
  name: string
  category: string
  servings: number
  prepTime: number
  cookTime: number
  difficulty: string
  ingredients: Array<{ name: string; quantity: string; unit: string }>
  steps: string[]
  presentation: string
  tips: string
}

const GENERATE_SYSTEM_PROMPT = `Tu es un chef cuisinier professionnel. \
À partir de cette description libre, génère une fiche technique structurée en JSON avec ces champs : \
{ \
  "name": string, \
  "category": string (Entrée/Plat/Dessert), \
  "servings": number, \
  "prepTime": number (minutes), \
  "cookTime": number (minutes), \
  "difficulty": string (Facile/Moyen/Difficile), \
  "ingredients": [{ "name": string, "quantity": string, "unit": string }], \
  "steps": [string], \
  "presentation": string, \
  "tips": string \
} \
Réponds UNIQUEMENT avec le JSON, sans texte autour.`

@Injectable()
export class TechSheetsService {
  private readonly logger = new Logger(TechSheetsService.name)
  private readonly client: Anthropic

  constructor(private prisma: PrismaService) {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  // ── AI generation ─────────────────────────────────────────────────────────

  async generateFromDescription(description: string): Promise<GeneratedTechSheet> {
    const msg = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: GENERATE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: description }],
    })

    const text = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')

    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    try {
      return JSON.parse(cleaned) as GeneratedTechSheet
    } catch {
      this.logger.error('Failed to parse AI response', cleaned)
      throw new InternalServerErrorException('La réponse de l\'IA n\'a pas pu être interprétée')
    }
  }

  // ── Save validated sheet ──────────────────────────────────────────────────

  async validate(userId: number, dto: ValidateTechSheetDto) {
    return this.prisma.techSheet.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        servings: dto.servings ?? 4,
        prepTime: dto.prepTime,
        cookTime: dto.cookTime,
        difficulty: dto.difficulty,
        ingredients: JSON.stringify(dto.ingredients ?? []),
        steps: JSON.stringify(dto.steps ?? []),
        presentation: dto.presentation,
        tips: dto.tips,
      },
    })
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(userId: number) {
    return this.prisma.techSheet.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findOne(id: number, userId: number) {
    const sheet = await this.prisma.techSheet.findFirst({
      where: { id, userId },
    })
    if (!sheet) throw new NotFoundException('Fiche technique introuvable')
    return sheet
  }

  async create(userId: number, dto: CreateTechSheetDto) {
    return this.prisma.techSheet.create({
      data: {
        userId,
        name: dto.name,
        category: dto.category,
        recipeId: dto.recipeId,
        servings: dto.servings ?? 4,
        prepTime: dto.prepTime,
        cookTime: dto.cookTime,
        difficulty: dto.difficulty,
        ingredients: dto.ingredients ?? '[]',
        steps: dto.steps ?? '[]',
        presentation: dto.presentation,
        tips: dto.tips,
      },
    })
  }

  async update(id: number, userId: number, dto: UpdateTechSheetDto) {
    await this.findOne(id, userId)
    return this.prisma.techSheet.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        recipeId: dto.recipeId,
        ...(dto.servings !== undefined && { servings: dto.servings }),
        prepTime: dto.prepTime,
        cookTime: dto.cookTime,
        difficulty: dto.difficulty,
        ...(dto.ingredients !== undefined && { ingredients: dto.ingredients }),
        ...(dto.steps !== undefined && { steps: dto.steps }),
        presentation: dto.presentation,
        tips: dto.tips,
      },
    })
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId)
    return this.prisma.techSheet.delete({ where: { id } })
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  async getPdfHtml(id: number, userId: number): Promise<string> {
    const sheet = await this.findOne(id, userId)

    const ingredients: Array<{ name: string; quantity: string; unit?: string }> =
      JSON.parse(sheet.ingredients || '[]')
    const steps: string[] = JSON.parse(sheet.steps || '[]')
    const date = new Date(sheet.createdAt).toLocaleDateString('fr-FR')

    const difficultyLabel = { Facile: 'Facile', Moyen: 'Moyen', Difficile: 'Difficile',
      facile: 'Facile', moyen: 'Moyen', difficile: 'Difficile' }[sheet.difficulty ?? ''] ?? ''

    const ingredientRows = ingredients
      .map((ing) => `<tr><td>${ing.name}</td><td>${ing.quantity}</td><td>${ing.unit ?? ''}</td></tr>`)
      .join('')

    const stepsList = steps
      .map((step, i) => `<li><span class="step-num">${i + 1}</span><span>${step}</span></li>`)
      .join('')

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Fiche Technique — ${sheet.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #1c1917; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 700; color: #059669; margin-bottom: 4px; }
    .subtitle { color: #78716c; font-size: 11px; margin-bottom: 20px; }
    .meta { display: flex; gap: 24px; padding: 12px 16px; background: #f5f5f4; border-radius: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .meta-item { display: flex; flex-direction: column; }
    .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #a8a29e; }
    .meta-value { font-size: 13px; font-weight: 600; color: #1c1917; }
    h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #57534e; border-bottom: 1px solid #e7e5e4; padding-bottom: 6px; margin: 20px 0 10px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f5f5f4; text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #78716c; }
    td { padding: 6px 10px; border-bottom: 1px solid #f5f5f4; }
    tr:last-child td { border-bottom: none; }
    ol.steps { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    ol.steps li { display: flex; gap: 12px; align-items: flex-start; }
    .step-num { min-width: 24px; height: 24px; background: #059669; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .note-box { padding: 12px 16px; background: #f5f5f4; border-left: 3px solid #059669; border-radius: 0 8px 8px 0; margin-top: 8px; line-height: 1.6; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e7e5e4; display: flex; justify-content: space-between; font-size: 10px; color: #a8a29e; }
    @media print { body { padding: 20px; } @page { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>${sheet.name}</h1>
  <p class="subtitle">${sheet.category ?? ''} — Fiche technique · ${date}</p>
  <div class="meta">
    <div class="meta-item"><span class="meta-label">Couverts</span><span class="meta-value">${sheet.servings}</span></div>
    ${sheet.prepTime != null ? `<div class="meta-item"><span class="meta-label">Prép.</span><span class="meta-value">${sheet.prepTime} min</span></div>` : ''}
    ${sheet.cookTime != null ? `<div class="meta-item"><span class="meta-label">Cuisson</span><span class="meta-value">${sheet.cookTime} min</span></div>` : ''}
    ${difficultyLabel ? `<div class="meta-item"><span class="meta-label">Difficulté</span><span class="meta-value">${difficultyLabel}</span></div>` : ''}
  </div>
  ${ingredients.length > 0 ? `<h2>Ingrédients</h2><table><thead><tr><th>Ingrédient</th><th>Quantité</th><th>Unité</th></tr></thead><tbody>${ingredientRows}</tbody></table>` : ''}
  ${steps.length > 0 ? `<h2>Progression</h2><ol class="steps">${stepsList}</ol>` : ''}
  ${sheet.presentation ? `<h2>Présentation</h2><div class="note-box">${sheet.presentation}</div>` : ''}
  ${sheet.tips ? `<h2>Conseils du chef</h2><div class="note-box">${sheet.tips}</div>` : ''}
  <div class="footer"><span>Chef IA — Fiche technique</span><span>${date}</span></div>
  <script>window.onload = () => window.print()</script>
</body>
</html>`
  }
}
