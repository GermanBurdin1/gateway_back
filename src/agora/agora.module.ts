import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgoraService } from './agora.service';
import { AgoraController } from './agora.controller';

@Module({
  imports: [ConfigModule],
  providers: [AgoraService],
  controllers: [AgoraController],
  exports: [AgoraService],
})
export class AgoraModule {}

