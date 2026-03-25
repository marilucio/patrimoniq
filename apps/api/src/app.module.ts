import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { join } from "path";
import { AppController } from "./app.controller";
import { AppExceptionFilter } from "./common/app-exception.filter";
import { PrismaModule } from "./common/prisma.module";
import { RequestLoggingInterceptor } from "./common/request-logging.interceptor";
import { SessionAuthGuard } from "./common/session-auth.guard";
import { AccountsModule } from "./modules/accounts/accounts.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { AuthModule } from "./modules/auth/auth.module";
import { BudgetsModule } from "./modules/budgets/budgets.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { GoalsModule } from "./modules/goals/goals.module";
import { InsightsModule } from "./modules/insights/insights.module";
import { LiabilitiesModule } from "./modules/liabilities/liabilities.module";
import { NetWorthModule } from "./modules/net-worth/net-worth.module";
import { FeedbackModule } from "./modules/feedback/feedback.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { SubcategoriesModule } from "./modules/subcategories/subcategories.module";
import { TransactionsModule } from "./modules/transactions/transactions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), "apps/api/.env"), join(process.cwd(), ".env")]
    }),
    PrismaModule,
    AlertsModule,
    AnalyticsModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    SubcategoriesModule,
    AssetsModule,
    LiabilitiesModule,
    DashboardModule,
    TransactionsModule,
    BudgetsModule,
    GoalsModule,
    NetWorthModule,
    ReportsModule,
    InsightsModule,
    SettingsModule,
    FeedbackModule
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter
    }
  ]
})
export class AppModule {}
