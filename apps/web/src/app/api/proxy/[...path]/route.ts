import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function readBackendApiUrl() {
  const raw = (
    process.env.BACKEND_API_URL ?? "http://localhost:3333/api"
  ).trim();

  try {
    const parsed = new URL(raw);
    const cleanPath = parsed.pathname.replace(/\/$/, "");
    if (!cleanPath || cleanPath === "") {
      parsed.pathname = "/api";
    } else if (cleanPath === "/") {
      parsed.pathname = "/api";
    } else {
      parsed.pathname = cleanPath;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw.replace(/\/$/, "");
  }
}

function buildBackendCandidates(request: NextRequest) {
  const raw = readBackendApiUrl();
  const candidates = new Set<string>();
  const normalizedPath = (value: string) => value.replace(/\/$/, "");

  const add = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    candidates.add(normalizedPath(trimmed));
  };

  try {
    const parsed = new URL(raw);
    const pathname = parsed.pathname.replace(/\/$/, "");
    const baseOrigin = `${parsed.protocol}//${parsed.host}`;
    const cleanPath =
      pathname === "/api/proxy"
        ? "/api"
        : pathname.endsWith("/api/proxy")
          ? pathname.slice(0, -"/proxy".length)
          : pathname;
    const withApi =
      !cleanPath || cleanPath === "/" ? "/api" : cleanPath.endsWith("/api") ? cleanPath : `${cleanPath}/api`;
    add(`${baseOrigin}${withApi}`);

    const withoutApi = withApi.endsWith("/api")
      ? withApi.slice(0, -4)
      : withApi;
    if (withoutApi && withoutApi !== "/") {
      add(`${baseOrigin}${withoutApi}`);
    }

    const sameOriginApi = `${request.nextUrl.protocol}//${request.nextUrl.host}/api`;
    add(sameOriginApi);
  } catch {
    const fallback = raw.replace(/\/$/, "");
    add(fallback);
    if (!fallback.endsWith("/api")) {
      add(`${fallback}/api`);
    }
  }

  return [...candidates];
}

function readForwardHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const normalized = key.toLowerCase();

    if (["host", "connection", "content-length"].includes(normalized)) {
      return;
    }

    headers.set(key, value);
  });

  const forwardedFor = request.headers.get("x-forwarded-for");

  if (!forwardedFor) {
    headers.set("x-forwarded-for", "127.0.0.1");
  }

  if (!request.headers.get("x-forwarded-proto")) {
    headers.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));
  }

  if (!request.headers.get("x-forwarded-host")) {
    headers.set("x-forwarded-host", request.nextUrl.host);
  }

  return headers;
}

async function proxy(request: NextRequest, params: { path?: string[] }) {
  const path = (params.path ?? []).join("/");
  const query = request.nextUrl.search;
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  const headers = readForwardHeaders(request);
  const candidates = buildBackendCandidates(request);
  let fallbackResponse: Response | null = null;

  for (const candidate of candidates) {
    const targetUrl = `${candidate}/${path}${query}`;
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
      });
      if (response.status === 404) {
        fallbackResponse = response;
        continue;
      }
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");

      return new Response(await response.arrayBuffer(), {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch {
      continue;
    }
  }

  if (fallbackResponse) {
    const responseHeaders = new Headers(fallbackResponse.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    return new Response(await fallbackResponse.arrayBuffer(), {
      status: fallbackResponse.status,
      statusText: fallbackResponse.statusText,
      headers: responseHeaders,
    });
  }

  return Response.json(
    {
      statusCode: 502,
      message: "Nao foi possivel alcancar a API do Patrimoniq.",
      timestamp: new Date().toISOString(),
    },
    {
      status: 502,
    },
  );
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ path?: string[] }>;
  },
) {
  return proxy(request, await context.params);
}

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ path?: string[] }>;
  },
) {
  return proxy(request, await context.params);
}

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{ path?: string[] }>;
  },
) {
  return proxy(request, await context.params);
}

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{ path?: string[] }>;
  },
) {
  return proxy(request, await context.params);
}

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{ path?: string[] }>;
  },
) {
  return proxy(request, await context.params);
}

export async function OPTIONS(
  request: NextRequest,
  context: {
    params: Promise<{ path?: string[] }>;
  },
) {
  return proxy(request, await context.params);
}
