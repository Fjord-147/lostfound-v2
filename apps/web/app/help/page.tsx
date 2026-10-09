"use client";
// 使用帮助（与 v1 public_help 对齐）：失主 / 拾物者 / 导医三种角色的完整流程说明
import Link from "next/link";

const SECTIONS = [
  {
    icon: "🙋",
    title: "我是失主（丢了东西）",
    lines: [
      <>1. 登记报失：点首页「东西丢了？登记报失」，<strong>特征描述越详细越好</strong>（颜色/品牌/内含物）——它是认领时的核对依据。</>,
      <>2. 查进度：在<Link href="/my-reports" className="text-brand">查询我的报失</Link>输入报失时的手机号，随时查看进度（已报失→已受理→已找到→已取走）。</>,
      <>3. 去认领：进度显示「已找到」后，<strong>本人带有效证件</strong>到门诊导医台，描述物品特征核对无误后归还。</>,
      <>💡 为防止冒领，本院拾获物品清单不对外公示，按特征核对是唯一且最可靠的认领方式。</>,
    ],
  },
  {
    icon: "🤲",
    title: "我捡到了东西",
    lines: [
      <>请直接交到门诊导医台，由导医登记入库（拍照、编号、上架公示）。</>,
      <>捡到物品<strong>无需在网上登记</strong>——网上报失入口只面向失主。</>,
    ],
  },
  {
    icon: "🏥",
    title: "我是导医 / 管理员",
    lines: [
      <>1. 公众页右上角「管理员入口」登录（账号密码由信息科发放）。</>,
      <>2. 拾物登记：工作台或「失物总表」页录入物品+照片，自动生成失物编号。</>,
      <>3. 认领登记：失主到场描述特征 → 勾选「已核对物品特征」→ 录入认领人信息 → 状态变「已认领」。</>,
      <>4. 报失处理：处理公众报失，可直接「登记入总表」或「已找到」一步到位；误操作可撤销登记。</>,
      <>5. 统计导出：按时间段统计，一键导出 Excel 留档上报。</>,
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto min-h-screen max-w-2xl px-3 pb-8">
      {/* 顶部导航 */}
      <nav className="sticky top-0 z-20 -mx-3 mb-1 flex items-center gap-2 bg-gradient-to-r from-brand to-brand-dark px-3 py-2.5 text-white shadow">
        <Link href="/" className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs no-underline">← 返回</Link>
        <div className="truncate text-[15px] font-semibold">🏥 苏州和康中医医院 · 失物招领</div>
      </nav>

      <div className="py-4 text-center">
        <h1 className="text-xl font-bold text-brand-dark sm:text-2xl">❓ 使用帮助</h1>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-slate-500">
          失物招领的完整流程，按您的角色查看
        </p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <section key={s.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-[16px] font-bold text-brand-dark">{s.icon} {s.title}</h2>
            <div className="space-y-1.5 text-[14px] leading-relaxed text-slate-600">
              {s.lines.map((l, i) => (
                <p key={i}>{l}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-brand bg-brand-light px-4 py-3 text-center text-[13px] leading-relaxed text-slate-500">
        🔒 隐私与防冒领说明：拾获物品清单不对外公示；认领人姓名/电话、报失人信息仅管理员可见；认领以报失时填写的特征描述为核对依据。
      </div>

      <footer className="mt-8 border-t border-slate-200 py-5 text-center text-xs text-slate-400">
        苏州和康中医医院 · 导医台失物招领服务<br />
        捡到物品请交到导医台 · 认领请本人到场核对
      </footer>
    </div>
  );
}
