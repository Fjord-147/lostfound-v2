import path from "path";
import fs from "fs";

const ROOT = path.resolve(__dirname, "../../.."); // monorepo 根
export const UPLOAD_DIR = path.join(ROOT, "uploads");
export const BLUR_DIR = path.join(UPLOAD_DIR, "blur");

export function ensureUploadDirs() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(BLUR_DIR, { recursive: true });
}

// 类别选项（与 v1 一致）
export const CATEGORIES = [
  "证件", "钥匙", "手机/电子产品", "钱包",
  "衣物", "病历/检查单", "水杯/雨伞", "其他",
];

export const CATEGORY_ICONS: Record<string, string> = {
  "证件": "🪪", "钥匙": "🔑", "手机/电子产品": "📱", "钱包": "👛",
  "衣物": "👕", "病历/检查单": "📄", "水杯/雨伞": "☂️", "其他": "📦",
};

export const LOCATIONS = [
  "一楼导诊台", "一楼大厅", "二楼检验科", "二楼候诊区", "三楼诊室",
  "挂号收费处", "药房", "卫生间", "停车场", "其他",
];
