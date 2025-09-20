import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { IoAdapter } from "@nestjs/platform-socket.io";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Настраиваем WebSocket адаптер
  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: [
      "http://localhost:4200",
      "http://135.125.107.45:4200",
    ],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "X-Requested-With",
      "Accept",
      "Origin"
    ],
    exposedHeaders: ["X-Total-Count"],
    credentials: true,
    maxAge: 86400, // 24 heures
    optionsSuccessStatus: 200
  });

  await app.listen(3011);
  console.log("🚀 API Gateway запущен на порту 3011");
  console.log("📍 Проксирует auth-service на http://localhost:3001");
  console.log("🔌 WebSocket сервер активирован");
}
bootstrap();
