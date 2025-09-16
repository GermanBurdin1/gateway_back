import { Controller, All, Get, Req, Res, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Request, Response } from 'express';

@Controller('files')
export class FilesGatewayController {
  private readonly logger = new Logger(FilesGatewayController.name);
  private readonly base = 'http://127.0.0.1:3008'; // лучше 127.0.0.1, чтобы исключить ::1

  constructor(private readonly http: HttpService) { }

  // РОВНО /files
  @All()
  root(@Req() req: Request, @Res() res: Response) {
    return this.forwardApi(req, res);
  }

  // Статика: /files/uploads/...
  @Get('uploads/*')
  async uploads(@Req() req: Request, @Res() res: Response) {
    // срезаем только префикс /files/ -> /uploads/...
    const path = req.originalUrl.replace(/^\/api/, '').replace(/^\/files\//, '/');
    const url = this.base + path;

    this.logger.log(`[FILES GATE] STATIC ${req.method} ${req.originalUrl} -> ${url}`);

    try {
      const resp = await firstValueFrom(
        this.http.request({
          method: 'GET',
          url,
          // передаём range и прочее; host убираем
          headers: { ...req.headers, host: undefined },
          // КЛЮЧЕВОЕ: поток
          responseType: 'stream',
          // важно не зарубать 206 и прочие статусы
          validateStatus: () => true,
          timeout: 30000,
        }),
      );

      // Прокидываем заголовки апстрима
      for (const [k, v] of Object.entries(resp.headers)) res.setHeader(k, v as any);
      res.status(resp.status);

      // Стримим тело
      (resp.data as NodeJS.ReadableStream)
        .on('error', (e: any) => {
          this.logger.error(`[FILES GATE] stream error: ${e.message}`);
          if (!res.headersSent) res.status(502);
          res.end();
        })
        .pipe(res);
    } catch (e: any) {
      this.logger.error(`[FILES GATE] STATIC proxy error: ${e.message}`);
      if (!res.headersSent) res.status(502).end();
    }
  }

  // Остальные пути: /files/... -> API JSON
  @All('*')
  async any(@Req() req: Request, @Res() res: Response) {
    return this.forwardApi(req, res);
  }

  private async forwardApi(req: Request, res: Response) {
    // /files/materials -> /materials
    const path = req.path.replace(/^\/files\//, '/');
    const url = this.base + path;

    this.logger.log(`[FILES GATE] API ${req.method} ${req.originalUrl} -> ${url}`);

    try {
      const cfg: any = {
        method: req.method,
        url,
        headers: { ...req.headers, host: undefined },
        data: req.body,
        params: req.method === 'GET' ? req.query : undefined,
        timeout: 15000,
      };
      const resp = await firstValueFrom(this.http.request(cfg));

      for (const [k, v] of Object.entries(resp.headers)) res.setHeader(k, v as any);
      res.status(resp.status).send(resp.data);
    } catch (e: any) {
      this.logger.error(`[FILES GATE] API proxy error: ${e.message}`);
      if (e.response) res.status(e.response.status).send(e.response.data);
      else res.status(502).json({ error: 'Bad Gateway', message: 'files-service unreachable' });
    }
  }
}
