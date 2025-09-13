import { Controller, All, Req, Res, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";

@Controller("auth")
export class AuthGatewayController {
  private readonly logger = new Logger(AuthGatewayController.name);
  private readonly authServiceUrl = "http://localhost:3001";

  constructor(private readonly httpService: HttpService) {}

  @All("*")
  async proxyToAuthService(@Req() req: Request, @Res() res: Response) {
    // Правильно декодируем URL
    const decodedUrl = decodeURIComponent(req.url);
    const url = `${this.authServiceUrl}${decodedUrl}`;

    this.logger.log(`[API Gateway] ${req.method} ${req.url} -> ${url}`);
    this.logger.log(`[API Gateway] Raw req.url:`, req.url);
    this.logger.log(`[API Gateway] Decoded URL:`, decodedUrl);
    this.logger.log(`[API Gateway] Query params:`, req.query);
    this.logger.log(`[API Gateway] Body:`, req.body);

    try {
      // Если это GET запрос с query параметрами, используем params
      const requestConfig: any = {
        method: req.method,
        url: `${this.authServiceUrl}${req.path}`, // Используем только path без query
        headers: {
          ...req.headers,
          host: undefined,
        },
        data: req.body,
      };

      // Для GET запросов добавляем params отдельно
      if (req.method === "GET" && Object.keys(req.query).length > 0) {
        requestConfig.params = req.query;
        this.logger.log(`[API Gateway] Using params:`, req.query);
      }

      this.logger.log(`[API Gateway] Final request config:`, {
        method: requestConfig.method,
        url: requestConfig.url,
        params: requestConfig.params || "none",
      });

      const response = await firstValueFrom(
        this.httpService.request(requestConfig),
      );

      // Копируем заголовки ответа
      Object.keys(response.headers).forEach((key) => {
        res.setHeader(key, response.headers[key]);
      });

      this.logger.log(
        `[API Gateway] Response from auth-service:`,
        response.data,
      );
      res.status(response.status).json(response.data);
    } catch (error) {
      this.logger.error(
        `[API Gateway] Ошибка при проксировании: ${error.message}`,
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
