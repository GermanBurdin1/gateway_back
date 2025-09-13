import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuthGatewayController } from "./auth-gateway.controller";
import { VideoCallGateway } from "./websocket/websocket.gateway";

@Module({
  imports: [HttpModule],
  controllers: [AuthGatewayController],
  providers: [VideoCallGateway],
})
export class AppModule {}
