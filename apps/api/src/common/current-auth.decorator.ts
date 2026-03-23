import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { RequestWithAuth } from "./auth.types";

export const CurrentAuth = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithAuth>();
  return request.auth;
});

