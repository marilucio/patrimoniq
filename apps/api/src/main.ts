import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const httpAdapter = app.getHttpAdapter().getInstance() as { set?: (key: string, value: number) => void };
  const trustProxyValue = (process.env.TRUST_PROXY ?? "false").trim().toLowerCase();
  const trustProxy =
    trustProxyValue === "true" ? 1 : /^\d+$/.test(trustProxyValue) ? Number(trustProxyValue) : 0;

  httpAdapter.set?.("trust proxy", trustProxy);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ["content-type", "x-request-id"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  });
  app.setGlobalPrefix("api");

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3333);
}

bootstrap();
