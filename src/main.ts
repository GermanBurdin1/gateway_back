import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { IoAdapter } from "@nestjs/platform-socket.io";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Настраиваем WebSocket адаптер
  app.useWebSocketAdapter(new IoAdapter(app));

  app.enableCors({
    origin: "http://localhost:4200",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Content-Type, Authorization",
    credentials: true,
  });

  // Устанавливаем глобальный префикс /api
  app.setGlobalPrefix('api');

  await app.listen(3011);
  console.log("🚀 API Gateway запущен на порту 3011");
  console.log("📍 Проксирует auth-service на http://localhost:3001");
  console.log("🔌 WebSocket сервер активирован");
}
bootstrap();
