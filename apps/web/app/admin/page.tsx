"use client";
// 工作台：品牌横幅 + 统计卡 + 报失提醒 + 就地搜索 + 待认领清单 + 登记/认领抽屉
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { photosOf, CATEGORY_ICONS, fmtDT } from "@/lib/types";
import { toast } from "@/components/ui";
import RegisterDrawer from "@/components/RegisterDrawer";
import ClaimDrawer from "@/components/ClaimDrawer";

export default function AdminHome() {
  const [me, setMe] = useState("");
  const [stats, setStats] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [searchItems, setSearchItems] = useState<any[] | null>(null);
  const [regOpen, setRegOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<number | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [notice, setNotice] = useState<{ code: string; name: string; id: number } | null>(null);

  const load = useCallback(() => {
    api("/api/items/pending").then((d) => {
      if (d.ok) {
        setStats(d.stats);
        setItems(d.items);
      }
    });
  }, []);
  useEffect(() => {
    load();
    api("/api/auth/me").then((d) => d.ok && setMe(d.user.name));
  }, [load]);

  // 绿条提醒 15 秒自动消失
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 15000);
    return () => clearTimeout(t);
  }, [notice]);

  let searchTimer: any;
  function onSearch(v: string) {
    setQ(v);
    clearTimeout(searchTimer);
    if (!v.trim()) return setSearchItems(null);
    searchTimer = setTimeout(async () => {
      const d = await api(`/api/items?status=all&q=${encodeURIComponent(v.trim())}`);
      if (d.ok) setSearchItems(d.items);
    }, 350);
  }

  const list = searchItems ?? items;
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  return (
    <div>
      {/* 品牌横幅 */}
      <div className="mb-5 flex items-center justify-between rounded-xl bg-gradient-to-r from-brand to-brand-dark px-6 py-4 text-white shadow-lg shadow-brand/25">
        <div>
          <div className="text-xl font-bold">🏥 苏州和康中医医院</div>
          <div className="mt-0.5 text-[13px] text-white/90">失物招领管理系统 · {me}，欢迎您</div>
        </div>
        <div className="text-sm text-white/85">{dateStr}</div>
      </div>

      {/* 报失提醒 */}
      {stats.pendingReports > 0 && (
        <Link href="/admin/reports" className="mb-5 block rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 no-underline">
          📬 有 <strong>{stats.pendingReports}</strong> 条新报失待处理，点击查看 →
        </Link>
      )}

      {/* 统计卡 */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { n: stats.todayCount ?? 0, l: "今日新登记", c: "border-l-brand" },
          { n: stats.pendingCount ?? 0, l: "待认领总数", c: "border-l-orange-400" },
          { n: stats.monthReturned ?? 0, l: "本月已归还", c: "border-l-green-500" },
        ].map((s, i) => (
          <div key={i} className={`card border-l-4 p-5 text-center transition hover:-translate-y-0.5 hover:shadow-md ${s.c}`}>
            <div className={`text-3xl font-bold tabular-nums ${i === 1 ? "text-orange-500" : i === 2 ? "text-green-600" : "text-brand-dark"}`}>{s.n}</div>
            <div className="mt-1 text-sm text-slate-500">{s.l}</div>
          </div>
        ))}
      </div>

      {/* 操作行 + 就地搜索 */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <button className="btn" onClick={() => setRegOpen(true)}>📝 拾物登记</button>
        <button className="btn btn-outline" onClick={() => { setClaimTarget(null); setClaimOpen(true); }}>🔍 认领登记</button>
        <Link href="/admin/items" className="btn btn-outline no-underline">📋 查看全部</Link>
        <Link href="/admin/reports" className="btn btn-outline no-foreground no-underline">📬 报失处理</Link>
        <div className="ml-auto flex w-full gap-2 sm:w-auto">
          <input
            className="inp sm:min-w-[240px]"
            placeholder="搜索失物编号/名称/特征..."
            value={q}
            onChange={(e) => onSearch(e.target.value)}
          />
          {searchItems && (
            <button className="btn btn-outline btn-sm shrink-0" onClick={() => { setQ(""); setSearchItems(null); }}>✕</button>
          )}
        </div>
      </div>

      {/* 登记成功绿条 */}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ 登记成功！编号 <strong>{notice.code}</strong>　{notice.name}　
          <button className="underline" onClick={() => setClaimTarget(notice.id)}>查看详细</button>
        </div>
      )}

      {/* 清单 */}
      <div className="card p-5">
        <h2 className="mb-3.5 text-[17px] font-semibold text-brand-dark">
          {searchItems ? `🔍 搜索结果（${searchItems.length} 条）` : `待认领清单（最近 ${items.length} 件）`}
        </h2>
        <div className="space-y-2.5">
          {list.map((it) => (
            <div
              key={it.id}
              className="flex cursor-pointer items-center gap-3.5 rounded-lg border border-slate-200 p-3 transition hover:shadow-md"
              onClick={() => { setClaimTarget(it.id); setClaimOpen(true); }}
            >
              {it.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/upload/files/${photosOf(it)[0]}`} className="h-16 w-16 flex-shrink-0 rounded object-cover" alt="" />
              ) : (
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded bg-slate-100 text-3xl">
                  {CATEGORY_ICONS[it.category || ""] || "📦"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-400">编号 {it.code}</div>
                <div className="flex items-center gap-2 font-semibold">
                  {it.name}
                  <span className="tag tag-pending">{it.status}</span>
                  {it.source === "患者报失" && <span className="tag tag-source">🙋 患者报失</span>}
                </div>
                <div className="text-[13px] text-slate-500">
                  {it.category || "未分类"} · {it.foundLocation || "—"} · 存放 {it.storageLocation || "—"} · 捡到 {fmtDT(it.foundTime) || it.createdAt?.slice(0, 10)}
                </div>
              </div>
              {it.status === "待认领" ? (
                <button
                  className="btn btn-sm"
                  onClick={(e) => { e.stopPropagation(); setClaimTarget(it.id); setClaimOpen(true); }}
                >
                  去认领
                </button>
              ) : (
                <span className="text-[13px] text-slate-400">已认领</span>
              )}
            </div>
          ))}
          {list.length === 0 && (
            <div className="py-10 text-center text-slate-400">
              {searchItems ? `没有匹配"${q}"的物品` : "🎉 暂无待认领物品"}
            </div>
          )}
        </div>
      </div>

      <RegisterDrawer
        open={regOpen}
        onClose={() => setRegOpen(false)}
        me={me}
        onDone={(item) => { load(); setNotice({ code: item.code, name: item.name, id: item.id }); }}
      />
      <ClaimDrawer
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        targetId={claimTarget}
        me={me}
        onDone={(msg) => { toast(msg, "success"); load(); }}
      />
    </div>
  );
}
