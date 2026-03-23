import { Global, Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { MonitoringService } from "./monitoring.service";
import { NetWorthSnapshotsService } from "./net-worth-snapshots.service";
import { OwnershipService } from "./ownership.service";
import { PrismaService } from "./prisma.service";
import { ProductAnalyticsService } from "./product-analytics.service";
import { RuntimeConfigService } from "./runtime-config.service";
import { SessionAuthGuard } from "./session-auth.guard";

@Global()
@Module({
  providers: [
    PrismaService,
    OwnershipService,
    NetWorthSnapshotsService,
    SessionAuthGuard,
    MonitoringService,
    EmailService,
    ProductAnalyticsService,
    RuntimeConfigService
  ],
  exports: [
    PrismaService,
    OwnershipService,
    NetWorthSnapshotsService,
    SessionAuthGuard,
    MonitoringService,
    EmailService,
    ProductAnalyticsService,
    RuntimeConfigService
  ]
})
export class PrismaModule {}
