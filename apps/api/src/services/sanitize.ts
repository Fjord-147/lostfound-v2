// 公众端脱敏：名称去特征词 + 旬日期（移植自 v1）

const NAME_STRIP_WORDS = [
  "黑色", "白色", "红色", "蓝色", "绿色", "黄色", "灰色", "粉色", "紫色",
  "棕色", "橙色", "银色", "金色", "褐色", "深色", "浅色", "花色", "彩色", "黑白",
  "透明", "全新", "新款", "旧款", "破旧", "一只", "一个", "一张", "一把", "一部",
];

// 单字颜色（覆盖"蓝柄雨伞"这类单字颜色场景）
const SINGLE_COLORS = ["黑", "白", "红", "蓝", "绿", "黄", "灰", "紫", "银", "粉", "棕", "橙", "金"];

// 保护词：含颜色字但颜色并非其含义的常用词，脱除前占位保护，避免误伤
const PROTECT_WORDS = [
  "口红", "红包", "红木", "红薯",
  "黄金", "白金", "铂金", "金丝", "金额", "基金", "现金",
  "粉丝", "粉条",
  "花生", "花露水", "花瓶", "花洒",
  "橙子", "橙汁",
  "紫菜",
  "银杏", "白银",
];

/** '白色帽子'→'帽子'；'蓝柄雨伞'→'雨伞'；
 *  保护词不受伤：'口红'→'口红'（不会变'口'）。
 *  删空退回类别。 */
export function sanitizeName(name: string | null, category: string | null): string {
  let s = (name || "").trim();
  // 1) 双字特征词
  for (const w of NAME_STRIP_WORDS) s = s.split(w).join("");
  // 2) 保护词占位
  const held: string[] = [];
  for (const p of PROTECT_WORDS) {
    while (s.includes(p)) {
      held.push(p);
      s = s.replace(p, `\x00${held.length - 1}\x00`);
    }
  }
  // 3) 单字颜色脱除
  for (const c of SINGLE_COLORS) s = s.split(c).join("");
  // 4) 还原保护词
  s = s.replace(/\x00(\d+)\x00/g, (_m, i) => held[Number(i)] ?? "");
  // 5) 清理两端残留分隔符
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
