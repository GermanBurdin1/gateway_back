import { Controller, All, Req, Res, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";

@Controller("mindmap")
export class MindmapGatewayController {
  private readonly logger = new Logger(MindmapGatewayController.name);
  private readonly mindmapServiceUrl = "http://127.0.0.1:3002";

  constructor(private readonly httpService: HttpService) {}

  @All("*")
  async proxyToMindmapService(@Req() req: Request, @Res() res: Response) {
    const decodedUrl = decodeURIComponent(req.url);
    let targetUrl = decodedUrl;

    // Преобразуем /api/mindmap в /mindmap для Mindmap Service
    if (targetUrl.startsWith("/api/mindmap")) {
      targetUrl = targetUrl.replace("/api/mindmap", "/mindmap");
    }

    const url = `${this.mindmapServiceUrl}${targetUrl}`;

    this.logger.log(`[API Gateway] ${req.method} ${req.url} -> ${url}`);

    try {
      // Преобразуем /api/mindmap в /mindmap для Mindmap Service
      let targetPath = req.path;
      this.logger.log(`[API Gateway] Original path: ${req.path}`);
      
      if (targetPath.startsWith("/api/mindmap")) {
        targetPath = targetPath.replace("/api/mindmap", "/mindmap");
        this.logger.log(`[API Gateway] Transformed path: ${targetPath}`);
      }

      const requestConfig: any = {
        method: req.method,
        url: `${this.mindmapServiceUrl}${targetPath}`,
        headers: {
          ...req.headers,
          host: undefined,
        },
        data: req.body,
      };

      if (req.method === "GET" && Object.keys(req.query).length > 0) {
        requestConfig.params = req.query;
        this.logger.log(`[API Gateway] Query params: ${JSON.stringify(req.query)}`);
      }

      this.logger.log(`[API Gateway] Request config: ${JSON.stringify({
        method: requestConfig.method,
        url: requestConfig.url,
        hasData: !!requestConfig.data,
        hasParams: !!requestConfig.params
      })}`);

      const response = await firstValueFrom(
        this.httpService.request(requestConfig),
      );

      this.logger.log(`[API Gateway] Response status: ${response.status}`);
      this.logger.log(`[API Gateway] Response headers: ${JSON.stringify(response.headers)}`);

      Object.keys(response.headers).forEach((key) => {
        res.setHeader(key, response.headers[key]);
      });

      res.status(response.status).json(response.data);
    } catch (error) {
      this.logger.error(
        `[API Gateway] Ошибка при проксировании к mindmap-service: ${error.message}`,
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
