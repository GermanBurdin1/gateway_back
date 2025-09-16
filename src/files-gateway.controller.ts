import { Controller, All, Req, Res, Logger, Get } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";

@Controller("files")
export class FilesGatewayController {
  private readonly logger = new Logger(FilesGatewayController.name);
  private readonly filesServiceUrl = "http://localhost:3008";

  constructor(private readonly httpService: HttpService) {}

  @All()
  async proxyRoot(@Req() req: Request, @Res() res: Response) {
    this.logger.log(`[API Gateway] === FILES ROOT REQUEST ===`);
    this.logger.log(`[API Gateway] Method: ${req.method}`);
    this.logger.log(`[API Gateway] Original URL: ${req.url}`);
    this.logger.log(`[API Gateway] Original Path: ${req.path}`);
    
    // Проксируем к Files Service
    return this.proxyToFilesService(req, res);
  }

  @Get("uploads/*")
  async serveStaticFiles(@Req() req: Request, @Res() res: Response) {
    this.logger.log(`[API Gateway] === STATIC FILE REQUEST ===`);
    this.logger.log(`[API Gateway] Method: ${req.method}`);
    this.logger.log(`[API Gateway] Original URL: ${req.url}`);
    this.logger.log(`[API Gateway] Original Path: ${req.path}`);
    
    // Проксируем к Files Service
    return this.proxyToFilesService(req, res);
  }

  @All("*")
  async proxyToFilesService(@Req() req: Request, @Res() res: Response) {
    const decodedUrl = decodeURIComponent(req.url);
    let targetUrl = decodedUrl;

    // Преобразуем /files/materials в /materials для File Service
    if (targetUrl.startsWith("/files/")) {
      targetUrl = targetUrl.replace("/files/", "/");
    }

    const url = `${this.filesServiceUrl}${targetUrl}`;

    this.logger.log(`[API Gateway] ${req.method} ${req.url} -> ${url}`);

    try {
      // Преобразуем /files/materials в /materials для File Service
      let targetPath = req.path;
      if (targetPath.startsWith("/files/")) {
        targetPath = targetPath.replace("/files/", "/");
      }

      const requestConfig: any = {
        method: req.method,
        url: `${this.filesServiceUrl}${targetPath}`,
        headers: {
          ...req.headers,
          host: undefined,
        },
        data: req.body,
      };

      if (req.method === "GET" && Object.keys(req.query).length > 0) {
        requestConfig.params = req.query;
      }

      const response = await firstValueFrom(
        this.httpService.request(requestConfig),
      );

      Object.keys(response.headers).forEach((key) => {
        res.setHeader(key, response.headers[key]);
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      this.logger.error(
        `[API Gateway] Ошибка при проксировании к files-service: ${error.message}`,
      );

      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({
          error: "Gateway Error",
          message: "Ошибка API Gateway",
        });
      }
    }
  }
}
