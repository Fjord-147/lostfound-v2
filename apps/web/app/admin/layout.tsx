"use client";
// 管理端框架：桌面左侧边栏 + 手机底部导航 + 报失角标轮询 + 会话恢复
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ToastHost } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "工作台", icon: "🏠" },
  { href: "/admin/items", label: "失物总表", icon: "📋" },
  { href: "/admin/claims", label: "认领管理", icon: "✅" },
  { href: "/admin/reports", label: "报失处理", icon: "📬" },
  { href: "/admin/stats", label: "统计导出", icon: "📊" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [badge, setBadge] = useState(0);

  useEffect(() => {
    api("/api/auth/me").then((d) => {
      if (d.ok) setMe(d.user);
      else router.push("/login");
    });
  }, [router]);

  // 报失角标：每分钟轮询
  useEffect(() => {
    let alive = true;
    const tick = () =>
      api("/api/reports/pending-count").then((d) => {
        if (alive && d.ok) setBadge(d.count);
      }).catch(() => {});
    tick();
    const t = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <ToastHost />

      {/* 桌面侧边栏 */}
      <aside className="hidden w-[190px] shrink-0 flex-col bg-gradient-to-b from-brand to-brand-dark text-white md:flex md:sticky md:top-0 md:h-screen">
        <div className="border-b border-white/15 bg-black/10 px-3 py-4 text-center">
          <div className="text-3xl">🏥</div>
          <div className="mt-1.5 text-[15px] font-bold leading-tight">苏州和康中医医院</div>
          <div className="mt-0.5 text-[11px] text-amber-400">失物招领管理系统</div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`relative flex items-center gap-3 rounded-md px-4 py-3 text-[15px] transition ${
                pathname === n.href
                  ? "border-l-4 border-amber-400 bg-white/25 font-semibold"
                  : "border-l-4 border-transparent text-white/85 hover:bg-white/10"
              }`}
            >
              <span className="text-lg">{n.icon}</span>
              <span>{n.label}</span>
              {n.href === "/reports" && badge > 0 && (
                <span className="badge-pulse ml-auto min-w-[20px] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[11px] font-bold shadow">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/15 px-4 py-3 text-[13px]">
          <div className="mb-1 text-white/60">当前</div>
          <div className="text-[15px] font-semibold">{me?.name || "..."}</div>
          <button onClick={logout} className="mt-2 text-white/80 hover:text-white">
            退出登录
          </button>
        </div>
      </aside>

      {/* 内容区 */}
      <main className="flex-1 pb-16 md:pb-0 md:min-w-0">
        <div className="mx-auto max-w-6xl p-4 md:p-6">{children}</div>
      </main>

      {/* 手机底部导航 */}
      <nav className="fixed bottom-0 left-0 right-0 z-[100] flex h-14 items-stretch bg-brand shadow-[0_-2px_8px_rgba(0,0,0,.15)] md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
              pathname === n.href ? "bg-white/20 font-semibold" : "text-white/85"
            }`}
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
            {n.href === "/reports" && badge > 0 && (
              <span className="absolute right-3 top-1 min-w-[16px] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </div>
  );
}
