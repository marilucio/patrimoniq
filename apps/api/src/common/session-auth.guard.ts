import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { randomUUID } from "crypto";
import { PrismaService } from "./prisma.service";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { hashSessionToken, readCookie } from "./password.utils";
import type { RequestWithAuth } from "./auth.types";

export const SESSION_COOKIE_NAME = "patrimoniq_session";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth & {
      headers: Record<string, string | string[] | undefined>;
      requestId?: string;
    }>();
    const headerRequestId = request.headers["x-request-id"];
    request.requestId =
      typeof headerRequestId === "string" && headerRequestId.trim()
        ? headerRequestId
        : request.requestId ?? randomUUID();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE_NAME);

    if (!token) {
      throw new UnauthorizedException("Faca login para continuar.");
    }

    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash: hashSessionToken(token)
      },
      include: {
        user: true
      }
    });

    if (!session) {
      throw new UnauthorizedException("Sua sessao nao e valida. Entre novamente.");
    }

    if (session.revokedAt || session.expiresAt <= new Date()) {
      if (!session.revokedAt) {
        void this.prisma.session.updateMany({
          where: {
            id: session.id,
            revokedAt: null
          },
          data: {
            revokedAt: new Date()
          }
        });
      }

      throw new UnauthorizedException("Sua sessao expirou. Entre novamente.");
    }

    request.auth = {
      sessionId: session.id,
      userId: session.userId,
      email: session.user.email,
      fullName: session.user.fullName
    };

    void this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date()
      }
    });

    return true;
  }
}
