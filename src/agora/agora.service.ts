import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AgoraService {
  private readonly appId: string;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>('AGORA_APP_ID');
    
    if (!this.appId) {
      throw new Error('❌ Agora App ID not configured in environment variables');
    }
  }

  /**
   * Получает App ID (безопасно для фронтенда)
   */
  getAppId(): string {
    return this.appId;
  }
}
