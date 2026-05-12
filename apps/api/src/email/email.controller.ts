import { Controller, Post, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { EmailService } from './email.service'

@UseGuards(JwtAuthGuard)
@Controller('email')
export class EmailController {
  constructor(private emailService: EmailService) {}

  @Post('send-weekly-test')
  async sendTest(@Request() req) {
    return this.emailService.sendWeeklyReport(req.user.sub)
  }
}
