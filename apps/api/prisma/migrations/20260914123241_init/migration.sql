-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "photo" TEXT,
    "found_location" TEXT,
    "found_time" TEXT,
    "founder" TEXT,
    "status" TEXT NOT NULL DEFAULT '待认领',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimer_name" TEXT,
    "claimer_phone" TEXT,
    "feature_verified" BOOLEAN NOT NULL DEFAULT false,
    "claimed_at" TEXT,
    "operator" TEXT,
    "claimer_photo" TEXT,
    "claimer_group" TEXT,
    "claimer_gender" TEXT,
    "storage_location" TEXT,
    "hidden_photos" TEXT,
    "source" TEXT,
    "registered_by" TEXT,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_reports" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owner_name" TEXT NOT NULL,
    "owner_phone" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "item_category" TEXT,
    "description" TEXT,
    "lost_location" TEXT,
    "lost_time" TEXT,
    "photo" TEXT,
    "status" TEXT NOT NULL DEFAULT '待查找',
    "matched_item_id" INTEGER,
    "note" TEXT,
    "handled_by" TEXT,
    "handled_at" TEXT,

    CONSTRAINT "lost_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "operator" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");

-- CreateIndex
CREATE INDEX "items_status_idx" ON "items"("status");

-- CreateIndex
CREATE INDEX "items_created_at_idx" ON "items"("created_at");

-- CreateIndex
CREATE INDEX "lost_reports_status_idx" ON "lost_reports"("status");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");
