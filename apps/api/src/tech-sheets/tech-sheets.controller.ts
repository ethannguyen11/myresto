import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TechSheetsService } from './tech-sheets.service'
import { CreateTechSheetDto } from './dto/create-tech-sheet.dto'
import { UpdateTechSheetDto } from './dto/update-tech-sheet.dto'
import { GenerateTechSheetDto } from './dto/generate-tech-sheet.dto'
import { ValidateTechSheetDto } from './dto/validate-tech-sheet.dto'

@UseGuards(JwtAuthGuard)
@Controller('tech-sheets')
export class TechSheetsController {
  constructor(private readonly service: TechSheetsService) {}

  // ── AI routes (must be before /:id to avoid param conflict) ───────────────

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio', { storage: memoryStorage() }))
  transcribe(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier audio reçu')
    const mimeType = file.mimetype || 'audio/m4a'
    return this.service.transcribeAudio(file.buffer, mimeType)
  }

  @Post('generate')
  generate(@Body() dto: GenerateTechSheetDto) {
    return this.service.generateFromDescription(dto.description)
  }

  @Post('validate')
  validate(@Req() req: any, @Body() dto: ValidateTechSheetDto) {
    return this.service.validate(req.user.sub, dto)
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  @Get()
  findAll(@Req() req: any) {
    return this.service.findAll(req.user.sub)
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.findOne(id, req.user.sub)
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTechSheetDto) {
    return this.service.create(req.user.sub, dto)
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Body() dto: UpdateTechSheetDto,
  ) {
    return this.service.update(id, req.user.sub, dto)
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.service.remove(id, req.user.sub)
  }

  @Get(':id/pdf')
  async getPdf(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const html = await this.service.getPdfHtml(id, req.user.sub)
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  }
}
