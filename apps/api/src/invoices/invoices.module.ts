import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller'
import { InvoicesService } from './invoices.service'
import { ClaudeVisionService } from './claude-vision.service'

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, ClaudeVisionService],
})
export class InvoicesModule {}
