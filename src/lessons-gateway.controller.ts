import { Controller, All, Req, Res, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";

@Controller("lessons")
export class LessonsGatewayController {
  private readonly logger = new Logger(LessonsGatewayController.name);
  private readonly lessonsServiceUrl = "http://localhost:3004";

  constructor(private readonly httpService: HttpService) {}

  @All("*")
  async proxyToLessonsService(@Req() req: Request, @Res() res: Response) {
    const decodedUrl = decodeURIComponent(req.url);
    const url = `${this.lessonsServiceUrl}${decodedUrl}`;

    this.logger.log(`[API Gateway] ${req.method} ${req.url} -> ${url}`);

    try {
      // Преобразуем /api/lessons в /lessons для Lessons Service
      let targetPath = req.path;
      if (targetPath.startsWith("/api/lessons")) {
        targetPath = targetPath.replace("/api/lessons", "/lessons");
        this.logger.log(`[API Gateway] Path transformed: ${req.path} -> ${targetPath}`);
      }

      const requestConfig: any = {
        method: req.method,
        url: `${this.lessonsServiceUrl}${targetPath}`,
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
        `[API Gateway] Ошибка при проксировании к lessons-service: ${error.message}`,
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
