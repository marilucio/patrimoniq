DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ProductEventName'
      AND pg_get_userbyid(typowner) = current_user
  ) THEN
    ALTER TYPE "ProductEventName" ADD VALUE IF NOT EXISTS 'ONBOARDING_COMPLETED';
    ALTER TYPE "ProductEventName" ADD VALUE IF NOT EXISTS 'PROFILE_UPDATED';
    ALTER TYPE "ProductEventName" ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGED';
    ALTER TYPE "ProductEventName" ADD VALUE IF NOT EXISTS 'SESSIONS_REVOKED';
    ALTER TYPE "ProductEventName" ADD VALUE IF NOT EXISTS 'PREFERENCES_CHANGED';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationDeliveryChannel') THEN
    CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('EMAIL', 'PUSH', 'INTERNAL');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationEventType') THEN
    CREATE TYPE "NotificationEventType" AS ENUM (
      'BILL_DUE',
      'BILL_OVERDUE',
      'BUDGET_NEAR_LIMIT',
      'BUDGET_EXCEEDED',
      'WEEKLY_DIGEST'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationDispatchStatus') THEN
    CREATE TYPE "NotificationDispatchStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "userId" TEXT NOT NULL,
  "emailAlerts" BOOLEAN NOT NULL DEFAULT true,
  "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
  "dueDateReminders" BOOLEAN NOT NULL DEFAULT true,
  "budgetAlerts" BOOLEAN NOT NULL DEFAULT true,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE IF NOT EXISTS "NotificationDispatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "channel" "NotificationDeliveryChannel" NOT NULL,
  "eventType" "NotificationEventType" NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "status" "NotificationDispatchStatus" NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDispatch_dedupeKey_key" ON "NotificationDispatch"("dedupeKey");
CREATE INDEX IF NOT EXISTS "NotificationDispatch_userId_channel_eventType_createdAt_idx"
  ON "NotificationDispatch"("userId", "channel", "eventType", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'NotificationPreference_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'NotificationDispatch_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationDispatch"
    ADD CONSTRAINT "NotificationDispatch_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;
