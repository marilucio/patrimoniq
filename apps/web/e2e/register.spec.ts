import { expect, test } from "@playwright/test";

function buildUniqueEmail() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  return `playwright.cadastro.${timestamp}.${random}@example.com`;
}

test("cadastro principal cria sessao e leva o usuario ao dashboard", async ({
  page,
  context,
  baseURL,
}) => {
  test.setTimeout(60000);

  const email = buildUniqueEmail();
  const password = "Patrimoniq123!";

  test.skip(
    !baseURL,
    "Defina PLAYWRIGHT_BASE_URL para executar o fluxo contra o site desejado.",
  );

  await page.goto("/register");

  await expect(
    page.getByRole("heading", { name: "Criar conta" }),
  ).toBeVisible();

  await page.getByLabel("Nome completo").fill("Usuário Playwright");
  await page.getByLabel("E-mail").fill(email);
  await page.locator("form input[type='password']").first().fill(password);
  await page.locator("form input[type='password']").nth(1).fill(password);

  const registerResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/auth/register"),
    ),
    page.getByRole("button", { name: "Criar conta" }).click(),
  ]).then(([response]) => response);

  expect(registerResponse.ok()).toBeTruthy();

  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByText("Primeiros passos")).toBeVisible();
  await expect(page.getByText("Seu painel ainda esta vazio")).toBeVisible();
  await expect(page.getByText("Ocorreu um erro interno.")).not.toBeVisible();

  const cookies = await context.cookies(baseURL);
  const sessionCookie = cookies.find(
    (cookie) => cookie.name === "patrimoniq_session",
  );

  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBeTruthy();

  await page.reload();
  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByText("Primeiros passos")).toBeVisible();

  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL(/\/login$/);

  await page.getByLabel("E-mail").fill(email);
  await page.locator("form input[type='password']").first().fill(password);

  const loginResponse = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/auth/login"),
    ),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]).then(([response]) => response);

  expect(loginResponse.ok()).toBeTruthy();

  await page.waitForURL(/\/dashboard$/);
  await expect(page.getByText("Primeiros passos")).toBeVisible();
});
