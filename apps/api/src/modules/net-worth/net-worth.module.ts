import { Module } from "@nestjs/common";
import { NetWorthController } from "./net-worth.controller";
import { NetWorthService } from "./net-worth.service";

@Module({
  controllers: [NetWorthController],
  providers: [NetWorthService]
})
export class NetWorthModule {}

