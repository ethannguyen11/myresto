import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { randomBytes } from 'crypto'
import { extname, join, basename } from 'path'
import * as fs from 'fs/promises'

/**
 * Stockage des fichiers uploadés (factures).
 *
 * Deux pilotes, choisis par la variable STORAGE_DRIVER :
 *
 *   local  (défaut) — disque local, sous uploads/invoices/.
 *                     Pratique en développement, MAIS le système de fichiers
 *                     est éphémère sur Render/Heroku/Fly : les fichiers
 *                     disparaissent à chaque redéploiement ou réveil.
 *
 *   s3              — n'importe quel stockage objet compatible S3 :
 *                     AWS S3, Cloudflare R2, Supabase Storage, MinIO, Scaleway.
 *                     C'est le pilote à utiliser en production.
 *
 * Les clés renvoyées par save() sont opaques et stockées dans Invoice.fileUrl.
 * Elles ne sont jamais des chemins absolus : changer de pilote ne casse pas
 * les enregistrements existants tant que le contenu est migré sous la même clé.
 */

export type StorageDriver = 'local' | 's3'

const LOCAL_ROOT = join(process.cwd(), 'uploads', 'invoices')

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private readonly driver: StorageDriver
  private readonly bucket: string
  private s3Client: import('@aws-sdk/client-s3').S3Client | null = null

  constructor() {
    const configured = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase()
    this.driver = configured === 's3' ? 's3' : 'local'
    this.bucket = process.env.S3_BUCKET ?? ''
  }

  async onModuleInit() {
    if (this.driver === 'local') {
      await fs.mkdir(LOCAL_ROOT, { recursive: true })

      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'STORAGE_DRIVER=local en production : le disque est éphémère sur la plupart ' +
            'des hébergeurs, les factures uploadées seront perdues au prochain ' +
            'redéploiement. Configurez STORAGE_DRIVER=s3.',
        )
      }
      return
    }

    // ── Pilote S3 ────────────────────────────────────────────────────────────
    const missing = ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'].filter(
      (k) => !process.env[k],
    )
    if (missing.length > 0) {
      throw new Error(
        `STORAGE_DRIVER=s3 mais ces variables manquent : ${missing.join(', ')}. ` +
          'Renseignez-les, ou repassez sur STORAGE_DRIVER=local en développement.',
      )
    }

    const { S3Client } = await import('@aws-sdk/client-s3')
    this.s3Client = new S3Client({
      region: process.env.S3_REGION ?? 'auto',
      // R2, Supabase, MinIO et Scaleway exposent un endpoint personnalisé.
      // AWS S3 le déduit de la région : on ne le passe alors pas.
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    })

    this.logger.log(`Stockage S3 actif — bucket "${this.bucket}"`)
  }

  /** Génère une clé opaque, sans jamais faire confiance au nom d'origine. */
  private buildKey(originalName: string): string {
    const ext = extname(originalName).toLowerCase().slice(0, 10)
    const stamp = new Date().toISOString().slice(0, 10)
    return `invoices/${stamp}/${randomBytes(16).toString('hex')}${ext}`
  }

  /** Empêche qu'une clé forgée sorte du dossier de stockage local. */
  private localPathFor(key: string): string {
    const safe = key.split('/').map((segment) => basename(segment)).join('_')
    return join(LOCAL_ROOT, safe)
  }

  async save(buffer: Buffer, originalName: string, contentType: string): Promise<string> {
    const key = this.buildKey(originalName)

    if (this.driver === 'local') {
      await fs.mkdir(LOCAL_ROOT, { recursive: true })
      await fs.writeFile(this.localPathFor(key), buffer)
      return key
    }

    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    await this.s3Client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    )
    return key
  }

  async read(key: string): Promise<Buffer> {
    if (this.driver === 'local') {
      return fs.readFile(this.localPathFor(key))
    }

    const { GetObjectCommand } = await import('@aws-sdk/client-s3')
    const result = await this.s3Client!.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    )
    return Buffer.from(await result.Body!.transformToByteArray())
  }

  /** Ne lève jamais : supprimer un fichier déjà absent n'est pas une erreur. */
  async delete(key: string): Promise<void> {
    try {
      if (this.driver === 'local') {
        await fs.unlink(this.localPathFor(key))
        return
      }
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      await this.s3Client!.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      )
    } catch (err) {
      this.logger.warn(`Suppression impossible pour "${key}" : ${(err as Error).message}`)
    }
  }

  /**
   * Les factures uploadées avant l'introduction de ce service portent un chemin
   * absolu dans fileUrl. On les relit depuis le disque tant qu'elles existent.
   */
  isLegacyAbsolutePath(fileUrl: string): boolean {
    return /^([a-zA-Z]:[\\/]|\/)/.test(fileUrl)
  }
}
