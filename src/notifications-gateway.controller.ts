import { Controller, All, Req, Res, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";

@Controller("notifications")
export class NotificationsGatewayController {
  private readonly logger = new Logger(NotificationsGatewayController.name);
  private readonly notificationsServiceUrl = "http://localhost:3003";

  constructor(private readonly httpService: HttpService) {}

  @All("*")
  async proxyToNotificationsService(@Req() req: Request, @Res() res: Response) {
    const decodedUrl = decodeURIComponent(req.url);
    const targetUrl = decodedUrl;

    // Преобразуем /notifications в /notifications для Notifications Service
    // Но если запрос к /notifications без параметров, возвращаем 404
    if (targetUrl === "/notifications" && req.method === "GET") {
      res.status(404).json({
        message: "Notifications endpoint requires userId parameter",
        error: "Not Found",
        statusCode: 404,
      });
      return;
    }

    const url = `${this.notificationsServiceUrl}${targetUrl}`;

    this.logger.log(`[API Gateway] ${req.method} ${req.url} -> ${url}`);

    try {
      const requestConfig: any = {
        method: req.method,
        url: `${this.notificationsServiceUrl}${req.path}`,
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
        `[API Gateway] Ошибка при проксировании к notifications-service: ${error.message}`,
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
