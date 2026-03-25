import { expect, test } from "@playwright/test";

function buildDashboardPayload() {
  return {
    userName: "Ana",
    referenceMonth: "março de 2026",
    summary: {
      balanceMonth: 3200,
      income: 9000,
      expenses: 4200,
      leftover: 2800,
      upcomingBillsAmount: 1200,
      netWorth: 75600,
    },
    upcomingBills: [
      {
        id: "bill-1",
        description: "Fatura cartao",
        dueDate: "2026-03-29",
        amount: 1200,
      },
    ],
    goals: [
      {
        id: "goal-1",
        name: "Reserva",
        currentAmount: 3000,
        targetAmount: 12000,
        targetDate: "2026-12-01",
      },
    ],
    onboarding: {
      completedSteps: 5,
      totalSteps: 5,
      isComplete: true,
      steps: [],
      nextStep: null,
      nudge: "Configuracao concluida.",
      dashboardGuide: ["Saldo", "Contas", "Metas"],
    },
    insights: [
      {
        id: "leftover",
        title: "Sua sobra projetada segue positiva",
        description: "Mantendo o ritmo atual, sobram R$ 2800.",
      },
    ],
    advisor: {
      priorityOfWeek: {
        id: "advisory-1",
        title: "Quitar conta vencida",
        route: "/transactions",
        cta: "Ver lancamentos",
        dueDate: "2026-03-27",
        score: 158,
      },
      mainAttention: "Evite juros e regularize a conta pendente.",
      shortTermActions: [
        {
          id: "advisory-1",
          source: "alerta",
          type: "CASHFLOW",
          title: "Quitar conta vencida",
          message: "Existe uma conta vencida que pode gerar multa.",
          recommendation: "Priorize o pagamento hoje e marque como concluida.",
          route: "/transactions",
          cta: "Ver lancamentos",
          dueDate: "2026-03-27",
          score: 158,
          impactEstimate: "Reducao imediata de risco de juros.",
          context: {
            status: "suggested",
            suggestionTone: "objetivo",
          },
        },
        {
          id: "advisory-2",
          source: "priorizacao",
          type: "BUDGET",
          title: "Ajustar gasto variavel",
          message: "Orcamento proximo do limite na categoria lazer.",
          recommendation: "Adie despesas opcionais desta semana.",
          route: "/budgets",
          cta: "Ver orcamentos",
          dueDate: "2026-03-30",
          score: 126,
          impactEstimate: "Melhora na sobra projetada.",
          context: {
            status: "viewed",
            suggestionTone: "encorajador",
          },
        },
        {
          id: "advisory-3",
          source: "plano",
          type: "GOAL",
          title: "Retomar aporte na meta",
          message: "Meta sem aporte recente.",
          recommendation: "Defina um aporte minimo nesta semana.",
          route: "/goals",
          cta: "Ver metas",
          dueDate: "2026-04-02",
          score: 108,
          impactEstimate: "Retomada de consistencia em metas.",
          context: {
            status: "postponed",
            postponedUntil: "2026-03-31T00:00:00.000Z",
            suggestionTone: "direto",
          },
        },
      ],
      riskSummary: {
        level: "alto",
        score: 74,
        label: "Risco elevado",
        description: "1 ponto critico pede acao imediata.",
      },
      monthlyActionPlan: {
        title: "Plano de acao do mes",
        subtitle:
          "As 3 acoes mais relevantes para manter sua saude financeira.",
        actions: [
          {
            id: "advisory-1",
            source: "alerta",
            type: "CASHFLOW",
            title: "Quitar conta vencida",
            message: "Existe uma conta vencida que pode gerar multa.",
            recommendation:
              "Priorize o pagamento hoje e marque como concluida.",
            route: "/transactions",
            cta: "Ver lancamentos",
            dueDate: "2026-03-27",
            score: 158,
            impactEstimate: "Reducao imediata de risco de juros.",
            context: {
              status: "suggested",
              suggestionTone: "objetivo",
            },
          },
          {
            id: "advisory-2",
            source: "priorizacao",
            type: "BUDGET",
            title: "Ajustar gasto variavel",
            message: "Orcamento proximo do limite na categoria lazer.",
            recommendation: "Adie despesas opcionais desta semana.",
            route: "/budgets",
            cta: "Ver orcamentos",
            dueDate: "2026-03-30",
            score: 126,
            impactEstimate: "Melhora na sobra projetada.",
            context: {
              status: "viewed",
              suggestionTone: "encorajador",
            },
          },
          {
            id: "advisory-3",
            source: "plano",
            type: "GOAL",
            title: "Retomar aporte na meta",
            message: "Meta sem aporte recente.",
            recommendation: "Defina um aporte minimo nesta semana.",
            route: "/goals",
            cta: "Ver metas",
            dueDate: "2026-04-02",
            score: 108,
            impactEstimate: "Retomada de consistencia em metas.",
            context: {
              status: "postponed",
              postponedUntil: "2026-03-31T00:00:00.000Z",
              suggestionTone: "direto",
            },
          },
        ],
      },
      routine: {
        weeklyPriority: "Quitar conta vencida",
        monthReview: "Mantenha o controle semanal.",
        goalConsistency: "1 meta sem ritmo ideal.",
        followUpReminder: "Reserve 10 minutos para revisar alertas.",
      },
      behaviorProfile: {
        strongTypes: ["CASHFLOW"],
        weakTypes: ["GOAL"],
        byType: [
          {
            type: "CASHFLOW",
            completedRate: 0.6,
            dismissedRate: 0.1,
            postponedRate: 0.1,
            totalInteractions: 10,
          },
        ],
      },
      consultiveAnalytics: {
        completedCount: 4,
        postponedCount: 2,
        dismissedCount: 1,
        viewedCount: 7,
        avgActionTimeMinutes: 42,
        completionRate: 0.57,
        byType: [
          { type: "CASHFLOW", acted: 3, ignored: 0 },
          { type: "GOAL", acted: 1, ignored: 1 },
        ],
      },
    },
  };
}

