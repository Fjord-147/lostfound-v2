"use client";
// 公众首页：只保留两个动作——登记报失 / 查询进度（2026-10-09 起不再公示物品清单，
// 避免暴露医院库存给冒领者可乘之机；大厅公示屏若将来需要可复用 /api/public/items）
import Link from "next/link";

export default function PublicHome() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-3 pb-8">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-20 -mx-3 mb-1 flex items-center bg-gradient-to-r from-brand to-brand-dark px-3 py-2.5 text-white shadow">
        <div className="truncate text-[15px] font-semibold">🏥 苏州和康中医医院 · 失物招领</div>
        <Link href="/login" className="ml-auto shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs no-underline">管理员入口 →</Link>
      </nav>

      {/* 标题 */}
      <div className="py-6 text-center">
        <h1 className="text-2xl font-bold text-brand-dark">失物招领</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">
          丢了东西请登记报失，导医会帮您留意<br />
          找到后会在这里通知您来认领
        </p>
      </div>

      {/* 两大动作 */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/report" className="flex items-center gap-3 rounded-xl border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-100 p-5 no-underline transition hover:-translate-y-0.5 hover:shadow-lg">
          <span className="text-4xl">📝</span>
          <span>
            <span className="block text-[17px] font-bold text-orange-700">东西丢了？登记报失</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">填写丢失物品信息，<br />我们帮您留意</span>
          </span>
        </Link>
        <Link href="/my-reports" className="flex items-center gap-3 rounded-xl border-2 border-sky-200 bg-gradient-to-br from-brand-light to-cyan-100 p-5 no-underline transition hover:-translate-y-0.5 hover:shadow-lg">
          <span className="text-4xl">🔎</span>
          <span>
            <span className="block text-[17px] font-bold text-brand-dark">查询我的报失</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">输入报失时的手机号，<br />查看处理进度</span>
          </span>
        </Link>
      </div>

      {/* 捡到物品引导 */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-[14px] leading-relaxed text-slate-600">
        🤲 <strong>捡到了东西？</strong>请直接交到<strong>门诊导医台</strong>，由导医登记入库。
        无需网上登记——网上入口只面向失主。
      </div>

      {/* 流程说明 */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-[15px] font-bold text-brand-dark">🔁 找回流程</div>
        <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-slate-600">
          <li>登记报失：描述物品特征，越详细越好</li>
          <li>等待通知：找到后「查询我的报失」会显示进度</li>
          <li>到场认领：本人带有效证件到导医台，描述特征核对后取回</li>
        </ol>
      </div>

      {/* 隐私说明 */}
      <div className="rounded-xl border border-dashed border-brand bg-brand-light px-4 py-3 text-center text-[13px] leading-relaxed text-slate-500">
        🔒 为保护失主权益、防止冒领，本院拾获物品清单不对外公示。<br />
        认领时以您报失时填写的特征描述作为核对依据。
      </div>

      <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        苏州和康中医医院 · 导医台失物招领服务<br />
        捡到物品请交到导医台 · 认领请本人到场核对<br />
        <Link href="/help" className="text-brand">使用帮助</Link>
      </footer>
    </div>
  );
}
