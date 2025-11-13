import { Controller, All, Req, Res, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";

@Controller("courses")
export class CoursesGatewayController {
  private readonly logger = new Logger(CoursesGatewayController.name);
  private readonly lessonsServiceUrl = "http://localhost:3004";

  constructor(private readonly httpService: HttpService) {}

  // Обработка корневого пути /courses
  @All()
  async root(@Req() req: Request, @Res() res: Response) {
    return this.proxyToLessonsService(req, res);
  }

  // Обработка всех остальных путей /courses/*
  @All("*")
  async proxyToLessonsService(@Req() req: Request, @Res() res: Response) {
    this.logger.log(`[COURSES GATEWAY] === REQUEST RECEIVED ===`);
    this.logger.log(`[COURSES GATEWAY] Method: ${req.method}`);
    this.logger.log(`[COURSES GATEWAY] req.url: ${req.url}`);
    this.logger.log(`[COURSES GATEWAY] req.path: ${req.path}`);
    this.logger.log(`[COURSES GATEWAY] req.originalUrl: ${req.originalUrl}`);
    this.logger.log(`[COURSES GATEWAY] req.baseUrl: ${req.baseUrl}`);
    this.logger.log(`[COURSES GATEWAY] Query params: ${JSON.stringify(req.query)}`);
    this.logger.log(`[COURSES GATEWAY] Body: ${JSON.stringify(req.body)}`);

    // Обрабатываем originalUrl как в files-gateway
    // Убираем /api если есть, оставляем /courses/...
    const originalPath = req.originalUrl.replace(/^\/api/, "");
    // Путь уже содержит /courses, просто передаем его дальше
    const path = originalPath;
    
    const url = `${this.lessonsServiceUrl}${path}`;

    this.logger.log(`[COURSES GATEWAY] Original path: ${req.originalUrl}`);
    this.logger.log(`[COURSES GATEWAY] After removing /api: ${originalPath}`);
    this.logger.log(`[COURSES GATEWAY] Final path: ${path}`);
    this.logger.log(`[COURSES GATEWAY] Target URL: ${url}`);

    try {
      const requestConfig: any = {
        method: req.method,
        url,
        headers: {
          ...req.headers,
          host: undefined,
        },
        data: req.body,
      };

      if (req.method === "GET" && Object.keys(req.query).length > 0) {
        requestConfig.params = req.query;
      }

      this.logger.log(`[COURSES GATEWAY] Request config: ${JSON.stringify({
        method: requestConfig.method,
        url: requestConfig.url,
        hasParams: !!requestConfig.params,
        hasData: !!requestConfig.data
      })}`);

      const response = await firstValueFrom(
        this.httpService.request(requestConfig),
      );

      this.logger.log(`[COURSES GATEWAY] Response received: ${response.status}`);
      this.logger.log(`[COURSES GATEWAY] Response data: ${JSON.stringify(response.data)}`);

      Object.keys(response.headers).forEach((key) => {
        res.setHeader(key, response.headers[key]);
      });

      res.status(response.status).json(response.data);
    } catch (error: any) {
      this.logger.error(`[COURSES GATEWAY] === ERROR ===`);
      this.logger.error(`[COURSES GATEWAY] Error message: ${error.message}`);
      this.logger.error(`[COURSES GATEWAY] Error stack: ${error.stack}`);
      
      if (error.response) {
        this.logger.error(`[COURSES GATEWAY] Error response status: ${error.response.status}`);
        this.logger.error(`[COURSES GATEWAY] Error response data: ${JSON.stringify(error.response.data)}`);
        this.logger.error(`[COURSES GATEWAY] Error response headers: ${JSON.stringify(error.response.headers)}`);
        res.status(error.response.status).json(error.response.data);
      } else {
        this.logger.error(`[COURSES GATEWAY] No response object in error`);
        res.status(500).json({
          error: "Gateway Error",
          message: "Ошибка API Gateway",
          details: error.message
        });
      }
    }
  }
}

