// mindmap-gateway.controller.ts
import { Controller, All, Req, Res, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Request, Response } from 'express';
import http from 'http';

@Controller('mindmap')
export class MindmapGatewayController {
  private readonly logger = new Logger(MindmapGatewayController.name);

  // лучше через ENV, по умолчанию IPv4
  private readonly mindmapServiceUrl =
    process.env.MINDMAP_BASE_URL || 'http://127.0.0.1:3002';

  constructor(private readonly httpService: HttpService) {}

  @All('*')
  async proxyToMindmapService(@Req() req: Request, @Res() res: Response) {
    // ВАЖНО: убираем только глобальный префикс /api, а /mindmap оставляем
    const original = req.originalUrl;                    // напр. /api/mindmap, /api/mindmap/123
    const targetPath = original.replace(/^\/api/, '') || '/'; // -> /mindmap, /mindmap/123
    const url = `${this.mindmapServiceUrl}${targetPath}`;

    this.logger.log(`[API Gateway] ${req.method} ${original} -> ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: req.method,
          url,
          httpAgent: new http.Agent({ family: 4 }),      // избегаем ::1
          headers: { ...req.headers, host: undefined },
          data: req.body,
          params: req.method === 'GET' ? req.query : undefined,
          timeout: 10000,
        }),
      );

      for (const [k, v] of Object.entries(response.headers)) res.setHeader(k, v as any);
      // не навязываем json, отдаём как пришло
      res.status(response.status).send(response.data);
    } catch (e: any) {
      this.logger.error(`[API Gateway] Proxy error: ${e.message}`);
      if (e.response) res.status(e.response.status).send(e.response.data);
      else res.status(502).json({ error: 'Bad Gateway', message: 'Mindmap service unreachable' });
    }
  }
}
