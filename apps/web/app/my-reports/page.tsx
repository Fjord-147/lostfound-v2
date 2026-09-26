"use client";
// 查询我的报失（与 v1 public_my_reports 对齐）：输入报失时的手机号，查看自己的处理进度
import { useState } from "react";
import Link from "next/link";
import { API } from "@/lib/api";

const STATUS_STYLE: Record<string, string> = {
  待查找: "tag-pending",
  已登记: "tag-source",
  已找到: "tag-returned",
  已忽略: "tag-pending",
};

export default function MyReportsPage() {
  const [phone, setPhone] = useState("");
  const [reports, setReports] = useState<any[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function query(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/public/my-reports`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const d = await res.json();
      if (d.ok) setReports(d.reports);
      else setErr(d.msg || "查询失败，请稍后重试");
    } catch {
      setErr("网络异常，请检查网络后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-3 pb-8">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-20 -mx-3 mb-1 flex items-center gap-2 bg-gradient-to-r from-brand to-brand-dark px-3 py-2.5 text-white shadow">
        <Link href="/" className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs no-underline">← 返回</Link>
        <div className="truncate text-[15px] font-semibold">🏥 苏州和康中医医院 · 失物招领</div>
      </nav>

      <div className="py-4 text-center">
        <h1 className="text-xl font-bold text-brand-dark sm:text-2xl">📋 查询我的报失</h1>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">
          输入报失时填写的手机号，即可查看您的报失处理进度
        </p>
      </div>

      <form onSubmit={query} className="mb-4 flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="报失时填写的手机号"
          inputMode="tel"
          required
          className="inp flex-1"
        />
        <button type="submit" disabled={busy} className="btn shrink-0">
          {busy ? "查询中…" : "查询"}
        </button>
      </form>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-600">{err}</div>
      )}

      {/* 隐私说明 */}
      <div className="mb-4 rounded-xl border border-dashed border-brand bg-brand-light px-4 py-3 text-center text-[13px] leading-relaxed text-slate-500">
        🔒 为保护隐私，这里只显示您自己报失的处理进度，不展示任何其他人的信息。
      </div>

      {/* 查询结果 */}
      {reports !== null && (
        reports.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center">
            <div className="mb-2 text-4xl">🔍</div>
            <div className="text-[15px] font-medium text-slate-600">没有找到该手机号对应的报失记录</div>
            <div className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
              如果是刚提交的，请稍后再查；也可以直接到门诊导医台询问。
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[15px] font-semibold">{r.itemName}</div>
                  <span className={`tag ${STATUS_STYLE[r.status] || "tag-pending"}`}>{r.status}</span>
                </div>
                <div className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  {r.itemCategory && <span>类别:{r.itemCategory}　</span>}
                  {r.lostLocation && <span>丢失地点:{r.lostLocation}</span>}
                </div>
                <div className="mt-1 text-[12px] text-slate-400">报失时间:{r.createdAt}</div>
                {r.note && (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-600">
                    💬 {r.note}
                  </div>
                )}
                {r.status === "已找到" && (
                  <div className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-[13px] text-green-700">
                    🎉 物品已找到！请本人携带有效证件到门诊导医台核对认领。
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        苏州和康中医医院 · 导医台失物招领服务<br />
        捡到物品请交到导医台 · 认领请本人到场核对
      </footer>
    </div>
  );
}
