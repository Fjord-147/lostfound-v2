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
  let res: Response;
  try {
    res = await fetch(API + path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
  } catch {
    // 网络层失败（断网/跨域拦截/服务器宕机）——统一兜底，不让页面卡死
    return { ok: false, msg: "网络异常，请检查网络后重试" } as T;
  }
  // Excel 下载等二进制
  if (res.headers.get("content-disposition")) {
    return res as any;
  }
  const data = await res.json().catch(() => ({ ok: false, msg: "响应解析失败" }));
  if (!res.ok && res.status === 401 && typeof window !== "undefined") {
    // 会话过期 → 跳登录；但登录请求本身的 401（密码错误）交给登录页显示错误，不跳转
    const isLoginReq = path.includes("/api/auth/login");
    if (!isLoginReq && !location.pathname.startsWith("/report") && !location.pathname.startsWith("/login")) {
      location.href = "/login";
    }
  }
  return data as T;
}

// 文件上传（FormData 不能设 Content-Type）；兼容 File 或 Blob（自动带文件名）
export async function uploadFiles(files: (File | Blob)[], prefix = "cam"): Promise<string[]> {
  const fd = new FormData();
  files.forEach((f, i) => {
    const name = f instanceof File ? f.name : `${prefix}_${i}.jpg`;
    fd.append("photo", f, name);
  });
  const res = await fetch(API + "/api/upload/photo", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.msg || "上传失败");
  return data.filenames || [];
}

// dataUrl → Blob 的兼容实现（不依赖 fetch(dataUrl)，老手机浏览器不支持后者）
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
