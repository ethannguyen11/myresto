import { Module } from '@nestjs/common'
import { AdvisorController } from './advisor.controller'
import { AdvisorService } from './advisor.service'
import { WeeklyAlertService } from './weekly-alert.service'
import { RecipesModule } from '../recipes/recipes.module'
import { DashboardModule } from '../dashboard/dashboard.module'

@Module({
  imports: [RecipesModule, DashboardModule],
  controllers: [AdvisorController],
  providers: [AdvisorService, WeeklyAlertService],
})
export class AdvisorModule {}
