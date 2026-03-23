import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { tap } from "rxjs/operators";
import type { RequestWithAuth } from "./auth.types";

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Http");

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<RequestWithAuth & {
      method?: string;
      originalUrl?: string;
      url?: string;
      headers?: Record<string, string | string[] | undefined>;
      requestId?: string;
    }>();
    const response = context.switchToHttp().getResponse<{
      statusCode?: number;
      setHeader(name: string, value: string): void;
    }>();
    const startedAt = Date.now();
    const headerRequestId = request.headers?.["x-request-id"];
    const requestId =
      typeof headerRequestId === "string" && headerRequestId.trim()
        ? headerRequestId
        : randomUUID();

    request.requestId = requestId;
    response.setHeader("x-request-id", requestId);

    return next.handle().pipe(
      tap({
        next: () => {
          const path = request.originalUrl ?? request.url ?? "";

          if (path.endsWith("/health")) {
            return;
          }

          const statusCode = response.statusCode ?? 200;
          const duration = Date.now() - startedAt;
          this.logger.log(
            `[${requestId}] ${request.method ?? "HTTP"} ${path} ${statusCode} ${duration}ms user=${request.auth?.userId ?? "anon"}`
          );
        }
      })
    );
  }
}
