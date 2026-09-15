"use client";
// 统计导出 + 审计日志
import { useCallback, useEffect, useState } from "react";
import { API, api } from "@/lib/api";

// ISO(UTC) → 本地时间 "YYYY-MM-DD HH:mm:ss"
function fmtLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function StatsPage() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const [dateFrom, setDateFrom] = useState(`${d.getFullYear()}-${p(d.getMonth() + 1)}-01`);
  const [dateTo, setDateTo] = useState(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  const [stats, setStats] = useState<any>({});
  const [byCategory, setByCategory] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  const load = useCallback(() => {
    api(`/api/stats/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`).then((r) => {
      if (r.ok) { setStats(r.stats); setByCategory(r.byCategory); }
    });
  }, [dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api("/api/stats/audit?take=50").then((r) => r.ok && setLogs(r.logs));
  }, []);

  function exportUrl(all: boolean) {
    return all
      ? `${API}/api/stats/export`
      : `${API}/api/stats/export?dateFrom=${dateFrom}&dateTo=${dateTo}`;
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold">📊 统计导出</h1>
      <p className="mb-4 text-sm text-slate-500">按时间段统计，一键导出 Excel</p>

      <div className="card mb-5 flex flex-wrap items-center gap-2 p-4">
        <span className="text-sm">时间段</span>
        <input type="date" className="inp w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="text-slate-400">至</span>
        <input type="date" className="inp w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <button className="btn btn-outline btn-sm" onClick={load}>统计</button>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { n: stats.foundCount ?? 0, l: "登记捡到", c: "border-l-brand", t: "text-brand-dark" },
          { n: stats.returnedCount ?? 0, l: "已归还", c: "border-l-green-500", t: "text-green-600" },
          { n: stats.pendingCount ?? 0, l: "待认领", c: "border-l-orange-400", t: "text-orange-500" },
        ].map((s, i) => (
          <div key={i} className={`card border-l-4 p-5 text-center ${s.c}`}>
            <div className={`text-3xl font-bold tabular-nums ${s.t}`}>{s.n}</div>
            <div className="mt-1 text-sm text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="card mb-5 p-5">
        <h2 className="mb-3 font-semibold text-brand-dark">按类别统计</h2>
        <table className="w-full text-sm">
          <thead><tr className="bg-brand-light text-left text-brand-dark"><th className="px-3 py-2">类别</th><th className="px-3 py-2">数量</th></tr></thead>
          <tbody>
            {byCategory.map((c) => (
              <tr key={c.category} className="border-t border-slate-100">
                <td className="px-3 py-2">{c.category}</td><td className="px-3 py-2">{c.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {byCategory.length === 0 && <div className="py-6 text-center text-slate-400">该时间段无数据</div>}
      </div>

      <div className="mb-5 flex flex-wrap gap-3">
        <a className="btn no-underline" href={exportUrl(false)}>📥 导出该时间段 Excel</a>
        <a className="btn btn-outline no-underline" href={exportUrl(true)}>📥 导出全部数据</a>
      </div>

      {/* 审计日志 */}
      <div className="card p-5">
        <h2 className="mb-3 font-semibold text-brand-dark">📜 操作审计日志（最近50条）</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-light text-left text-brand-dark">
                <th className="px-3 py-2">时间</th><th className="px-3 py-2">操作人</th><th className="px-3 py-2">操作</th><th className="px-3 py-2">对象</th><th className="px-3 py-2">详情</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtLocal(l.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{l.operator}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{l.action}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{l.entity}{l.entityId ? `#${l.entityId}` : ""}</td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-slate-500">{JSON.stringify(l.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && <div className="py-6 text-center text-slate-400">暂无日志</div>}
        </div>
      </div>
    </div>
  );
}
