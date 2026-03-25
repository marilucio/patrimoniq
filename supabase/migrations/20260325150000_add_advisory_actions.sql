DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'AdvisoryActionStatus'
  ) THEN
    CREATE TYPE "AdvisoryActionStatus" AS ENUM (
      'SUGGESTED',
      'VIEWED',
      'COMPLETED',
      'POSTPONED',
      'DISMISSED',
      'EXPIRED'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "AdvisoryAction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceRef" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "priority" INTEGER NOT NULL,
  "status" "AdvisoryActionStatus" NOT NULL DEFAULT 'SUGGESTED',
  "suggestionTone" TEXT NOT NULL DEFAULT 'objetivo',
  "dueDate" TIMESTAMP(3),
  "postponedUntil" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "feedback" TEXT,
  "impactSummary" TEXT,
  "impactScore" INTEGER,
  "financialContext" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdvisoryAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisoryActionEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "advisoryActionId" TEXT NOT NULL,
  "fromStatus" "AdvisoryActionStatus",
  "toStatus" "AdvisoryActionStatus" NOT NULL,
  "note" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdvisoryActionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdvisoryAction_userId_sourceRef_key"
  ON "AdvisoryAction"("userId", "sourceRef");
CREATE INDEX IF NOT EXISTS "AdvisoryAction_userId_status_priority_idx"
  ON "AdvisoryAction"("userId", "status", "priority");
CREATE INDEX IF NOT EXISTS "AdvisoryAction_userId_type_createdAt_idx"
  ON "AdvisoryAction"("userId", "type", "createdAt");

CREATE INDEX IF NOT EXISTS "AdvisoryActionEvent_userId_toStatus_occurredAt_idx"
  ON "AdvisoryActionEvent"("userId", "toStatus", "occurredAt");
CREATE INDEX IF NOT EXISTS "AdvisoryActionEvent_advisoryActionId_occurredAt_idx"
  ON "AdvisoryActionEvent"("advisoryActionId", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AdvisoryAction_userId_fkey'
  ) THEN
    ALTER TABLE "AdvisoryAction"
    ADD CONSTRAINT "AdvisoryAction_userId_fkey"
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
    WHERE conname = 'AdvisoryActionEvent_userId_fkey'
  ) THEN
    ALTER TABLE "AdvisoryActionEvent"
    ADD CONSTRAINT "AdvisoryActionEvent_userId_fkey"
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
    WHERE conname = 'AdvisoryActionEvent_advisoryActionId_fkey'
  ) THEN
    ALTER TABLE "AdvisoryActionEvent"
    ADD CONSTRAINT "AdvisoryActionEvent_advisoryActionId_fkey"
    FOREIGN KEY ("advisoryActionId") REFERENCES "AdvisoryAction"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;
