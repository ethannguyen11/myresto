import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller'
import { InvoicesService } from './invoices.service'
import { ClaudeVisionService } from './claude-vision.service'
import { MatchingService } from './matching.service'
import { RecipesModule } from '../recipes/recipes.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [RecipesModule, NotificationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, ClaudeVisionService, MatchingService],
})
export class InvoicesModule {}
