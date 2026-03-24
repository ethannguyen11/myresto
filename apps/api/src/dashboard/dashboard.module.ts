import { Module } from '@nestjs/common'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'
import { RecipesModule } from '../recipes/recipes.module'

@Module({
  imports: [RecipesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
