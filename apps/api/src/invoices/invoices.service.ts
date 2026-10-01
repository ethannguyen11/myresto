import { Injectable, Logger, NotFoundException, BadRequestException, UnprocessableEntityException } from '@nestjs/common'
import * as fs from 'fs/promises'
import { PrismaService } from '../prisma/prisma.service'
import { ClaudeVisionService } from './claude-vision.service'
import { MatchingService } from './matching.service'
import { StorageService } from '../storage/storage.service'
import { ValidateItemsDto } from './dto/validate-items.dto'
import { RecipesService } from '../recipes/recipes.service'
import { NotificationsService } from '../notifications/notifications.service'
import { conversionFactor } from '../recipes/units'

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name)

  constructor(
    private prisma: PrismaService,
    private claudeVision: ClaudeVisionService,
    private matchingService: MatchingService,
    private storage: StorageService,
    private recipesService: RecipesService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Relit les octets d'une facture.
   *
   * Les factures créées avant l'introduction de StorageService ont un chemin
   * absolu dans fileUrl. On tente le disque pour celles-là, en expliquant
   * clairement ce qui s'est passé si le fichier a disparu — c'était le cas de
   * toutes les factures dès que le conteneur redémarrait.
   */
  private async readInvoiceFile(fileUrl: string): Promise<Buffer> {
    if (!this.storage.isLegacyAbsolutePath(fileUrl)) {
      return this.storage.read(fileUrl)
    }

    try {
      return await fs.readFile(fileUrl)
    } catch {
      throw new NotFoundException(
        'Le fichier de cette facture n\'est plus disponible : il avait été enregistré ' +
          'sur le disque local, qui est effacé à chaque redéploiement. ' +
          'Les lignes déjà extraites restent consultables, mais une nouvelle analyse ' +
          'nécessite de réimporter le document.',
      )
    }
  }

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
    // ── Pré-validation : vérifie que l'image est bien une facture ──────────
    // Elle a lieu avant toute écriture : un document rejeté n'est jamais persisté.
    const validation = await this.claudeVision.validateInvoiceImage(file.buffer, file.mimetype)
    if (!validation.valid) {
      this.logger.warn(
        `Image rejetée — userId=${userId} timestamp=${new Date().toISOString()} reason="${validation.reason}"`,
      )
      throw new UnprocessableEntityException(
        `Cette image ne semble pas être une facture. Raison : ${validation.reason}`,
      )
    }

    const storageKey = await this.storage.save(
      file.buffer,
      file.originalname,
      file.mimetype,
    )

    const invoice = await this.prisma.invoice.create({
      data: {
        userId,
        fileUrl: storageKey,
        fileType: file.mimetype,
        status: 'pending',
      },
    })

    // Fire-and-forget : on répond immédiatement, l'analyse tourne en fond.
    // Le buffer est déjà en mémoire, inutile de relire le stockage.
    this._runAnalysis(invoice.id, userId, file.buffer, file.mimetype).catch((err) => {
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

    // Relu avant de toucher aux items : si le fichier a disparu, on échoue
    // proprement sans avoir détruit les lignes déjà extraites.
    const fileBuffer = await this.readInvoiceFile(invoice.fileUrl!)

    // Supprime les anciens items pour repartir propre
    await this.prisma.invoiceItem.deleteMany({ where: { invoiceId } })

    this._runAnalysis(invoiceId, userId, fileBuffer, invoice.fileType!).catch((err) => {
      this.logger.error(`Échec re-analyse facture #${invoiceId}`, err)
    })

    return { message: 'Analyse déclenchée' }
  }

  private async _runAnalysis(
    invoiceId: number,
    userId: number,
    fileBuffer: Buffer,
    mimeType: string,
  ) {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'analyzing' },
    })

    try {
      const { parsed, rawResponse } = await this.claudeVision.analyzeInvoice(fileBuffer, mimeType)

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
            // Facteur colis → unité d'ingrédient appris lors d'une facture précédente
            conversionFactor: match.conversionFactor ?? null,
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

  /**
   * Prix par unité d'ingrédient à partir d'une ligne de facture.
   *
   * `factor` = nombre d'unités de l'ingrédient dans 1 unité de la facture.
   * Priorité : facteur saisi par l'utilisateur ou mémorisé, puis conversion
   * automatique (g → kg, cl → L). Null si rien ne permet de convertir
   * (« colis » vers « kg » sans facteur connu).
   */
  private _pricePerIngredientUnit(
    unitPrice: number,
    invoiceUnit: string | null,
    ingredientUnit: string,
    explicitFactor: number | null,
  ): { price: number; factor: number } | null {
    const factor =
      explicitFactor ?? (invoiceUnit ? conversionFactor(invoiceUnit, ingredientUnit) : 1)
    if (factor == null || !(factor > 0)) return null
    return { price: Math.round((unitPrice / factor) * 10000) / 10000, factor }
  }

  // Confirme des lignes, met à jour les prix et crée les ingrédients manquants
  async validateItems(invoiceId: number, userId: number, dto: ValidateItemsDto) {
    const invoice = await this.findOne(invoiceId, userId)
    const ownItemIds = new Set(invoice.items.map((i) => i.id))

    let updated = 0
    let created = 0
    let ignored = 0
    const needsConversion: {
      itemId: number
      rawName: string
      invoiceUnit: string | null
      ingredientName: string
      ingredientUnit: string
    }[] = []

    // Pour l'impact : prix avant la facture, et prix après
    const oldPrices = new Map<number, number>()
    const newPrices = new Map<number, number>()

    for (const { itemId, ingredientId, conversionFactor: userFactor } of dto.items) {
      if (!itemId || !ownItemIds.has(itemId)) continue

      // Applique l'ingredientId sélectionné par l'utilisateur, s'il lui appartient
      if (ingredientId !== undefined) {
        if (ingredientId !== null) {
          const owned = await this.prisma.ingredient.count({ where: { id: ingredientId, userId } })
          if (!owned) {
            this.logger.warn(`Ingrédient #${ingredientId} refusé : n'appartient pas à l'utilisateur`)
            continue
          }
        }
        await this.prisma.invoiceItem.update({
          where: { id: itemId },
          data: { ingredientId },
        })
      }
      if (userFactor !== undefined) {
        await this.prisma.invoiceItem.update({
          where: { id: itemId },
          data: { conversionFactor: userFactor && userFactor > 0 ? userFactor : null },
        })
      }

      // Récupère l'état final de l'item
      const item = await this.prisma.invoiceItem.findUnique({ where: { id: itemId } })
      if (!item) continue

      const hasPrice = item.unitPrice !== null && Number(item.unitPrice) > 0
      const storedFactor = item.conversionFactor != null ? Number(item.conversionFactor) : null

      if (item.ingredientId) {
        // ── Ingrédient connu → met à jour le prix, converti dans son unité ──
        const ingredient = await this.prisma.ingredient.findFirst({
          where: { id: item.ingredientId, userId },
        })
        if (ingredient && hasPrice) {
          const resolved = this._pricePerIngredientUnit(
            Number(item.unitPrice),
            item.unit,
            ingredient.unit,
            storedFactor,
          )
          if (!resolved) {
            // Ligne laissée en attente : l'utilisateur doit dire combien
            // de kg (ou de L, de pièces) contient une unité de la facture
            needsConversion.push({
              itemId,
              rawName: item.rawName,
              invoiceUnit: item.unit,
              ingredientName: ingredient.name,
              ingredientUnit: ingredient.unit,
            })
            continue
          }

          if (!oldPrices.has(ingredient.id)) oldPrices.set(ingredient.id, Number(ingredient.currentPrice))
          newPrices.set(ingredient.id, resolved.price)

          await this.prisma.ingredient.update({
            where: { id: ingredient.id },
            data: { currentPrice: resolved.price },
          })
          await this.prisma.priceHistory.create({
            data: { ingredientId: ingredient.id, price: resolved.price, source: 'invoice' },
          })
          updated++
        }
        if (ingredient && (ingredientId != null || userFactor !== undefined)) {
          // Choix explicite de l'utilisateur : on l'apprend pour les prochaines factures
          await this.matchingService.rememberMatch(userId, item.rawName, ingredient.id, storedFactor)
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
            category: this._guessCategory(item.rawName),
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

    // Effet des nouveaux prix sur les plats (sous-recettes comprises)
    const impact = newPrices.size
      ? await this.recipesService.priceImpact(userId, newPrices, oldPrices)
      : []
    if (impact.length > 0) {
      const label = invoice.supplierName ? `Facture ${invoice.supplierName}` : `Facture #${invoiceId}`
      await this.notificationsService.notifyPriceImpact(userId, label, impact)
    }

    return { updated, created, ignored, needsConversion, impact }
  }

  private _cleanRawName(raw: string): string {
    const lower = raw.toLowerCase().trim().replace(/\s+/g, ' ')
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }

  private _guessCategory(name: string): string {
    const n = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    const CATEGORIES: [string, string[]][] = [
      ['viande', [
        'beef','chicken','pork','veal','lamb','duck','turkey',
        'boeuf','poulet','porc','veau','agneau','canard','dinde',
        'steak','filet','entrecote','cote','saucisse','bacon',
        'jambon','lard','magret','foie',
      ]],
      ['poisson', [
        'salmon','tuna','cod','sea bass','shrimp','lobster',
        'saumon','thon','cabillaud','bar','crevette','homard',
        'moule','huitre','saint-jacques','dorade','sole',
        'truite','hareng','anchois','sardine',
      ]],
      ['legume', [
        'tomato','onion','garlic','carrot','potato','spinach',
        'tomate','oignon','ail','carotte','pomme de terre',
        'epinard','courgette','aubergine','poivron','champignon',
        'salade','laitue','brocoli','chou','fenouil','celeri',
      ]],
      ['produit laitier', [
        'butter','cream','cheese','milk','yogurt',
        'beurre','creme','fromage','lait','yaourt',
        'parmesan','mozzarella','gruyere','camembert',
      ]],
      ['epicerie', [
        'flour','oil','vinegar','sugar','salt','pasta','rice',
        'farine','huile','vinaigre','sucre','sel','pates','riz',
        'fecule','levure','moutarde','sauce','ketchup',
      ]],
      ['condiment', [
        'pepper','spice','herb','thyme','rosemary','basil',
        'poivre','epice','herbe','thym','romarin','basilic',
        'coriandre','cumin','paprika','curcuma','cannelle',
      ]],
      ['fruit', [
        'apple','orange','lemon','strawberry','mango','banana',
        'pomme','citron','fraise','mangue','banane',
        'framboise','myrtille','poire','peche','abricot',
      ]],
    ]

    // Map normalized category keys back to display names
    const DISPLAY: Record<string, string> = {
      legume: 'légume',
      epicerie: 'épicerie',
    }

    for (const [cat, keywords] of CATEGORIES) {
      if (keywords.some((kw) => n.includes(kw))) {
        return DISPLAY[cat] ?? cat
      }
    }
    return 'autre'
  }

  async rememberMatch(userId: number, rawName: string, ingredientId: number) {
    const owned = await this.prisma.ingredient.count({ where: { id: ingredientId, userId } })
    if (!owned) throw new NotFoundException('Ingrédient introuvable')
    await this.matchingService.rememberMatch(userId, rawName, ingredientId)
    return { ok: true }
  }

  async remove(id: number, userId: number) {
    const invoice = await this.findOne(id, userId)
    await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } })
    const deleted = await this.prisma.invoice.delete({ where: { id } })

    // Le fichier n'est supprimé qu'une fois la ligne effacée : en cas d'échec
    // à mi-chemin, mieux vaut un fichier orphelin qu'une facture sans document.
    if (invoice.fileUrl && !this.storage.isLegacyAbsolutePath(invoice.fileUrl)) {
      await this.storage.delete(invoice.fileUrl)
    }

    return deleted
  }
}
