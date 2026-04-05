import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller'
import { InvoicesService } from './invoices.service'
import { ClaudeVisionService } from './claude-vision.service'
import { MatchingService } from './matching.service'

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, ClaudeVisionService, MatchingService],
})
export class InvoicesModule {}