async function mockApi(page: Parameters<typeof test>[0]["page"]) {
  const dashboardPayload = buildDashboardPayload();
  const alertsPayload = {
    items: [
      {
        id: "alert-1",
        type: "CASHFLOW",
        severity: "WARNING",
        title: "Conta vence em breve",
        message: "A conta de energia vence em 2 dias.",
        actionLabel: "Ver lancamentos",
        actionRoute: "/transactions",
        recommendation: {
          whatHappened: "Conta proxima do vencimento.",
          whyItMatters: "Evita juros e multa.",
          whatToDoNow: "Programe o pagamento.",
          reviewAt: "2026-03-27",
          impactEstimate: "Melhora de previsibilidade.",
        },
        isRead: false,
        triggerDate: "2026-03-25T12:00:00.000Z",
        createdAt: "2026-03-25T12:00:00.000Z",
      },
    ],
    unreadCount: 1,
  };

  await page.route("**/api/proxy/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/proxy/, "");
    const method = request.method();

    const jsonResponse = (
      payload: unknown,
      status = 200,
      extraHeaders?: Record<string, string>,
    ) =>
      route.fulfill({
        status,
        headers: {
          "content-type": "application/json",
          ...extraHeaders,
        },
        body: JSON.stringify(payload),
      });

    if (path === "/auth/login" && method === "POST") {
      return jsonResponse(
        {
          user: {
            id: "user-1",
            email: "ana@example.com",
            fullName: "Ana QA",
          },
        },
        200,
        {
          "set-cookie":
            "patrimoniq_session=playwright-session; Path=/; HttpOnly; SameSite=Lax",
        },
      );
    }

    if (path === "/auth/me" && method === "GET") {
      return jsonResponse({
        user: {
          id: "user-1",
          email: "ana@example.com",
          fullName: "Ana QA",
        },
      });
    }

    if (path === "/dashboard/overview" && method === "GET") {
      return jsonResponse(dashboardPayload);
    }

    if (path === "/alerts" && method === "GET") {
      return jsonResponse(alertsPayload);
    }

    if (path === "/alerts/evaluate" && method === "POST") {
      return jsonResponse({ evaluated: 3, emailSent: 0 });
    }

    if (path.startsWith("/alerts/") && method === "POST") {
      return jsonResponse({ success: true });
    }

    if (
      path.includes("/dashboard/action-plan/") &&
      path.endsWith("/interaction") &&
      method === "POST"
    ) {
      return jsonResponse({ success: true });
    }

    if (
      path.includes("/dashboard/action-plan/") &&
      path.endsWith("/status") &&
      method === "POST"
    ) {
      return jsonResponse({ success: true, status: "COMPLETED" });
    }

    if (path === "/settings" && method === "GET") {
      return jsonResponse({
        profile: {
          fullName: "Ana QA",
          email: "ana@example.com",
          locale: "pt-BR",
        },
        categories: [
          {
            id: "cat-1",
            name: "Moradia",
            slug: "moradia",
            direction: "Despesa",
            directionCode: "EXPENSE",
            subcategories: [{ id: "sub-1", name: "Aluguel", slug: "aluguel" }],
          },
        ],
        integrations: [],
        fiscalReadiness: { deductibleGroups: [], exportMode: "em breve" },
        notificationPreferences: {
          emailAlerts: true,
          weeklyDigest: true,
          dueDateReminders: true,
          budgetAlerts: true,
          pushEnabled: false,
        },
        runtime: {
          stage: "dev",
          appUrl: "http://127.0.0.1:3000",
          frontendUrl: "http://127.0.0.1:3000",
          corsOrigins: [],
          session: {
            cookieSecure: false,
            sameSite: "lax",
            cookieDomain: null,
            proxyMode: "same-origin",
          },
          email: {
            configuredProvider: "smtp",
            resolvedProvider: "smtp",
            fromAddress: "noreply@patrimoniq.com",
            replyTo: null,
            canSendRealEmail: false,
            canSendTestEmail: false,
          },
          monitoring: {
            provider: "internal",
            enabled: false,
            targetLabel: "internal",
          },
          feedback: {
            inAppEnabled: true,
            relayMode: "db",
            targetLabel: "db",
          },
          warnings: [],
        },
      });
    }

    if (path === "/settings/notifications" && method === "GET") {
      return jsonResponse({
        success: true,
        preferences: {
          emailAlerts: true,
          weeklyDigest: true,
          dueDateReminders: true,
          budgetAlerts: true,
          pushEnabled: false,
        },
      });
    }

    if (path === "/settings/notifications" && method === "PATCH") {
      return jsonResponse({
        success: true,
        message: "Preferencias de notificacao salvas.",
        preferences: {
          emailAlerts: true,
          weeklyDigest: true,
          dueDateReminders: true,
          budgetAlerts: true,
          pushEnabled: false,
        },
      });
    }

    if (path === "/settings/sessions" && method === "GET") {
      return jsonResponse({
        sessions: [
          {
            id: "sess-1",
            isCurrent: true,
            userAgent: "Playwright Chromium",
            ipAddress: "127.0.0.1",
            lastSeenAt: "2026-03-25T18:00:00.000Z",
            createdAt: "2026-03-20T10:00:00.000Z",
          },
        ],
      });
    }

    if (path === "/accounts" && method === "GET") {
      return jsonResponse({
        items: [
          {
            id: "acc-1",
            name: "Conta principal",
            type: "Conta corrente",
            typeCode: "CHECKING",
            institutionName: "341 - Itaú",
            openingBalance: 2000,
            currentBalance: 2600,
          },
        ],
      });
    }

    if (path === "/categories" && method === "GET") {
      return jsonResponse({
        items: [
          {
            id: "cat-1",
            name: "Moradia",
            slug: "moradia",
            direction: "Despesa",
            directionCode: "EXPENSE",
            subcategories: [{ id: "sub-1", name: "Aluguel", slug: "aluguel" }],
          },
        ],
      });
    }

    if (path === "/subcategories" && method === "GET") {
      return jsonResponse({
        items: [
          {
            id: "sub-1",
            categoryId: "cat-1",
            categoryName: "Moradia",
            name: "Aluguel",
            slug: "aluguel",
            costNature: "FIXED",
            essentiality: "ESSENTIAL",
          },
        ],
      });
    }

    if (
      (path === "/accounts" || path.startsWith("/accounts/")) &&
      (method === "POST" || method === "PATCH")
    ) {
      return jsonResponse({
        id: "acc-1",
        name: "Conta principal",
        type: "Conta corrente",
        typeCode: "CHECKING",
        institutionName: "341 - Itaú",
        openingBalance: 2000,
        currentBalance: 2600,
      });
    }

    if (
      (path.startsWith("/settings/") ||
        path.startsWith("/categories") ||
        path.startsWith("/subcategories")) &&
      (method === "POST" || method === "PATCH" || method === "DELETE")
    ) {
      return jsonResponse({ success: true, message: "ok" });
    }

    return jsonResponse({ success: true });
  });
}

