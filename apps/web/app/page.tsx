"use client";
// 公众首页（半盲）：马赛克照片 + 脱敏名称 + 旬日期 + 隐私说明 + 报失入口
import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/api";
import { CATEGORIES } from "@/lib/types";

export default function PublicHome() {
  const [items, setItems] = useState<any[]>([]);
  const [cat, setCat] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    fetch(`${API}/api/public/items${cat ? `?category=${encodeURIComponent(cat)}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setItems(d.items);
        else setError(true);
      })
      .catch(() => setError(true));
  }, [cat]);

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-3 pb-8">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-20 -mx-3 mb-1 flex items-center bg-gradient-to-r from-brand to-brand-dark px-3 py-2.5 text-white shadow">
        <div className="truncate text-[15px] font-semibold">🏥 苏州和康中医医院 · 失物招领</div>
        <Link href="/login" className="ml-auto shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs no-underline">管理员入口 →</Link>
      </nav>

      {/* 标题 */}
      <div className="py-4 text-center">
        <h1 className="text-xl font-bold text-brand-dark sm:text-2xl">失物招领</h1>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">
          和康中医医院捡到的物品在此展示，看到您丢失的请到<strong>导医台</strong>核对认领
        </p>
      </div>

      {/* 两大入口 */}
      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <button onClick={() => { setCat(""); document.getElementById("list")?.scrollIntoView({ behavior: "smooth" }); }} className="flex items-center gap-2.5 rounded-xl border-2 border-sky-200 bg-gradient-to-br from-brand-light to-cyan-100 p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-lg sm:gap-3.5 sm:p-4">
          <span className="text-3xl">🔍</span>
          <span>
            <span className="block text-[15px] font-bold text-brand-dark sm:text-[17px]">我丢了东西</span>
            <span className="block text-xs text-slate-500">看看有没有被捡到</span>
          </span>
        </button>
        <Link href="/report" className="flex items-center gap-2.5 rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100 p-3.5 no-underline transition hover:-translate-y-0.5 hover:shadow-lg sm:gap-3.5 sm:p-4">
          <span className="text-3xl">📝</span>
          <span>
            <span className="block text-[15px] font-bold text-orange-700 sm:text-[17px]">没找到 / 我捡到</span>
            <span className="block text-xs text-slate-500">登记报失，等通知</span>
          </span>
        </Link>
      </div>

      {/* 类别筛选 */}
      <div id="list" className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
        <button onClick={() => setCat("")}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${!cat ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-500"}`}>全部</button>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm ${cat === c ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-500"}`}>{c}</button>
        ))}
      </div>

      {/* 半盲卡片 */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-600">
          网络异常，无法加载失物列表<br />
          <button onClick={() => location.reload()} className="mt-2 rounded-lg border border-red-300 bg-white px-4 py-2">刷新重试</button>
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((it) => (
            <div key={it.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="aspect-square w-full bg-slate-100">
                {it.hasPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`${API}/api/public/photo/${it.id}?v=mosaic2`} alt="物品照片（马赛克）" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-5xl opacity-60">{it.icon}</div>
                )}
              </div>
              <div className="p-2.5">
                <div className="truncate text-[15px] font-semibold">{it.safeName}</div>
                <div className="mt-0.5"><span className="tag tag-pending">待认领</span></div>
                <div className="mt-0.5 text-[11px] text-slate-400">{it.rough}捡到</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-slate-400">
          <div className="mb-2 text-5xl">🔍</div>
          目前没有待认领的物品
          <div className="mt-1.5 text-[13px]">如果您丢了东西，可以<Link href="/report" className="text-brand">在这里报失</Link>，我们会留意</div>
        </div>
      )}

      {/* 隐私提示 */}
      {items.length > 0 && (
        <div className="mt-4 rounded-xl border border-dashed border-brand bg-brand-light px-4 py-3 text-center text-[13px] leading-relaxed text-slate-500">
          🔒 为防止冒领，照片已做马赛克处理，名称已隐去颜色等细节。<br />
          如认为是您的物品，请到<strong>导医台</strong>描述特征核对认领。
        </div>
      )}

      <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        苏州和康中医医院 · 导医台失物招领服务<br />
        捡到物品请交到导医台 · 认领请本人到场核对
      </footer>
    </div>
  );
}
