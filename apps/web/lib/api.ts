// API 客户端：fetch 封装（cookie 自动带上）
// 基址解析顺序：
//  1) build 时设 NEXT_PUBLIC_API_SAME_ORIGIN=1 → 同源相对路径（生产 nginx 同域反代用）
//  2) NEXT_PUBLIC_API_BASE 显式指定
//  3) 开发：动态跟随页面主机名+8000，避免 127.0.0.1/localhost 跨站 cookie 丢失
function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_SAME_ORIGIN === "1") return "";
  if (process.env.NEXT_PUBLIC_API_BASE) return process.env.NEXT_PUBLIC_API_BASE;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://localhost:8000"; // SSR 兜底
}
export const API = resolveApiBase();

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  // Excel 下载等二进制
  if (res.headers.get("content-disposition")) {
    return res as any;
  }
  const data = await res.json().catch(() => ({ ok: false, msg: "响应解析失败" }));
  if (!res.ok && res.status === 401 && typeof window !== "undefined") {
    // 未登录 → 跳登录（公众页面除外）
    if (!location.pathname.startsWith("/report")) {
      location.href = "/login";
    }
  }
  return data as T;
}

// 文件上传（FormData 不能设 Content-Type）
export async function uploadFiles(files: File[]): Promise<string[]> {
  const fd = new FormData();
  for (const f of files) fd.append("photo", f);
  const res = await fetch(API + "/api/upload/photo", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const data = await res.json();
  return data.filenames || [];
}
