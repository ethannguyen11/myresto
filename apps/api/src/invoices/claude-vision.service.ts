import { Injectable, Logger } from '@nestjs/common'
import Anthropic from '@anthropic-ai/sdk'

export interface ParsedInvoiceItem {
  rawName: string
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  totalPrice: number | null
}

export interface ParsedInvoice {
  supplierName: string | null
  invoiceDate: string | null  // format YYYY-MM-DD
  totalAmount: number | null
  items: ParsedInvoiceItem[]
}

@Injectable()
export class ClaudeVisionService {
  private readonly logger = new Logger(ClaudeVisionService.name)
  private readonly client: Anthropic

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }

  /**
   * Construit le bloc de contenu Claude à partir des octets du fichier.
   * Le service ne touche jamais au disque : l'appelant décide d'où viennent
   * les octets (disque local, stockage objet, mémoire).
   */
  private buildFileContent(
    fileBuffer: Buffer,
    mimeType: string,
  ): Anthropic.ContentBlockParam {
    const base64 = fileBuffer.toString('base64')

    if (mimeType === 'application/pdf') {
      return {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      }
    }

    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: base64,
      },
    }
  }

  async validateInvoiceImage(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{ valid: boolean; reason: string }> {
    const fileContent = this.buildFileContent(fileBuffer, mimeType)

    const message = await this.client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: `This image is supposed to be an invoice or receipt. Reply ONLY with a JSON: { "valid": boolean, "reason": string }
- valid: true if the image clearly contains an invoice, receipt, or order document with prices/amounts
- valid: false otherwise (photo of food, empty table, blurry, etc.)
- reason: one short sentence explaining`,
            },
          ],
        },
      ],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    try {
      const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      return JSON.parse(cleaned) as { valid: boolean; reason: string }
    } catch {
      // If Claude's response can't be parsed, let the upload through rather than block a valid invoice
      this.logger.warn('Réponse de validation non parseable, image acceptée par défaut', raw)
      return { valid: true, reason: 'Validation ignorée' }
    }
  }

  async analyzeInvoice(
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<{ parsed: ParsedInvoice; rawResponse: string }> {
    const fileContent = this.buildFileContent(fileBuffer, mimeType)

    const message = await this.client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            {
              type: 'text',
              text: `Tu es un assistant spécialisé dans l'analyse de factures fournisseurs pour la restauration. The invoice may be in French or English. Extract all information regardless of language and always return the JSON response in the same format.

Analyse cette facture et extrait les informations suivantes au format JSON strict :

{
  "supplierName": "nom du fournisseur ou null",
  "invoiceDate": "date au format YYYY-MM-DD ou null",
  "totalAmount": montant total TTC en nombre ou null,
  "items": [
    {
      "rawName": "nom exact du produit tel qu'il apparaît sur la facture",
      "quantity": quantité en nombre ou null,
      "unit": "unité (kg, L, pièce, carton, etc.) ou null",
      "unitPrice": prix unitaire HT en nombre ou null,
      "totalPrice": prix total de la ligne HT en nombre ou null
    }
  ]
}

Règles importantes :
- Inclure tous les produits de la facture, même ceux sans prix
- Ne jamais inventer de données : si une information est absente, mettre null
- Les prix doivent être des nombres (ex: 4.50), pas des chaînes
- Réponds UNIQUEMENT avec le JSON, sans texte avant ni après`,
            },
          ],
        },
      ],
    })

    const rawResponse =
      message.content[0].type === 'text' ? message.content[0].text : ''

    try {
      const cleaned = rawResponse
        .replace(/^```json\n?/, '')
        .replace(/\n?```$/, '')
        .trim()
      const parsed: ParsedInvoice = JSON.parse(cleaned)
      return { parsed, rawResponse }
    } catch {
      this.logger.error('Réponse Claude non parseable', rawResponse)
      throw new Error(`Réponse Claude non parseable: ${rawResponse.slice(0, 200)}`)
    }
  }
}
