"use client";
// 查询我的报失（与 v1 public_my_reports 对齐）：输入报失时的手机号，查看自己的处理进度
// 进度条四节点：已报失 → 已受理 → 已找到 → 已取走
import { Fragment, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/api";

const STEPS = ["已报失", "已受理", "已找到", "已取走"];
// 报失状态 → 进度条当前节点（0起）
const STATUS_STEP: Record<string, number> = {
  待查找: 0,
  已登记: 1,
  待领取: 2,
  已找到: 3,
};

// 四节点进度条：current=当前节点(0起)，之前的节点打勾
function Stepper({ current }: { current: number }) {
  return (
    <div className="mt-3 flex items-start">
      {STEPS.map((label, i) => (
        <Fragment key={label}>
          {i > 0 && <div className={`mx-1 mt-3 h-0.5 flex-1 ${i <= current ? "bg-brand" : "bg-slate-200"}`} />}
          <div className="flex flex-col items-center">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              i < current ? "bg-brand text-white"
              : i === current ? "bg-brand text-white ring-4 ring-brand-light"
              : "bg-slate-200 text-slate-400"
            }`}>{i < current ? "✓" : i + 1}</div>
            <div className={`mt-1 whitespace-nowrap text-[11px] ${
              i === current ? "font-bold text-brand-dark"
              : i < current ? "font-medium text-slate-600"
              : "text-slate-400"
            }`}>{label}</div>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

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
            {reports.map((r) => {
              const step = STATUS_STEP[r.status];
              const ignored = r.status === "已忽略";
              return (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[15px] font-semibold">{r.itemName}</div>
                    <span className="text-[12px] text-slate-400">报失:{r.createdAt}</span>
                  </div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    {r.itemCategory && <span>类别:{r.itemCategory}　</span>}
                    {r.lostLocation && <span>丢失地点:{r.lostLocation}</span>}
                  </div>

                  {ignored ? (
                    <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-[13px] leading-relaxed text-slate-500">
                      该报失暂未匹配到物品。如后续有线索，可直接到门诊导医台询问。
                      {r.note && <div className="mt-1 text-slate-400">💬 {r.note}</div>}
                    </div>
                  ) : (
                    <>
                      <Stepper current={step} />
                      {/* 各节点的说明文案 */}
                      {step === 0 && (
                        <div className="mt-2.5 rounded-lg bg-brand-light px-3 py-2 text-[13px] text-brand-dark">
                          已收到您的报失，导医正在帮您留意，请耐心等待。
                        </div>
                      )}
                      {step === 1 && (
                        <div className="mt-2.5 rounded-lg bg-brand-light px-3 py-2 text-[13px] text-brand-dark">
                          我们知道您丢东西啦，请耐心等待，找到会第一时间在这里通知您哦 🌷
                        </div>
                      )}
                      {r.status === "待领取" && (
                        <div className="mt-2.5 rounded-lg bg-green-50 px-3 py-2.5 text-[13px] leading-relaxed text-green-700">
                          🌷 您好，物品已找到啦！请本人携带有效证件尽快到门诊导医台核对认领。
                          {r.note && <div className="mt-1">👩‍⚕️护士小姐姐留言:{r.note}</div>}
                        </div>
                      )}
                      {r.status === "已找到" && (
                        <div className="mt-2.5 rounded-lg bg-green-50 px-3 py-2 text-[13px] leading-relaxed text-green-700">
                          ✅ 流程已完成：物品已被您或家属取走。感谢使用失物招领服务！
                          {r.note && <div className="mt-1">👩‍⚕️护士小姐姐留言:{r.note}</div>}
                        </div>
                      )}
                      {r.status !== "待领取" && r.status !== "已找到" && r.note && (
                        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-600">
                          👩‍⚕️护士小姐姐留言:{r.note}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
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
