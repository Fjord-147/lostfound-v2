"use client";
// 功能介绍：管理端各模块是干什么的、日常怎么操作（纯说明页，2026-10-12 加入，可随时整体移除）
import Link from "next/link";

const SECTIONS = [
  {
    icon: "🏠",
    title: "工作台（首页）",
    desc: "每天打开的第一个页面",
    points: [
      "四张统计卡：今日新登记 / 待认领总数 / 今日归还 / 本月已归还——点卡片可以查看对应明细清单",
      "待认领清单：最近登记的待认领物品，点一条直接打开认领",
      "搜索框：输入编号/名称/特征快速找物品",
      "📝 拾物登记：捡到东西从这里录入（照片可多张，敏感照片点🔒可对公众隐藏）",
      "🔍 认领登记：失主来领东西从这里开始",
      "绿色的「新报失待处理」横幅：点它去处理患者报失",
    ],
  },
  {
    icon: "📋",
    title: "失物总表",
    desc: "所有物品的完整台账",
    points: [
      "按状态/日期/关键词筛选，表格📋和卡片🎴两种视图可切换",
      "✏ 编辑：改名称、特征、存放位置等；照片上🔒可控制公众端可见性",
      "🙋 患者报失的物品有绿色「找到」按钮：确认后患者手机上的进度条会显示「已找到，请尽快来领」",
      "认领：待认领物品可直接发起认领登记",
      "🗑 删除：永久删除记录（需输入「确认」，请谨慎）",
    ],
  },
  {
    icon: "✅",
    title: "认领管理",
    desc: "已归还物品的记录与追溯",
    points: [
      "查看每件已认领物品的认领人、电话、认领时间、经办人",
      "「自述特征」列：认领人对物品的描述，核对留档用",
      "✎ 认领：改认领人信息（填了手机号会校验格式）",
      "↩ 撤销认领：发现发错了可退回「待认领」（需输入「确认」）",
      "可按认领人/电话/编号搜索",
    ],
  },
  {
    icon: "📬",
    title: "报失处理",
    desc: "患者提交的报失，进度条的后台",
    points: [
      "四个状态：待查找 → 已登记 → 待领取 → 已找到（患者在手机上看到的就是这条线的进度条）",
      "📥 登记入总表：把报失转成总表里一件待认领物品（来源标记为患者报失）",
      "📣 确认找到：患者报失登记后，确定东西就是他丢的——点这个，患者进度条立刻跳到「已找到」，可附留言（如：放在导医台2号抽屉）",
      "✓ 已找到：患者当场来领时一步到位（登记+认领一次完成）",
      "忽略/重新查找：不匹配的报失可先忽略，以后还能捞回来",
      "认领完成后，报失记录自动变成「已找到（已取走）」，患者看到流程完结",
    ],
  },
  {
    icon: "📊",
    title: "统计导出",
    desc: "给信息科和院感留的数",
    points: [
      "按时间段统计登记/认领数量",
      "一键导出 Excel 存档",
      "操作审计：谁在什么时间做了什么（登录、登记、认领、修改、删除都有记录）",
    ],
  },
  {
    icon: "🙋",
    title: "患者那边看到的是什么",
    desc: "公众端只有三个页面",
    points: [
      "首页：只有「登记报失」和「查询我的报失」两个入口（拾获清单不对外公示，防冒领）",
      "登记报失：填姓名、手机号、物品特征（特征≥5字，是认领核对的依据）",
      "查询我的报失：输入手机号看进度条（已报失→已受理→已找到→已取走）和护士小姐姐的留言",
    ],
  },
  {
    icon: "🔒",
    title: "防冒领机制（系统自动）",
    desc: "不用记，知道有这些东西就行",
    points: [
      "认领必须填 11 位手机号；证件/手机/钱包类必须现场拍认领人照片",
      "患者报失的物品：认领手机号和报失手机号不一致时，必须勾选原因（家属代领等），系统记档",
      "并发抢认领只有一个人能成功；所有关键操作都有审计日志可查",
      "左下角「换人」= 交接班快速切账号；「退出」= 回公众首页",
    ],
  },
];

export default function GuidePage() {
  return (
    <div>
      <h1 className="text-[22px] font-bold">❓ 功能介绍</h1>
      <p className="mb-5 text-sm text-slate-500">
        这个系统是干什么的、每个页面怎么用。看完这一页就能上手；平时不用点进来。
      </p>

      <div className="space-y-4">
        {SECTIONS.map((s) => (
          <div key={s.title} className="card p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl">{s.icon}</span>
              <span className="text-[17px] font-bold text-brand-dark">{s.title}</span>
              <span className="text-[13px] text-slate-400">{s.desc}</span>
            </div>
            <ul className="list-disc space-y-1.5 pl-6 text-[14px] leading-relaxed text-slate-600">
              {s.points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl border border-dashed border-brand bg-brand-light px-4 py-3 text-[13px] leading-relaxed text-slate-500">
        🔄 日常一句话流程：<strong>捡到东西 → 工作台登记；患者报失 → 报失处理里登记入总表 → 确认找到 → 患者来领时走认领</strong>。其他都是查询和兜底。
      </div>

      <div className="mt-4 text-center">
        <Link href="/admin" className="text-[13px] text-brand no-underline">← 返回工作台</Link>
      </div>
    </div>
  );
}
