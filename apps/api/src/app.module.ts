import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { IngredientsModule } from './ingredients/ingredients.module'
import { RecipesModule } from './recipes/recipes.module';
import { InvoicesModule } from './invoices/invoices.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { AdvisorModule } from './advisor/advisor.module'
import { LibraryModule } from './library/library.module'
import { TechSheetsModule } from './tech-sheets/tech-sheets.module'
import { NotificationsModule } from './notifications/notifications.module'
import { EmailModule } from './email/email.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    IngredientsModule,
    RecipesModule,
    InvoicesModule,
    DashboardModule,
    AdvisorModule,
    LibraryModule,
    TechSheetsModule,
    NotificationsModule,
    EmailModule,
  ],
})
export class AppModule {}
