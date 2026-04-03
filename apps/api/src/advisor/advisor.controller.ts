import { Controller, Post, Get, Body, Request, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AdvisorService } from './advisor.service'
import { WeeklyAlertService } from './weekly-alert.service'

@UseGuards(JwtAuthGuard)
@Controller('advisor')
export class AdvisorController {
  constructor(
    private advisorService: AdvisorService,
    private weeklyAlertService: WeeklyAlertService,
  ) {}

  @Post('report')
  generateReport(@Request() req) {
    return this.advisorService.generateReport(req.user.sub)
  }

  @Get('report/pdf')
  async downloadPdf(@Request() req, @Res() res: Response) {
    const { buffer, filename } = await this.advisorService.generatePdfReport(req.user.sub)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.end(buffer)
  }

  @Get('weekly-alert')
  weeklyAlert(@Request() req) {
    return this.weeklyAlertService.generateWeeklyAlert(req.user.sub)
  }

  @Post('simulate')
  simulate(
    @Request() req,
    @Body() body: { targetFoodCost: number },
  ) {
    return this.advisorService.simulate(req.user.sub, body.targetFoodCost)
  }

  @Post('chat')
  chat(
    @Request() req,
    @Body() body: { message: string; history: { role: 'user' | 'assistant'; content: string }[] },
  ) {
    return this.advisorService.chat(req.user.sub, body.message, body.history ?? [])
  }
}