test("desktop valida login, dashboard consultivo, plano de acao e configuracoes sem erros", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(90000);
  test.skip(!baseURL, "Defina PLAYWRIGHT_BASE_URL.");

  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon.ico")) consoleErrors.push(text);
    }
  });

  page.on("requestfailed", (request) => {
    requestFailures.push(`${request.method()} ${request.url()}`);
  });

  await mockApi(page);

  await page.goto("/login");
  await page.getByLabel("E-mail").fill("ana@example.com");
  await page.getByLabel("Senha").fill("Patrimoniq123!");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/proxy/auth/login"),
    ),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
  const cookieDomain = new URL(baseURL).hostname;

  await context.addCookies([
    {
      name: "patrimoniq_session",
      value: "playwright-session",
      domain: cookieDomain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto("/dashboard");

  await expect(page.getByText("Plano de acao do mes")).toBeVisible();
  await expect(page.getByText("Quitar conta vencida").first()).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept("Concluida sem impedimentos."));
  await page.getByRole("button", { name: "Concluir" }).first().click();
  await page.getByRole("button", { name: "Adiar" }).first().click();
  await page.getByRole("button", { name: "Dispensar" }).first().click();

  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Notificacoes" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seguranca" })).toBeVisible();

  const bankInput = page.locator(".bank-field input");
  await bankInput.fill("341");
  await expect(page.getByRole("button", { name: /341 · Itaú/i })).toBeVisible();
  await page.getByRole("button", { name: /341 · Itaú/i }).click();
  await expect(bankInput).toHaveValue(/341 - Itaú/i);

  await page.getByRole("button", { name: "Salvar notificacoes" }).click();

  await expect(
    page.getByText("Falha ao carregar /settings/notifications"),
  ).not.toBeVisible();
  await expect(
    page.getByText("Nao foi possivel falar com o servidor agora"),
  ).not.toBeVisible();
  const relevantFailures = requestFailures.filter((item) =>
    item.includes("/api/proxy/"),
  );
  expect(relevantFailures).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("mobile valida menu sanduiche, dashboard e configuracoes com layout funcional", async ({
  browser,
  baseURL,
}) => {
  test.skip(!baseURL, "Defina PLAYWRIGHT_BASE_URL.");
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await mockApi(page);
  const cookieDomain = new URL(baseURL).hostname;

  await context.addCookies([
    {
      name: "patrimoniq_session",
      value: "playwright-session",
      domain: cookieDomain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  await page.goto("/dashboard");
  await expect(page.getByText("Plano de acao do mes")).toBeVisible();

  await page.getByRole("button", { name: "Abrir menu de navegacao" }).click();
  await expect(
    page.getByRole("navigation", { name: "Navegacao principal" }),
  ).toBeVisible();
  await page.mouse.click(370, 120);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Sua conta" })).toBeVisible();
  await expect(page.locator(".bank-field input")).toBeVisible();

  await context.close();
});
