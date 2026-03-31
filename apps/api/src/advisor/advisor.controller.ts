import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AdvisorService } from './advisor.service'

@UseGuards(JwtAuthGuard)
@Controller('advisor')
export class AdvisorController {
  constructor(private advisorService: AdvisorService) {}

  @Post('report')
  generateReport(@Request() req) {
    return this.advisorService.generateReport(req.user.sub)
  }

  @Post('chat')
  chat(
    @Request() req,
    @Body() body: { message: string; history: { role: 'user' | 'assistant'; content: string }[] },
  ) {
    return this.advisorService.chat(req.user.sub, body.message, body.history ?? [])
  }
}
