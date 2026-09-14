// 公众端脱敏：名称去特征词 + 旬日期（移植自 v1）

const NAME_STRIP_WORDS = [
  "黑色", "白色", "红色", "蓝色", "绿色", "黄色", "灰色", "粉色", "紫色",
  "棕色", "橙色", "银色", "金色", "褐色", "深色", "浅色", "花色", "彩色", "黑白",
  "透明", "全新", "新款", "旧款", "破旧", "一只", "一个", "一张", "一把", "一部",
];

/** '白色帽子' → '帽子'；删空退回类别 */
export function sanitizeName(name: string | null, category: string | null): string {
  let s = (name || "").trim();
  for (const w of NAME_STRIP_WORDS) s = s.split(w).join("");
  s = s.replace(/^[\s\-_/、，,。.]+|[\s\-_/、，,。.]+$/g, "");
  return s || category || "物品";
}

/** '2026-08-24 14:30' → '8月下旬' */
export function roughDate(s: string | null | undefined): string {
  if (!s) return "";
  const m = String(s).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return "";
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const xun = d <= 10 ? "上" : d <= 20 ? "中" : "下";
  return `${mo}月${xun}旬`;
}

/** 多格式日期归一化：2026/7/12、2026-7-12、20260712 → 2026-07-12 */
export function normDate(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const cleaned = t.replace(/\//g, "-");
  let m = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    const [_, y, mo, d] = m;
    return `${y}-${mo}-${d}`;
  }
  return t;
}
