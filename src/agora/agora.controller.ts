import { Controller, Get } from '@nestjs/common';
import { AgoraService } from './agora.service';

interface AgoraAppIdResponse {
  appId: string;
}

@Controller('agora')
export class AgoraController {
  constructor(private readonly agoraService: AgoraService) {}

  /**
   * Получает App ID (безопасно для фронтенда)
   */
  @Get('app-id')
  getAppId(): AgoraAppIdResponse {
    return {
      appId: this.agoraService.getAppId()
    };
  }
}