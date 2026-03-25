DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductEventName') THEN
    CREATE TYPE "ProductEventName" AS ENUM (
      'REGISTER_COMPLETED',
      'LOGIN_COMPLETED',
      'PASSWORD_RESET_REQUESTED',
      'DASHBOARD_FIRST_VIEWED',
      'FIRST_ACCOUNT_CREATED',
      'FIRST_INCOME_CREATED',
      'FIRST_EXPENSE_CREATED',
      'FIRST_GOAL_CREATED',
      'ONBOARDING_STALLED',
      'FEEDBACK_SUBMITTED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeedbackCategory') THEN
    CREATE TYPE "FeedbackCategory" AS ENUM ('BUG', 'IDEA', 'ONBOARDING', 'UX', 'OTHER');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeedbackStatus') THEN
    CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'REVIEWED', 'ARCHIVED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ProductEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "sessionId" TEXT,
  "name" "ProductEventName" NOT NULL,
  "pagePath" TEXT,
  "dedupeKey" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FeedbackSubmission" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" "FeedbackCategory" NOT NULL DEFAULT 'OTHER',
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
  "pagePath" TEXT,
  "message" TEXT NOT NULL,
  "contactEmail" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FeedbackSubmission_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = 'ProductEvent'
      AND relkind = 'r'
      AND pg_get_userbyid(relowner) = current_user
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "ProductEvent_dedupeKey_key" ON "ProductEvent"("dedupeKey");
    CREATE INDEX IF NOT EXISTS "ProductEvent_userId_name_occurredAt_idx" ON "ProductEvent"("userId", "name", "occurredAt");
    CREATE INDEX IF NOT EXISTS "ProductEvent_name_occurredAt_idx" ON "ProductEvent"("name", "occurredAt");
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = 'FeedbackSubmission'
      AND relkind = 'r'
      AND pg_get_userbyid(relowner) = current_user
  ) THEN
    CREATE INDEX IF NOT EXISTS "FeedbackSubmission_userId_createdAt_idx" ON "FeedbackSubmission"("userId", "createdAt");
    CREATE INDEX IF NOT EXISTS "FeedbackSubmission_status_createdAt_idx" ON "FeedbackSubmission"("status", "createdAt");
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ProductEvent_userId_fkey'
  ) AND EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = 'ProductEvent'
      AND relkind = 'r'
      AND pg_get_userbyid(relowner) = current_user
  ) THEN
    ALTER TABLE "ProductEvent"
    ADD CONSTRAINT "ProductEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FeedbackSubmission_userId_fkey'
  ) AND EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname = 'FeedbackSubmission'
      AND relkind = 'r'
      AND pg_get_userbyid(relowner) = current_user
  ) THEN
    ALTER TABLE "FeedbackSubmission"
    ADD CONSTRAINT "FeedbackSubmission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;
