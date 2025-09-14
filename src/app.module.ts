import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AuthGatewayController } from "./auth-gateway.controller";
import { FilesGatewayController } from "./files-gateway.controller";
import { LessonsGatewayController } from "./lessons-gateway.controller";
import { VocabularyGatewayController } from "./vocabulary-gateway.controller";
import { StatisticsGatewayController } from "./statistics-gateway.controller";
import { MindmapGatewayController } from "./mindmap-gateway.controller";
import { NotificationsGatewayController } from "./notifications-gateway.controller";
import { PaymentsGatewayController } from "./payments-gateway.controller";
import { VideoCallGateway } from "./websocket/websocket.gateway";

@Module({
  imports: [HttpModule],
  controllers: [
    AuthGatewayController,
    FilesGatewayController,
    LessonsGatewayController,
    VocabularyGatewayController,
    StatisticsGatewayController,
    MindmapGatewayController,
    NotificationsGatewayController,
    PaymentsGatewayController,
  ],
  providers: [VideoCallGateway],
})
export class AppModule {}
