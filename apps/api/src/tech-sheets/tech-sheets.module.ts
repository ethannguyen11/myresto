import { Module } from '@nestjs/common'
import { TechSheetsController } from './tech-sheets.controller'
import { TechSheetsService } from './tech-sheets.service'

@Module({
  controllers: [TechSheetsController],
  providers: [TechSheetsService],
})
export class TechSheetsModule {}
