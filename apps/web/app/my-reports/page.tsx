"use client";
// 失主查询自己的报失处理进度：输入报失时填的手机号即可（来自 v1 /my_reports）
import { useState } from "react";
import Link from "next/link";
import { API } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  待查找: "tag-pending",
  已登记: "tag-source",
  已找到: "tag-returned",
  已忽略: "",
};

export default function MyReportsPage() {
  const [phone, setPhone] = useState("");
  const [reports, setReports] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const p = phone.trim();
    if (!p) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/public/my-reports?phone=${encodeURIComponent(p)}`);
      const d = await r.json();
      if (d.ok) {
        setReports(d.reports);
        setSearched(true);
      } else {
        setError(d.msg || "查询失败，请稍后再试");
      }
    } catch {
      setError("网络异常，请检查网络后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-3 pb-8">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-20 -mx-3 mb-1 flex items-center bg-gradient-to-r from-brand to-brand-dark px-3 py-2.5 text-white shadow">
        <Link href="/" className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs no-underline">← 返回首页</Link>
        <div className="ml-auto truncate text-[15px] font-semibold">查询我的报失</div>
      </nav>

      <div className="py-4 text-center">
        <h1 className="text-xl font-bold text-brand-dark sm:text-2xl">🔎 查询我的报失</h1>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">
          输入您<strong>报失时填写的手机号</strong>，即可查看处理进度
        </p>
      </div>

      <form onSubmit={search} className="card mx-auto mb-5 flex max-w-md gap-2 p-4">
        <input
          className="inp flex-1"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="报失时填写的手机号"
          inputMode="tel"
          autoComplete="tel"
          required
        />
        <button className="btn shrink-0" disabled={loading}>
          {loading ? "查询中..." : "查询"}
        </button>
      </form>

      {error && (
        <div className="mx-auto mb-4 max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">
          {error}
        </div>
      )}

      {searched && !error && (
        <div className="mx-auto max-w-md">
          {reports.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
              该手机号没有报失记录<br />
              <span className="mt-1 inline-block text-[13px]">
                丢东西了？<Link href="/report" className="text-brand">去登记报失 →</Link>
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">{r.itemCategory || "📦"}</span>
                    <span className="font-semibold">{r.itemName}</span>
                    <span className={`tag ${STATUS_STYLE[r.status] || "tag-pending"}`}>{r.status}</span>
                  </div>
                  {r.description && (
                    <div className="mt-1.5 text-[13px] text-slate-500">特征：{r.description}</div>
                  )}
                  {r.lostLocation && (
                    <div className="text-[13px] text-slate-500">丢失地点:{r.lostLocation}</div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-dashed border-slate-100 pt-2 text-xs text-slate-400">
                    <span>报失时间：{r.createdAt || "—"}</span>
                    {r.handledAt && <span>处理时间:{r.handledAt}</span>}
                  </div>
                  {r.note && (
                    <div className="mt-2 rounded-lg bg-brand-light px-3 py-2 text-[13px] text-brand-dark">
                      💬 导医回复:{r.note}
                    </div>
                  )}
                  {r.status === "已找到" && (
                    <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
                      🎉 您的物品已找到！请<strong>本人带有效证件</strong>到门诊导医台核对认领。
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        苏州和康中医医院 · 导医台失物招领服务<br />
        有疑问可到门诊导医台咨询，或查看<Link href="/help" className="text-brand">使用帮助</Link>
      </footer>
    </div>
  );
}
