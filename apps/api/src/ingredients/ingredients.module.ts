import { Module } from '@nestjs/common'
import { IngredientsService } from './ingredients.service'
import { IngredientsController } from './ingredients.controller'
import { RecipesModule } from '../recipes/recipes.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [RecipesModule, NotificationsModule],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}