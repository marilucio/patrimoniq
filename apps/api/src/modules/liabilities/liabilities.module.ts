import { Module } from "@nestjs/common";
import { LiabilitiesController } from "./liabilities.controller";
import { LiabilitiesService } from "./liabilities.service";

@Module({
  controllers: [LiabilitiesController],
  providers: [LiabilitiesService],
  exports: [LiabilitiesService]
})
export class LiabilitiesModule {}

