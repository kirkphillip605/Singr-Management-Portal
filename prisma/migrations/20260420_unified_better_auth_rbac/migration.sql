-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "ban_expires" TIMESTAMPTZ(6),
ADD COLUMN     "ban_reason" TEXT,
ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "display_name" TEXT,
ADD COLUMN     "last_login_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_login_method" TEXT,
ADD COLUMN     "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stripe_customer_id" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" TEXT,
    "surface" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ba_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "period_start" TIMESTAMPTZ(6),
    "period_end" TIMESTAMPTZ(6),
    "cancel_at_period_end" BOOLEAN,
    "seats" INTEGER,
    "trial_start" TIMESTAMPTZ(6),
    "trial_end" TIMESTAMPTZ(6),

    CONSTRAINT "ba_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ba_subscriptions_stripe_subscription_id_key" ON "ba_subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "ba_subscriptions_reference_id_idx" ON "ba_subscriptions"("reference_id");

-- CreateIndex
CREATE INDEX "ba_subscriptions_stripe_customer_id_idx" ON "ba_subscriptions"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

