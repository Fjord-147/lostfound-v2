-- 认领人自述特征（防冒领留痕）：新认领必填≥10字；历史数据为 NULL 不受影响
ALTER TABLE "items" ADD COLUMN "claimer_note" TEXT;
