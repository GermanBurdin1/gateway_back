import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { AuthGatewayController } from "./auth-gateway.controller";
import { FilesGatewayController } from "./files-gateway.controller";
import { LessonsGatewayController } from "./lessons-gateway.controller";
import { VocabularyGatewayController } from "./vocabulary-gateway.controller";
import { StatisticsGatewayController } from "./statistics-gateway.controller";
import { MindmapGatewayController } from "./mindmap-gateway.controller";
import { NotificationsGatewayController } from "./notifications-gateway.controller";
import { PaymentsGatewayController } from "./payments-gateway.controller";
import { VideoCallGateway } from "./websocket/websocket.gateway";
import { AgoraModule } from "./agora/agora.module";

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot({ isGlobal: true }),
    AgoraModule,
  ],
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
