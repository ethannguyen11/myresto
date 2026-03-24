import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { ClaudeVisionService } from './claude-vision.service'
import { ValidateItemsDto } from './dto/validate-items.dto'

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name)

  constructor(
    private prisma: PrismaService,
    private claudeVision: ClaudeVisionService,
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

      // Récupère les ingrédients de l'utilisateur pour le matching par nom
      const userIngredients = await this.prisma.ingredient.findMany({
        where: { userId },
        select: { id: true, name: true },
      })

      const itemsToCreate = parsed.items.map((item) => {
        // Matching insensible à la casse : correspondance exacte d'abord, puis inclusion
        const matched = userIngredients.find(
          (ing) =>
            ing.name.toLowerCase() === item.rawName.toLowerCase() ||
            item.rawName.toLowerCase().includes(ing.name.toLowerCase()),
        )

        return {
          invoiceId,
          ingredientId: matched?.id ?? null,
          rawName: item.rawName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        }
      })

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

  // Confirme des lignes et met à jour les prix des ingrédients correspondants
  async validateItems(invoiceId: number, userId: number, dto: ValidateItemsDto) {
    await this.findOne(invoiceId, userId)

    for (const { itemId, ingredientId } of dto.items) {
      // Si l'utilisateur fournit un ingredientId (correction ou nouveau match), on met à jour l'item d'abord
      if (ingredientId !== undefined) {
        await this.prisma.invoiceItem.update({
          where: { id: itemId },
          data: { ingredientId: ingredientId ?? null },
        })
      }

      // Récupère l'item avec son ingredientId final
      const item = await this.prisma.invoiceItem.findUnique({
        where: { id: itemId },
      })

      if (!item) continue

      // Met à jour le prix de l'ingrédient si on a toutes les informations
      if (item.ingredientId && item.unitPrice) {
        // Vérifie que l'ingrédient appartient bien à l'utilisateur
        const ingredient = await this.prisma.ingredient.findFirst({
          where: { id: item.ingredientId, userId },
        })

        if (ingredient) {
          await this.prisma.ingredient.update({
            where: { id: item.ingredientId },
            data: { currentPrice: item.unitPrice },
          })

          await this.prisma.priceHistory.create({
            data: {
              ingredientId: item.ingredientId,
              price: item.unitPrice,
              source: 'invoice',
            },
          })
        }
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

    return this.findOne(invoiceId, userId)
  }

  async remove(id: number, userId: number) {
    await this.findOne(id, userId)
    await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } })
    return this.prisma.invoice.delete({ where: { id } })
  }
}
