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
    // Убираем /api/mindmap из пути для Mindmap Service
    let targetPath = req.path.replace("/api/mindmap", "");
    if (!targetPath) targetPath = "/";

    const url = `${this.mindmapServiceUrl}${targetPath}`;

    this.logger.log(`[API Gateway] ${req.method} ${req.url} -> ${url}`);

    try {
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
