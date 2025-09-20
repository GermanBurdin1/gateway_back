import { Controller, All, Req, Res, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";

@Controller("payments")
export class PaymentsGatewayController {
  private readonly logger = new Logger(PaymentsGatewayController.name);
  private readonly paymentsServiceUrl = "http://localhost:3010";

  constructor(private readonly httpService: HttpService) {}

  @All("*")
  async proxyToPaymentsService(@Req() req: Request, @Res() res: Response) {
    const decodedUrl = decodeURIComponent(req.url);
    const url = `${this.paymentsServiceUrl}${decodedUrl}`;

    this.logger.log(`[API Gateway] ${req.method} ${req.url} -> ${url}`);

    try {
      const requestConfig: any = {
        method: req.method,
        url: `${this.paymentsServiceUrl}${req.path}`,
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
        `[API Gateway] Ошибка при проксировании к payments-service: ${error.message}`,
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

