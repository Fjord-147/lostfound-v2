"use client";
// 公众使用帮助：患者/失主/拾物者/导医的完整流程说明（来自 v1 /help）
import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-3 pb-8">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-20 -mx-3 mb-1 flex items-center bg-gradient-to-r from-brand to-brand-dark px-3 py-2.5 text-white shadow">
        <Link href="/" className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs no-underline">← 返回首页</Link>
        <div className="ml-auto truncate text-[15px] font-semibold">使用帮助</div>
      </nav>

      <div className="py-4 text-center">
        <h1 className="text-xl font-bold text-brand-dark sm:text-2xl">❓ 使用帮助</h1>
        <p className="mt-1 text-[13px] text-slate-500">失物招领的完整流程，按您的角色查看</p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-[16px] font-bold text-brand-dark">🙋 我是失主（丢了东西）</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-600">
          <li><strong>先找：</strong>在<Link href="/" className="text-brand">失物招领首页</Link>浏览「待认领」物品（照片已马赛克、名称已隐去细节，防冒领）。</li>
          <li><strong>没找到？</strong>点「没找到 / 我捡到」<Link href="/report" className="text-brand">登记报失</Link>，越详细越好（特征、时间、地点）。</li>
          <li><strong>查进度：</strong>在<Link href="/my-reports" className="text-brand">查询我的报失</Link>输入报失时的手机号，随时查看处理状态。</li>
          <li><strong>去认领：</strong>看到状态变「已找到」后，<strong>本人带有效证件</strong>到门诊导医台，描述物品特征核对无误后归还。</li>
        </ol>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-[16px] font-bold text-brand-dark">🤲 我捡到了东西</h2>
        <p className="text-[14px] leading-relaxed text-slate-600">
          请直接交到<strong>门诊导医台</strong>，由导医登记入库（拍照、编号、上架公示）。<br />
          捡到物品<strong>无需在网上登记</strong>——网上报失入口只面向失主。
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-[16px] font-bold text-brand-dark">🏥 我是导医 / 管理员</h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-slate-600">
          <li>公众页右上角「管理员入口」登录（账号由信息科发放）。</li>
          <li><strong>拾物登记</strong>：工作台或「失物总表」页录入物品 + 照片，自动生成编号。</li>
          <li><strong>认领登记</strong>：失主到场描述特征 → 勾选「已核对物品特征」→ 录入认领人信息 → 状态变「已认领」。</li>
          <li><strong>报失处理</strong>：处理公众报失，可「登记入总表」或「已找到」一步到位，处理进度失主可自助查询。</li>
          <li><strong>统计导出</strong>：按时间段统计，一键导出 Excel 留档。</li>
        </ol>
      </div>

      <div className="rounded-xl border border-dashed border-brand bg-brand-light px-4 py-3 text-center text-[13px] leading-relaxed text-slate-500">
        🔒 隐私说明：认领人姓名/电话、报失人信息仅管理员可见；公众端照片一律马赛克处理，已认领物品自动下架。
      </div>

      <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        苏州和康中医医院 · 导医台失物招领服务
      </footer>
    </div>
  );
}
