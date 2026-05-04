-- PR 6: Project token reserve policy hardening
CREATE TYPE "ProjectTokenReservePolicy" AS ENUM (
  'HOLD_LOCKED',
  'BURN_FUTURE',
  'EVENT_REWARD_FUTURE',
  'CONTROLLED_REOFFER_FUTURE'
);

ALTER TABLE "ProjectTokenReserve"
  ADD COLUMN "policy" "ProjectTokenReservePolicy" NOT NULL DEFAULT 'HOLD_LOCKED',
  ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "lastAuditAt" TIMESTAMP(3);
