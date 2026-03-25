CREATE TABLE IF NOT EXISTS "EngagementMetric" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "source" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EngagementMetric_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EngagementMetric_userId_source_occurredAt_idx"
  ON "EngagementMetric"("userId", "source", "occurredAt");
CREATE INDEX IF NOT EXISTS "EngagementMetric_eventName_occurredAt_idx"
  ON "EngagementMetric"("eventName", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EngagementMetric_userId_fkey'
  ) THEN
    ALTER TABLE "EngagementMetric"
    ADD CONSTRAINT "EngagementMetric_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END
$$;
