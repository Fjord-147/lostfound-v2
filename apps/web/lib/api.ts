// API 客户端：fetch 封装（cookie 自动带上）
export const API =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

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
