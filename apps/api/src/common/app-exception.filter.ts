import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import type { RequestWithAuth } from "./auth.types";
import { MonitoringService } from "./monitoring.service";

function extractMessage(exception: unknown) {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === "string") {
      return response;
    }

    if (response && typeof response === "object" && "message" in response) {
      const message = (response as { message?: string | string[] }).message;

      if (Array.isArray(message)) {
        return message.join(" ");
      }

      if (typeof message === "string") {
        return message;
      }
    }
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return "Nao foi possivel concluir sua solicitacao.";
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  constructor(private readonly monitoringService: MonitoringService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<{
      status(code: number): { json(payload: unknown): void };
      setHeader(name: string, value: string): void;
      statusCode?: number;
    }>();
    const request = context.getRequest<RequestWithAuth & {
      method?: string;
      originalUrl?: string;
      url?: string;
      requestId?: string;
      ip?: string;
    }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.requestId ?? "sem-request-id";
    const message =
      status >= 500
        ? "Ocorreu um erro interno. Tente novamente em instantes."
        : extractMessage(exception);

    const summary = [
      `[${requestId}]`,
      request.method ?? "HTTP",
      request.originalUrl ?? request.url ?? "",
      `status=${status}`,
      `user=${request.auth?.userId ?? "anon"}`,
      `ip=${request.ip ?? "desconhecido"}`,
      `erro=${extractMessage(exception)}`
    ].join(" ");

    if (status >= 500) {
      this.logger.error(summary, exception instanceof Error ? exception.stack : undefined);
      void this.monitoringService.capture({
        level: "error",
        title: "Erro interno na API",
        message: extractMessage(exception),
        requestId,
        userId: request.auth?.userId,
        path: request.originalUrl ?? request.url,
        statusCode: status,
        context: {
          method: request.method,
          ip: request.ip
        },
        stack: exception instanceof Error ? exception.stack : undefined
      });
    } else if (status >= 400) {
      this.logger.warn(summary);
    } else {
      this.logger.log(summary);
    }

    response.setHeader("x-request-id", requestId);
    response.status(status).json({
      statusCode: status,
      message,
      requestId,
      timestamp: new Date().toISOString()
    });
  }
}
