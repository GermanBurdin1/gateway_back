import { Controller, All, Req, Res, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { Request, Response } from "express";
import { Agent as HttpAgent } from "http"; // <-- так корректно

@Controller("mindmap")
export class MindmapGatewayController {
  private readonly logger = new Logger(MindmapGatewayController.name);
  private readonly base =
    process.env.MINDMAP_BASE_URL || "http://127.0.0.1:3002";

  constructor(private readonly http: HttpService) {}

  // ловит ровно /api/mindmap
  @All()
  root(@Req() req: Request, @Res() res: Response) {
    return this.forward(req, res);
  }

  // ловит /api/mindmap/...
  @All("*")
  any(@Req() req: Request, @Res() res: Response) {
    return this.forward(req, res);
  }

  private async forward(req: Request, res: Response) {
    const original = req.originalUrl; // /api/mindmap...
    const targetPath = original.replace(/^\/api/, "") || "/"; // -> /mindmap...
    const url = this.base + targetPath;

    this.logger.log(`[API Gateway] ${req.method} ${original} -> ${url}`);

    try {
      const resp = await firstValueFrom(
        this.http.request({
          method: req.method,
          url,
          httpAgent: new HttpAgent({ family: 4 }), // исключаем ::1
          headers: { ...req.headers, host: undefined },
          data: req.body,
          params: req.method === "GET" ? req.query : undefined,
          timeout: 10000,
        }),
      );
      for (const [k, v] of Object.entries(resp.headers))
        res.setHeader(k, v as any);
      res.status(resp.status).send(resp.data);
    } catch (e: any) {
      this.logger.error(`[API Gateway] Proxy error: ${e.message}`);
      if (e.response) res.status(e.response.status).send(e.response.data);
      else
        res.status(502).json({
          error: "Bad Gateway",
          message: "Mindmap service unreachable",
        });
    }
  }
}
