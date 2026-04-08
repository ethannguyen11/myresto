import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ClaudeVisionService } from './claude-vision.service'
import { MatchingService } from './matching.service'
import { ValidateItemsDto } from './dto/validate-items.dto'

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name)

  constructor(
    private prisma: PrismaService,
    private claudeVision: ClaudeVisionService,
    private matchingService: MatchingService,
  ) {}

  async findAll(userId: number) {
    return this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
      },
    })
  }

  async findOne(id: number, userId: number) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, userId },
      include: {
        items: {
          include: { ingredient: { select: { id: true, name: true, unit: true } } },
        },
      },
    })
    if (!invoice) throw new NotFoundException('Facture introuvable')
    return invoice
  }

  // Crée la facture et déclenche l'analyse en arrière-plan
  async upload(userId: number, file: Express.Multer.File) {
    const invoice = await this.prisma.invoice.create({
      data: {
        userId,
        fileUrl: file.path,
        fileType: file.mimetype,
        status: 'pending',
      },
    })

    // Fire-and-forget : on répond immédiatement, l'analyse tourne en fond
    this._runAnalysis(invoice.id, userId, file.path, file.mimetype).catch((err) => {
      this.logger.error(`Échec analyse facture #${invoice.id}`, err)
    })

    return invoice
  }

  // Peut être appelé manuellement pour relancer une analyse échouée
  async triggerAnalysis(invoiceId: number, userId: number) {
    const invoice = await this.findOne(invoiceId, userId)

    if (invoice.status === 'analyzing') {
      throw new BadRequestException('Une analyse est déjà en cours')
    }

    // Supprime les anciens items pour repartir propre
    await this.prisma.invoiceItem.deleteMany({ where: { invoiceId } })

    this._runAnalysis(invoiceId, userId, invoice.fileUrl!, invoice.fileType!).catch((err) => {
      this.logger.error(`Échec re-analyse facture #${invoiceId}`, err)
    })

    return { message: 'Analyse déclenchée' }
  }

  private async _runAnalysis(
    invoiceId: number,
    userId: number,
    filePath: string,
    mimeType: string,
  ) {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'analyzing' },
    })

    try {
      const { parsed, rawResponse } = await this.claudeVision.analyzeInvoice(filePath, mimeType)

      // Récupère les ingrédients de l'utilisateur pour le matching intelligent
      const userIngredients = await this.prisma.ingredient.findMany({
        where: { userId },
        select: { id: true, name: true },
      })

      const itemsToCreate = await Promise.all(
        parsed.items.map(async (item) => {
          const match = await this.matchingService.findBestMatchWithMemory(
            userId,
            item.rawName,
            userIngredients,
          )
          return {
            invoiceId,
            ingredientId: match.ingredientId,
            rawName: item.rawName,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            matchScore: match.score,
            matchMethod: match.method,
          }
        }),
      )

      await this.prisma.invoiceItem.createMany({ data: itemsToCreate })

      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          supplierName: parsed.supplierName,
          invoiceDate: parsed.invoiceDate ? new Date(parsed.invoiceDate) : null,
          totalAmount: parsed.totalAmount,
          status: 'reviewed',
          rawAiResponse: rawResponse,
        },
      })

      this.logger.log(
        `Facture #${invoiceId} analysée : ${itemsToCreate.length} ligne(s) extraite(s)`,
      )
    } catch (error) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'error',
          rawAiResponse: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  // Confirme des lignes, met à jour les prix et crée les ingrédients manquants
  async validateItems(invoiceId: number, userId: number, dto: ValidateItemsDto) {
    await this.findOne(invoiceId, userId)

    let updated = 0
    let created = 0
    let ignored = 0

    try {
      for (const { itemId, ingredientId } of dto.items) {
        if (!itemId) continue

        // Applique l'ingredientId sélectionné par l'utilisateur
        if (ingredientId !== undefined) {
          try {
            await this.prisma.invoiceItem.update({
              where: { id: itemId },
              data: { ingredientId: ingredientId ?? null },
            })
          } catch (err) {
            this.logger.warn(`Impossible de mettre à jour l'item #${itemId} : ${err}`)
            continue
          }
        }

        // Récupère l'état final de l'item
        const item = await this.prisma.invoiceItem.findUnique({ where: { id: itemId } })
        if (!item) continue

        const hasPrice = item.unitPrice !== null && Number(item.unitPrice) > 0

        if (item.ingredientId) {
          // ── Ingrédient connu → met à jour le prix ──
          if (hasPrice) {
            const ingredient = await this.prisma.ingredient.findFirst({
              where: { id: item.ingredientId, userId },
            })
            if (ingredient) {
              await this.prisma.ingredient.update({
                where: { id: item.ingredientId },
                data: { currentPrice: item.unitPrice! },
              })
              await this.prisma.priceHistory.create({
                data: { ingredientId: item.ingredientId, price: item.unitPrice!, source: 'invoice' },
              })
              updated++
            }
          }
        } else if (!item.isConfirmed && hasPrice) {
          // ── Aucune correspondance → crée automatiquement l'ingrédient ──
          const cleanName = this._cleanRawName(item.rawName)
          const newIngredient = await this.prisma.ingredient.create({
            data: {
              userId,
              name: cleanName,
              unit: item.unit ?? 'kg',
              currentPrice: item.unitPrice!,
              category: 'autre',
              priceHistory: {
                create: { price: item.unitPrice!, source: 'invoice' },
              },
            },
          })
          await this.prisma.invoiceItem.update({
            where: { id: itemId },
            data: { ingredientId: newIngredient.id },
          })
          await this.matchingService.rememberMatch(userId, item.rawName, newIngredient.id)
          created++
        } else {
          ignored++
        }

        await this.prisma.invoiceItem.update({
          where: { id: itemId },
          data: { isConfirmed: true },
        })
      }

      // Passe la facture à "validated" si toutes les lignes sont confirmées
      const pendingCount = await this.prisma.invoiceItem.count({
        where: { invoiceId, isConfirmed: false },
      })
      if (pendingCount === 0) {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: 'validated' },
        })
      }

      return { updated, created, ignored }
    } catch (error) {
      console.error(`[validateItems] Erreur facture #${invoiceId}:`, error)
      throw error
    }
  }

  private _cleanRawName(raw: string): string {
    const lower = raw.toLowerCase().trim().replace(/\s+/g, ' ')
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }

  async rememberMatch(userId: number, rawName: string, ingredientId: number) {
    await this.matchingService.rememberMatch(userId, rawName, ingredientId)
    return { ok: true }
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId)
    await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } })
    return this.prisma.invoice.delete({ where: { id } })
  }
}
