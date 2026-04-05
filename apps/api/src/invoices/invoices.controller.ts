import {
  Controller, Get, Post, Delete,
  Body, Param, ParseIntPipe, Request, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import * as fs from 'fs'
import { InvoicesService } from './invoices.service'
import { ValidateItemsDto } from './dto/validate-items.dto'
import { RememberMatchDto } from './dto/remember-match.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'invoices')
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 Mo

// Crée le dossier d'upload si nécessaire
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  findAll(@Request() req) {
    return this.invoicesService.findAll(req.user.sub)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.invoicesService.findOne(id, req.user.sub)
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
          cb(null, `invoice-${unique}${extname(file.originalname)}`)
        },
      }),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase()
        const mimeOk = ALLOWED_MIMES.includes(file.mimetype)
        // Postman et certains clients envoient application/octet-stream pour les PDF :
        // on accepte dans ce cas si l'extension est valide
        const extOk =
          file.mimetype === 'application/octet-stream' && ALLOWED_EXTENSIONS.includes(ext)

        if (mimeOk || extOk) {
          // Normalise le mimetype pour que Claude reçoive le bon type
          if (extOk) file.mimetype = ext === '.pdf' ? 'application/pdf' : `image/${ext.slice(1)}`
          cb(null, true)
        } else {
          cb(
            new BadRequestException(
              'Format non supporté. Utilisez PDF, JPEG, PNG ou WEBP.',
            ),
            false,
          )
        }
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) throw new BadRequestException('Aucun fichier reçu')
    return this.invoicesService.upload(req.user.sub, file)
  }

  // Relance l'analyse IA (utile si le statut est "error")
  @Post(':id/analyze')
  triggerAnalysis(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.invoicesService.triggerAnalysis(id, req.user.sub)
  }

  // Confirme des lignes de facture et met à jour les prix ingrédients
  @Post(':id/validate-items')
  validateItems(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidateItemsDto,
    @Request() req,
  ) {
    return this.invoicesService.validateItems(id, req.user.sub, dto)
  }

  @Post('remember-match')
  rememberMatch(@Body() dto: RememberMatchDto, @Request() req) {
    return this.invoicesService.rememberMatch(req.user.sub, dto.rawName, dto.ingredientId)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.invoicesService.remove(id, req.user.sub)
  }
}
