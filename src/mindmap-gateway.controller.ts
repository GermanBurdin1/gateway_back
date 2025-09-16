import { Controller, All, Req, Res, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";

@Controller("mindmap")
export class MindmapGatewayController {
  private readonly logger = new Logger(MindmapGatewayController.name);
  private readonly mindmapServiceUrl = "http://127.0.0.1:3002";

  constructor(private readonly httpService: HttpService) {}

  @All()
  async proxyRoot(@Req() req: Request, @Res() res: Response) {
    this.logger.log(`[API Gateway] === ROOT REQUEST ===`);
    this.logger.log(`[API Gateway] Method: ${req.method}`);
    this.logger.log(`[API Gateway] Original URL: ${req.url}`);
    this.logger.log(`[API Gateway] Original Path: ${req.path}`);
    
    // Проксируем к Mindmap Service
    return this.proxyToMindmapService(req, res);
  }

  @All("*")
  async proxyToMindmapService(@Req() req: Request, @Res() res: Response) {
    this.logger.log(`[API Gateway] === NEW REQUEST ===`);
    this.logger.log(`[API Gateway] Method: ${req.method}`);
    this.logger.log(`[API Gateway] Original URL: ${req.url}`);
    this.logger.log(`[API Gateway] Original Path: ${req.path}`);
    this.logger.log(`[API Gateway] Query: ${JSON.stringify(req.query)}`);
    
    const decodedUrl = decodeURIComponent(req.url);
    this.logger.log(`[API Gateway] Decoded URL: ${decodedUrl}`);
    
    let targetUrl = decodedUrl;

    // Преобразуем /api/mindmap в /mindmap для Mindmap Service
    if (targetUrl.startsWith("/api/mindmap")) {
      targetUrl = targetUrl.replace("/api/mindmap", "/mindmap");
      this.logger.log(`[API Gateway] URL transformed: ${targetUrl}`);
    } else {
      this.logger.log(`[API Gateway] URL NOT transformed (doesn't start with /api/mindmap): ${targetUrl}`);
    }

    const url = `${this.mindmapServiceUrl}${targetUrl}`;
    this.logger.log(`[API Gateway] Final URL: ${url}`);

    try {
      // Преобразуем /api/mindmap в /mindmap для Mindmap Service
      let targetPath = req.path;
      this.logger.log(`[API Gateway] Original path: ${req.path}`);
      
      if (targetPath.startsWith("/api/mindmap")) {
        targetPath = targetPath.replace("/api/mindmap", "/mindmap");
        this.logger.log(`[API Gateway] Path transformed: ${targetPath}`);
      } else {
        this.logger.log(`[API Gateway] Path NOT transformed (doesn't start with /api/mindmap): ${targetPath}`);
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

      this.logger.log(`[API Gateway] Sending request to: ${requestConfig.url}`);
      
      const response = await firstValueFrom(
        this.httpService.request(requestConfig),
      );

      this.logger.log(`[API Gateway] Response received!`);
      this.logger.log(`[API Gateway] Response status: ${response.status}`);
      this.logger.log(`[API Gateway] Response headers: ${JSON.stringify(response.headers)}`);
      this.logger.log(`[API Gateway] Response data: ${JSON.stringify(response.data)}`);

      Object.keys(response.headers).forEach((key) => {
        res.setHeader(key, response.headers[key]);
      });

      this.logger.log(`[API Gateway] Sending response to client: ${response.status}`);
      res.status(response.status).json(response.data);
    } catch (error) {
      this.logger.error(`[API Gateway] === ERROR ===`);
      this.logger.error(`[API Gateway] Error message: ${error.message}`);
      this.logger.error(`[API Gateway] Error stack: ${error.stack}`);
      
      if (error.response) {
        this.logger.error(`[API Gateway] Error response status: ${error.response.status}`);
        this.logger.error(`[API Gateway] Error response data: ${JSON.stringify(error.response.data)}`);
        res.status(error.response.status).json(error.response.data);
      } else {
        this.logger.error(`[API Gateway] No response object in error`);
        res.status(500).json({
          error: "Gateway Error",
          message: "Ошибка API Gateway",
        });
      }
    }
  }
}
