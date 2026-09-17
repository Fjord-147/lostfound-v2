// 类型定义 + 常量（与后端 config 对应）
export interface Item {
  id: number;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  photo: string | null; // 逗号分隔
  foundLocation: string | null;
  foundTime: string | null;
  founder: string | null;
  status: string;
  createdAt: string;
  claimerName: string | null;
  claimerPhone: string | null;
  claimerGroup: string | null;
  claimerGender: string | null;
  featureVerified: boolean;
  claimedAt: string | null;
  operator: string | null;
  claimerPhoto: string | null;
  storageLocation: string | null;
  hiddenPhotos: string | null;
  source: string | null;
  registeredBy: string | null;
}

export interface LostReport {
  id: number;
  createdAt: string;
  ownerName: string;
  ownerPhone: string;
  itemName: string;
  itemCategory: string | null;
  description: string | null;
  lostLocation: string | null;
  lostTime: string | null;
  photo: string | null;
  status: string;
  matchedItemId: number | null;
  note: string | null;
  handledBy: string | null;
  handledAt: string | null;
}

export const CATEGORIES = [
  "证件", "钥匙", "手机/电子产品", "钱包",
  "衣物", "病历/检查单", "水杯/雨伞", "其他",
];

export const CATEGORY_ICONS: Record<string, string> = {
  证件: "🪪", 钥匙: "🔑", "手机/电子产品": "📱", 钱包: "👛",
  衣物: "👕", "病历/检查单": "📄", "水杯/雨伞": "☂️", 其他: "📦",
};

// 卡片类别浅色（延续 v1）
export const CATEGORY_STYLE: Record<string, { bg: string; border: string }> = {
  证件: { bg: "#fdedee", border: "#f5c2c7" },
  钱包: { bg: "#fdedee", border: "#f5c2c7" },
  "手机/电子产品": { bg: "#ecedf0", border: "#cfd2d8" },
  钥匙: { bg: "#ecedf0", border: "#cfd2d8" },
  "病历/检查单": { bg: "#f6f6f4", border: "#e0e0dc" },
  衣物: { bg: "#e7f0fe", border: "#c2dbf7" },
  "水杯/雨伞": { bg: "#e9f5ea", border: "#c6e3c9" },
  其他: { bg: "#f3f4f6", border: "#d9dde3" },
};

export const LOCATIONS = [
  "一楼导诊台", "一楼大厅", "二楼检验科", "二楼候诊区", "三楼诊室",
  "挂号收费处", "药房", "卫生间", "停车场", "其他",
];

export function photosOf(item: { photo: string | null }): string[] {
  return (item.photo || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function nowLocalStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 展示用：'2026-09-17T20:55' → '2026-09-17 20:55'（去T，供列表/卡片/详情渲染） */
export function fmtDT(s?: string | null): string {
  return s ? s.replace("T", " ") : "";
}
