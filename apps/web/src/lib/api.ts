function readApiBaseUrl() {
  const publicApiPath = process.env.NEXT_PUBLIC_API_URL ?? "/api/proxy";

  if (typeof window !== "undefined") {
    return publicApiPath;
  }

  if (process.env.API_URL) {
    return process.env.API_URL;
  }

  if (/^https?:\/\//.test(publicApiPath)) {
    return publicApiPath;
  }

  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}${publicApiPath}`;
}

const API_BASE_URL = readApiBaseUrl();
const AUTH_FLOW_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/password/forgot",
  "/auth/password/reset"
]);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function redirectToLoginWithReason(reason: string) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL("/login", window.location.origin);
  url.searchParams.set("motivo", reason);
  window.location.assign(url.toString());
}

export interface AuthSessionResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
  };
}

export interface AccountItem {
  id: string;
  name: string;
  type: string;
  typeCode: string;
  institutionName?: string | null;
  openingBalance: number;
  currentBalance: number;
}

export interface AccountsResponse {
  items: AccountItem[];
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  direction: string;
  directionCode: string;
  subcategories: Array<{
    id: string;
    name: string;
    slug: string;
    costNature?: string | null;
    essentiality?: string | null;
  }>;
}

export interface CategoriesResponse {
  items: CategoryItem[];
}

export interface SubcategoryItem {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  slug: string;
  costNature?: string | null;
  essentiality?: string | null;
}

export interface SubcategoriesResponse {
  items: SubcategoryItem[];
}

export interface TransactionItem {
  id: string;
  date: string;
  description: string;
  type: string;
  typeCode: string;
  direction: "receita" | "despesa" | "transferencia";
  status: string;
  statusCode: string;
  statusTone: "compensada" | "planejada" | "atrasada";
  amount: number;
  account: string;
  accountId: string | null;
  cardId: string | null;
  category: string;
  categoryId: string | null;
  subcategory: string;
  subcategoryId: string | null;
  paymentMethod: string;
  paymentMethodCode: string;
  tags: string[];
  nature: string;
  natureCode?: string | null;
  essentiality: string;
  essentialityCode?: string | null;
  notes: string;
}

export interface TransactionsResponse {
  summary: {
    income: number;
    expenses: number;
    planned: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  items: TransactionItem[];
}

export interface BudgetItem {
  id: string;
  name: string;
  category: string;
  planned: number;
  actual: number;
  forecast: number;
  cadence: string;
  cadenceCode: string;
  alertThresholdPercent: number;
  notes: string;
  categoryId: string | null;
  subcategoryId: string | null;
  periodStart: string;
  periodEnd: string;
}

export interface BudgetsResponse {
  items: BudgetItem[];
  atRisk: BudgetItem[];
  totals: {
    planned: number;
    actual: number;
    forecast: number;
  };
}

export interface GoalItem {
  id: string;
  name: string;
  kind: string;
  kindCode: string;
  status: string;
  statusCode: string;
  targetAmount: number;
  currentAmount: number;
  monthlyTarget: number;
  priority: string;
  priorityCode: string;
  notes: string;
  targetDate: string;
}

export interface GoalsResponse {
  items: GoalItem[];
  simulations: Array<{
    id: string;
    label: string;
    impact: string;
    outcome: string;
  }>;
}

export interface AssetRecord {
  id: string;
  name: string;
  type: string;
  typeCode: string;
  value: number;
  currentValue: number;
  acquisitionValue: number;
  linkedAccountId: string | null;
}

export interface AssetsResponse {
  items: AssetRecord[];
}

export interface LiabilityRecord {
  id: string;
  name: string;
  type: string;
  typeCode: string;
  balance: number;
  currentBalance: number;
  monthlyCost: number;
  monthlyPayment: number;
  linkedCardId: string | null;
}

export interface LiabilitiesResponse {
  items: LiabilityRecord[];
}

export interface NetWorthResponse {
  assets: Array<{
    id: string;
    name: string;
    type: string;
    typeCode: string;
    value: number;
  }>;
  liabilities: Array<{
    id: string;
    name: string;
    type: string;
    typeCode: string;
    balance: number;
    monthlyCost: number;
  }>;
  netWorth: number;
  timeline: Array<{
    month: string;
    netWorth: number;
  }>;
}

export interface NetWorthSnapshotsResponse {
  items: Array<{
    id: string;
    snapshotDate: string;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    liquidReserve: number;
    investedAssets: number;
  }>;
}

export interface ReportsResponse {
  cards: Array<{
    id: string;
    title: string;
    summary: string;
    metric: number;
  }>;
  categorySpend: Array<{
    category: string;
    amount: number;
    share: number;
  }>;
  monthlyFlow: Array<{
    month: string;
    income: number;
    expenses: number;
  }>;
  score: {
    overall: number;
    organization: number;
    predictability: number;
    discipline: number;
    protection: number;
    growth: number;
    debt: number;
  } | null;
}

export interface SettingsResponse {
  profile: {
    fullName: string;
    email: string;
    locale: string;
  };
  categories: CategoryItem[];
  integrations: string[];
  fiscalReadiness: {
    deductibleGroups: string[];
    exportMode: string;
  };
  notificationPreferences: {
    emailAlerts: boolean;
    weeklyDigest: boolean;
    dueDateReminders: boolean;
    budgetAlerts: boolean;
    pushEnabled: boolean;
  };
  runtime: {
    stage: string;
    appUrl: string;
    frontendUrl: string;
    corsOrigins: string[];
    session: {
      cookieSecure: boolean;
      sameSite: string;
      cookieDomain: string | null;
      proxyMode: string;
    };
    email: {
      configuredProvider: string;
      resolvedProvider: string;
      fromAddress: string;
      replyTo: string | null;
      canSendRealEmail: boolean;
      canSendTestEmail: boolean;
    };
    monitoring: {
      provider: string;
      enabled: boolean;
      targetLabel: string;
    };
    feedback: {
      inAppEnabled: boolean;
      relayMode: string;
      targetLabel: string;
    };
    warnings: string[];
  };
}

export interface NotificationPreferencesResponse {
  success: boolean;
  message: string;
  preferences: {
    emailAlerts: boolean;
    weeklyDigest: boolean;
    dueDateReminders: boolean;
    budgetAlerts: boolean;
    pushEnabled: boolean;
  };
}

export interface ProfileUpdateResponse {
  success: boolean;
  message: string;
  profile: {
    fullName: string;
    email: string;
    locale: string;
  };
}

export interface PasswordChangeResponse {
  success: boolean;
  message: string;
}

export interface SessionItem {
  id: string;
  isCurrent: boolean;
  userAgent: string | null;
  ipAddress: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface SessionsResponse {
  sessions: SessionItem[];
}

export interface PreferencesResponse {
  success: boolean;
  message: string;
  preferences: {
    currency: string;
    dateFormat: string;
  };
}

export interface AlertItem {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  actionLabel: string | null;
  actionRoute: string | null;
  recommendation: {
    whatHappened: string;
    whyItMatters: string;
    whatToDoNow: string;
    reviewAt: string;
  } | null;
  isRead: boolean;
  triggerDate: string;
  createdAt: string;
}

export interface AlertsResponse {
  items: AlertItem[];
  unreadCount: number;
}

export interface DashboardResponse {
  userName: string;
  referenceMonth: string;
  summary: {
    balanceMonth: number;
    income: number;
    expenses: number;
    leftover: number;
    upcomingBillsAmount: number;
    netWorth: number;
  };
  upcomingBills: Array<{
    id: string;
    description: string;
    dueDate: string;
    amount: number;
  }>;
  goals: Array<{
    id: string;
    name: string;
    currentAmount: number;
    targetAmount: number;
    targetDate: string | null;
  }>;
  onboarding: {
    completedSteps: number;
    totalSteps: number;
    isComplete: boolean;
    steps: Array<{
      id: string;
      title: string;
      description: string;
      done: boolean;
      href: string;
      cta: string;
    }>;
    nextStep: {
      id: string;
      title: string;
      description: string;
      done: boolean;
      href: string;
      cta: string;
    } | null;
    nudge: string;
    dashboardGuide: string[];
  };
  insights: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

export interface AnalyticsSummaryResponse {
  events: Array<{
    name: string;
    label: string;
    count: number;
    lastOccurredAt: string | null;
  }>;
  recentEvents: Array<{
    id: string;
    name: string;
    label: string;
    pagePath: string | null;
    occurredAt: string;
    metadata?: unknown;
  }>;
  onboarding: {
    isStalled: boolean;
    stalledAt: string | null;
    remainingSteps: string[];
  };
}

export interface FeedbackResponse {
  items: Array<{
    id: string;
    category: string;
    categoryCode: string;
    pagePath: string | null;
    status: string;
    statusCode: string;
    message: string;
    createdAt: string;
  }>;
}

function isSerializableBody(value: unknown): value is Record<string, unknown> | unknown[] {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !(value instanceof FormData) &&
    !(value instanceof URLSearchParams) &&
    !(value instanceof Blob) &&
    !(value instanceof ArrayBuffer)
  );
}

export async function apiRequest<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: RequestInit["body"] | Record<string, unknown> | unknown[] }
): Promise<T> {
  const headers = new Headers(init?.headers);
  let body = init?.body;

  if (isSerializableBody(body)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    body,
    headers,
    credentials: "include",
    cache: "no-store"
  });

  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !AUTH_FLOW_PATHS.has(path)) {
      redirectToLoginWithReason("sessao-expirada");
    }

    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Falha ao carregar ${path}.`;
    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export function readApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Sua sessao expirou. Entre novamente para continuar.";
    }

    return error.message;
  }

  if (error instanceof TypeError) {
    return "Nao foi possivel falar com o servidor agora. Tente novamente em instantes.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Erro inesperado ao comunicar com a API.";
}
