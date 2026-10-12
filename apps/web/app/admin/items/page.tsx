"use client";
// 失物总表：表格/卡片双视图 + 筛选搜索日期 + ✏编辑 + 就地认领 + 照片放大轮播
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { photosOf, CATEGORY_ICONS, CATEGORY_STYLE, CATEGORIES, fmtDT } from "@/lib/types";
import { toast, PhotoZoom, Modal, ConfirmDanger } from "@/components/ui";
import ClaimDrawer from "@/components/ClaimDrawer";

// 表格列（表头可拖拽调宽，宽度记忆在 localStorage）
// 待认领视图：8列；全部/已认领视图：补回 捡到人/认领人/认领时间（共11列）
const PENDING_COLS = ["照片", "编号", "物品", "存放", "捡到区域", "登记人", "状态", "操作"];
const ALL_COLS = ["照片", "编号", "物品", "存放", "捡到区域", "登记人", "捡到人", "认领人", "认领时间", "状态", "操作"];
const DEFAULT_COLW: Record<string, number> = { 照片: 60, 编号: 116, 状态: 110, 操作: 200 };

export default function ItemsPage() {
  const tableRef = useRef<HTMLTableElement>(null);
  const [status, setStatus] = useState("待认领");
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [view, setView] = useState<"table" | "card">("table");
  const [claimId, setClaimId] = useState<number | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [zoom, setZoom] = useState<{ photos: string[]; start: number } | null>(null);
  const [carousel, setCarousel] = useState<number>(0);
  const [editItem, setEditItem] = useState<any>(null);
  const [delItem, setDelItem] = useState<any>(null);
  const [me, setMe] = useState("");

  const [noFeature, setNoFeature] = useState(false);
  // 列集随状态筛选切换：待认领 8 列；全部/已认领补回 捡到人/认领人/认领时间
  const cols = noFeature || status === "待认领" ? PENDING_COLS : ALL_COLS;
  // 列显隐（列设置面板控制，localStorage 记忆；"操作"列强制保留）
  const [colHidden, setColHidden] = useState<Record<string, boolean>>({});
  const [colsPanel, setColsPanel] = useState(false);
  const colsPanelRef = useRef<HTMLDivElement>(null);
  // 点击面板以外任意处自动收起（勾选状态记忆在 colHidden，不收起影响）
  useEffect(() => {
    if (!colsPanel) return;
    const onDown = (e: MouseEvent) => {
      if (colsPanelRef.current && !colsPanelRef.current.contains(e.target as Node)) setColsPanel(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [colsPanel]);
  useEffect(() => {
    try { setColHidden(JSON.parse(localStorage.getItem("lf_colhide") || "{}")); } catch { /* 忽略损坏记忆 */ }
  }, []);
  const visibleCols = cols.filter((c) => c === "操作" || !colHidden[c]);
  function toggleCol(col: string) {
    setColHidden((prev) => {
      const next = { ...prev, [col]: !prev[col] };
      try { localStorage.setItem("lf_colhide", JSON.stringify(next)); } catch { /* 私密模式 */ }
      return next;
    });
  }
  // 列宽：默认 + localStorage 记忆，表头右缘拖拽调整（WPS 式）
  const [colWidths, setColWidths] = useState<Record<string, number>>({ ...DEFAULT_COLW });
  const [tipHide, setTipHide] = useState(false);
  useEffect(() => { setTipHide(!!localStorage.getItem("lf_colw_tip")); }, []);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lf_colw") || "{}");
      setColWidths({ ...DEFAULT_COLW, ...saved });
    } catch { /* 忽略损坏的本地记忆 */ }
  }, []);
  function startResize(col: string, colIndex: number, e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const th = (e.target as HTMLElement).closest("th");
    const startW = th?.offsetWidth || 100;
    // 封顶：该列（表头+所有单元格）内容刚好全显示所需宽度，再宽没有意义
    let maxW = 480;
    try {
      const table = tableRef.current;
      if (table) {
        let need = 0;
        const cells = table.querySelectorAll(`td:nth-child(${colIndex + 1})`);
        cells.forEach((td) => { need = Math.max(need, (td as HTMLElement).scrollWidth); });
        if (th) need = Math.max(need, th.scrollWidth);
        maxW = Math.min(Math.max(need + 10, 64), 480);
      }
    } catch { /* 测量失败用默认上限 */ }
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(Math.max(48, Math.round(startW + ev.clientX - startX)), maxW);
      setColWidths((prev) => ({ ...prev, [col]: w }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setColWidths((prev) => { try { localStorage.setItem("lf_colw", JSON.stringify(prev)); } catch { /* 私密模式 */ } return prev; });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  useEffect(() => {
    // 无记忆时按屏幕宽默认：手机=卡片（表格在窄屏太挤）
    const saved = localStorage.getItem("lf_view") as "table" | "card" | null;
    setView(saved || (window.innerWidth < 768 ? "card" : "table"));
    api("/api/auth/me").then((d) => d.ok && setMe(d.user.name));
    // 从工作台「缺特征提醒」进来时自动打开缺特征筛选
    if (new URLSearchParams(window.location.search).get("noFeature")) setNoFeature(true);
  }, []);

  const load = useCallback(() => {
    if (noFeature) {
      api("/api/items/no-feature").then((d) => d.ok && setItems(d.items));
      return;
    }
    const p = new URLSearchParams({ status, ...(q && { q }), ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) });
    api(`/api/items?${p}`).then((d) => d.ok && setItems(d.items));
  }, [status, q, dateFrom, dateTo, noFeature]);
  useEffect(() => { load(); }, [load]);

  function switchView(v: "table" | "card") {
    setView(v);
    localStorage.setItem("lf_view", v);
  }

  // 患者报失物品：确认找到 → 患者进度条推到「已找到，请尽快来领」
  async function confirmFoundItem(it: any) {
    if (!confirm(`确认「${it.name}」就是报失患者的东西吗？\n患者查询页将显示「已找到，请尽快来领」。`)) return;
    const d = await api(`/api/items/${it.id}/confirm-found`, { method: "POST", body: JSON.stringify({}) });
    toast(d.msg, d.ok ? "success" : "error");
    if (d.ok) load();
  }

  // 卡片轮播
  function slide(d: number, len: number) {
    setCarousel((i) => (i + d + len) % len);
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold">📋 失物总表</h1>
      <p className="mb-4 text-sm text-slate-500">共 {items.length} 条记录</p>

      {/* 筛选 + 视图切换 */}
      <div className="card mb-4 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {["all", "待认领"].map((s) => (
            <button key={s} onClick={() => { setStatus(s); setNoFeature(false); }}
              className={`rounded-full px-4 py-1.5 text-sm ${!noFeature && status === s ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-500"}`}>
              {s === "all" ? "全部" : s}
            </button>
          ))}
          <button onClick={() => setNoFeature(true)}
            className={`rounded-full px-4 py-1.5 text-sm ${noFeature ? "bg-amber-500 text-white" : "border border-amber-300 bg-white text-amber-600"}`}>
            缺特征
          </button>
          <Link href="/admin/claims" className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-500 no-underline">
            已认领管理 ✅ →
          </Link>
          <div ref={colsPanelRef} className="relative ml-auto flex items-center gap-2">
            <button onClick={() => setColsPanel((v) => !v)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-500 hover:border-brand hover:text-brand">
              ⚙️ 列设置
            </button>
            <div className="flex overflow-hidden rounded-lg border border-slate-300">
              <button onClick={() => switchView("table")} className={`px-3.5 py-1.5 text-sm ${view === "table" ? "bg-brand text-white" : "bg-white text-slate-500"}`}>📋 表格</button>
              <button onClick={() => switchView("card")} className={`px-3.5 py-1.5 text-sm ${view === "card" ? "bg-brand text-white" : "bg-white text-slate-500"}`}>🎴 卡片</button>
            </div>
            {colsPanel && (
              <div className="absolute right-0 top-full z-30 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                <div className="mb-1 px-2 text-xs font-semibold text-slate-400">勾选要显示的列</div>
                {ALL_COLS.map((c) => (
                  <label key={c} className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 ${c === "操作" ? "opacity-50" : ""}`}>
                    <input type="checkbox" className="h-4 w-4" disabled={c === "操作"}
                      checked={c === "操作" || !colHidden[c]}
                      onChange={() => toggleCol(c)} />
                    {c}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input className="inp sm:w-56" placeholder="编号/名称/类别/特征" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-slate-300">起</span>
          <input type="text" className="inp w-36" placeholder="2026-07-12" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="支持 2026/7/12 等格式" />
          <span className="text-slate-300">至</span>
          <input type="text" className="inp w-36" placeholder="2026-07-12" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <button className="btn btn-outline btn-sm" onClick={load}>筛选</button>
          <button className="btn btn-outline btn-sm" onClick={() => { setQ(""); setDateFrom(""); setDateTo(""); }}>重置</button>
        </div>
      </div>

      {/* 表格视图 */}
      {view === "table" && (
        <>
        {!tipHide && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-slate-500">
            💡 按住表头右侧的小竖条
            <span className="inline-block h-3.5 w-[3px] rounded-full bg-slate-400 align-middle" />
            可以左右拖拽调整列宽，调好的布局自动记住
            <button className="ml-auto text-slate-300 hover:text-slate-500" title="不再提示"
              onClick={() => { setTipHide(true); try { localStorage.setItem("lf_colw_tip", "1"); } catch { /* 私密模式 */ } }}>✕</button>
          </div>
        )}
        <div className="card overflow-x-auto p-0">
          <table ref={tableRef} className="items-fixed w-full text-sm" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr className="bg-brand-light text-left text-brand-dark">
                {visibleCols.map((h, i) => (
                  <th key={h} className="group relative whitespace-nowrap px-3 py-2.5 font-semibold" style={colWidths[h] ? { width: colWidths[h] } : undefined}>
                    {h}
                    {i < visibleCols.length - 1 && (
                      <span className="absolute inset-y-0 right-0 flex w-[7px] cursor-col-resize select-none items-center justify-center"
                        title="按住拖拽调整列宽（到顶即全显示）" onMouseDown={(e) => startResize(h, i, e)}>
                        <span className="h-4 w-px rounded-full bg-slate-300 transition-all group-hover:h-5 group-hover:w-[3px] group-hover:bg-brand" />
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const tps = photosOf(it);
                const pendingMode = noFeature || status === "待认领";
                const cellOf: Record<string, (x: any) => React.ReactNode> = {
                  "照片": (x) => tps.length ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/upload/files/${tps[0]}`} onClick={() => setZoom({ photos: tps, start: 0 })}
                      className="h-11 w-11 cursor-zoom-in rounded border border-slate-200 object-cover transition hover:scale-110" alt="" />
                  ) : <span className="text-xl">{CATEGORY_ICONS[x.category || ""] || "📦"}</span>,
                  "编号": (x) => <span className="text-slate-500">{x.code}</span>,
                  "物品": (x) => (
                    <>
                      <div className="font-medium">{x.name}</div>
                      {x.description ? (
                        <div className="mt-0.5 line-clamp-2 whitespace-normal text-xs leading-snug text-slate-400" title={x.description}>{x.description}</div>
                      ) : (
                        <div className="mt-0.5 text-xs text-amber-500">⚠️ 缺特征，认领无法核对</div>
                      )}
                      {pendingMode && x.status === "已认领" && (
                        <div className="mt-0.5 text-xs text-slate-400">{x.claimerName} · {x.claimedAt || "—"} 取走</div>
                      )}
                    </>
                  ),
                  "存放": (x) => x.storageLocation || "—",
                  "捡到区域": (x) => (
                    <>
                      <div className="truncate">{x.foundLocation || "—"}</div>
                      <div className="text-xs text-slate-400">{fmtDT(x.foundTime) || "—"}</div>
                    </>
                  ),
                  "登记人": (x) => x.registeredBy || "—",
                  "捡到人": (x) => x.source === "患者报失" ? "患者报失" : x.founder || "—",
                  "认领人": (x) => x.claimerName || "—",
                  "认领时间": (x) => x.claimedAt || "—",
                  "状态": (x) => x.source === "患者报失" ? (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{x.status}🙋</span>
                  ) : (
                    <span className={`tag ${x.status === "已认领" ? "tag-returned" : "tag-pending"}`}>{x.status}{x.status === "待认领" ? "👩‍⚕️" : ""}</span>
                  ),
                  "操作": (x) => (
                    <div className="flex gap-1.5">
                      <button className="btn btn-outline btn-sm" onClick={() => setEditItem(x)}>编辑</button>
                      {x.source === "患者报失" && (
                        <button className="btn btn-sm !bg-emerald-600 !from-emerald-600 !to-emerald-700" title="确认找到：患者进度条显示「已找到，请尽快来领」" onClick={() => confirmFoundItem(x)}>找到</button>
                      )}
                      {x.status === "待认领" && (
                        <button className="btn btn-sm" onClick={() => { setClaimId(x.id); setClaimOpen(true); }}>认领</button>
                      )}
                    </div>
                  ),
                };
                return (
                  <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                    {visibleCols.map((col) => (
                      <td key={col} className={`px-3 py-2 text-[13px] ${["存放", "捡到人", "认领人", "认领时间", "登记人", "编号"].includes(col) ? "whitespace-nowrap" : ""}`}>{cellOf[col]?.(it)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && <div className="py-10 text-center text-slate-400">没有符合条件的记录</div>}
        </div>
        </>
      )}

      {/* 卡片视图 */}
      {view === "card" && (
        <div className="grid grid-cols-1 justify-items-start gap-4 sm:grid-cols-[repeat(auto-fill,340px)]">
          {items.map((it) => {
            const st = CATEGORY_STYLE[it.category || "其他"] || CATEGORY_STYLE["其他"];
            const tps = photosOf(it);
            return (
              <div key={it.id} className="flex h-full w-full flex-col rounded-xl border p-4" style={{ background: st.bg, borderColor: st.border }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-slate-500">编号 {it.code}</span>
                  <span className="text-xl">{CATEGORY_ICONS[it.category || ""]}</span>
                  {it.source === "患者报失" ? (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">{it.status}🙋患者报失</span>
                  ) : (
                    <span className={`tag ${it.status === "已认领" ? "tag-returned" : "tag-pending"}`}>{it.status}{it.status === "待认领" ? "👩‍⚕️" : ""}</span>
                  )}
                </div>
                <div className="my-1 line-clamp-2 min-h-[46px] text-[17px] font-semibold leading-snug">{it.name}</div>
                {tps.length > 0 ? (
                  <div className="relative mt-2 h-44 w-full cursor-zoom-in overflow-hidden rounded-lg bg-white/50"
                    onClick={() => setZoom({ photos: tps, start: carousel })}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/upload/files/${tps[carousel % tps.length]}`} className="h-full w-full object-cover" alt="" />
                    {tps.length > 1 && (
                      <>
                        <button className="absolute left-1.5 top-1/2 h-9 w-8 -translate-y-1/2 rounded bg-black/45 text-xl text-white" onClick={(e) => { e.stopPropagation(); slide(-1, tps.length); }}>‹</button>
                        <button className="absolute right-1.5 top-1/2 h-9 w-8 -translate-y-1/2 rounded bg-black/45 text-xl text-white" onClick={(e) => { e.stopPropagation(); slide(1, tps.length); }}>›</button>
                        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                          {tps.map((_, i) => (
                            <span key={i} className={`h-[7px] w-[7px] rounded-full ${i === carousel % tps.length ? "bg-white" : "bg-white/50"}`} />
                          ))}
                        </div>
                      </>
                    )}
                    <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">🔍 点击放大</span>
                  </div>
                ) : (
                  <div className="mt-2 flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/50 text-5xl opacity-40">
                    {CATEGORY_ICONS[it.category || ""] || "📦"}
                  </div>
                )}
                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-white p-3 text-[13px]">
                  <div><span className="text-slate-500">类别：</span>{CATEGORY_ICONS[it.category || ""]} {it.category || "未分类"}</div>
                  <div><span className="text-slate-500">捡到地点：</span>{it.foundLocation || "—"}</div>
                  <div><span className="text-slate-500">存放位置：</span>{it.storageLocation || "—"}</div>
                  <div><span className="text-slate-500">捡到时间：</span>{fmtDT(it.foundTime) || "—"}</div>
                  <div><span className="text-slate-500">捡到人：</span>{it.source === "患者报失" ? "患者报失" : it.founder || "—"}</div>
                  <div><span className="text-slate-500">登记人：</span>{it.registeredBy || "—"}</div>
                  <div className="col-span-2 line-clamp-2 break-all rounded bg-amber-50 px-2 py-1.5"><span className="text-amber-700">特征：</span>{it.description || "—"}</div>
                </div>
                {it.status === "已认领" && (
                  <div className="mt-2 rounded-md bg-white/70 px-3 py-2 text-[13px] leading-relaxed">
                    <strong className="text-brand-dark">认领信息</strong><br />
                    认领人：{it.claimerName}　电话：{it.claimerPhone || "未留"}<br />
                    人群：{it.claimerGroup || "未选"}　性别：{it.claimerGender || "未选"}<br />
                    认领时间：{it.claimedAt}　经办人：{it.operator}
                  </div>
                )}
                <div className="mt-auto flex justify-end gap-2 pt-2.5">
                  <button className="btn btn-outline btn-sm" onClick={() => setEditItem(it)}>编辑</button>
                  {it.source === "患者报失" && (
                    <button className="btn btn-sm !bg-emerald-600 !from-emerald-600 !to-emerald-700" title="确认找到：患者进度条显示「已找到，请尽快来领」" onClick={() => confirmFoundItem(it)}>找到</button>
                  )}
                  {it.status === "待认领" && <button className="btn btn-sm" onClick={() => { setClaimId(it.id); setClaimOpen(true); }}>✓ 认领</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 认领抽屉 */}
      <ClaimDrawer open={claimOpen} onClose={() => setClaimOpen(false)} targetId={claimId} me={me}
        onDone={(msg) => { toast(msg, "success"); load(); }} />

      {/* 编辑弹窗 */}
      <EditModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load(); }}
        onDelete={(it) => { setEditItem(null); setDelItem(it); }} />

      {/* 删除确认 */}
      <ConfirmDanger
        open={!!delItem}
        onClose={() => setDelItem(null)}
        title="删除整条记录"
        hint={`将永久删除 ${delItem?.code} ${delItem?.name} 及其所有照片，无法恢复！`}
        onConfirm={async () => {
          const d = await api(`/api/items/${delItem.id}/delete`, { method: "POST", body: JSON.stringify({ confirm: "确认" }) });
          toast(d.msg, d.ok ? "success" : "error");
          if (d.ok) load();
        }}
      />

      {zoom && <PhotoZoom photos={zoom.photos} start={zoom.start} onClose={() => setZoom(null)} />}
    </div>
  );
}

/* ===== 编辑物品弹窗 ===== */
function EditModal({ item, onClose, onSaved, onDelete }: { item: any; onClose: () => void; onSaved: () => void; onDelete: (it: any) => void }) {
  const photos = item ? photosOf(item) : [];
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (item) {
      const h = new Set<string>((item.hiddenPhotos || "").split(",").map((x: string) => x.trim()).filter(Boolean));
      setHidden(h);
    }
  }, [item]);
  function toggleHide(p: string) {
    setHidden((prev) => {
      const n = new Set(prev);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  }
  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (item) {
      setForm({
        name: item.name, category: item.category || CATEGORIES[0], description: item.description || "",
        foundLocation: item.foundLocation || "", foundTime: (item.foundTime || "").replace(" ", "T"),
        storageLocation: item.storageLocation || "",
        founder: item.source === "患者报失" ? "患者报失" : item.founder || "",
        locked: item.source === "患者报失",
      });
    }
  }, [item]);
  if (!item || !form) return null;
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const d = await api(`/api/items/${item.id}`, { method: "PUT", body: JSON.stringify({ ...form, hiddenPhotos: [...hidden].join(',') || null, }) });
    if (d.ok) { toast(d.msg, "success"); onSaved(); }
    else toast(d.msg, "error");
  }

  return (
    <Modal open={!!item} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="mb-1 text-lg font-semibold">编辑物品信息</div>
        <div className="mb-4 text-[13px] text-slate-500">编号 {item.code}（编号和照片不变）</div>
        <div className="mb-3.5">
          <label className="lbl">物品名称 <span className="text-red-600">*</span></label>
          <input className="inp" value={form.name} onChange={(e) => set("name", e.target.value)} required />
        </div>
        <div className="mb-3.5 grid grid-cols-2 gap-3.5">
          <div>
            <label className="lbl">类别</label>
            <select className="inp" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">捡到地点</label>
            <input className="inp" value={form.foundLocation} onChange={(e) => set("foundLocation", e.target.value)} />
          </div>
        </div>
        <div className="mb-3.5">
          <label className="lbl">特征描述（仅管理端可见）</label>
          <textarea className="inp min-h-[70px]" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="mb-3.5 grid grid-cols-2 gap-3.5">
          <div>
            <label className="lbl">捡到时间</label>
            <input type="datetime-local" className="inp" value={form.foundTime} onChange={(e) => set("foundTime", e.target.value)} />
          </div>
          <div>
            <label className="lbl">捡到人</label>
            <input className="inp" value={form.founder} disabled={form.locked} onChange={(e) => set("founder", e.target.value)} />
          </div>
        </div>
        <div className="mb-4">
          <label className="lbl">存放位置</label>
          <input className="inp" value={form.storageLocation} onChange={(e) => set("storageLocation", e.target.value)} />
        </div>
      <div className="mb-4">
        <label className="lbl">照片可见性（点 🔒 切换：隐藏后公众端看不到该张）</label>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p} className="relative h-[72px] w-[72px] overflow-hidden rounded-md border border-slate-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/upload/files/${p}`} className={`h-full w-full object-cover ${hidden.has(p) ? "opacity-35" : ""}`} alt="" />
              <button
                type="button"
                title={hidden.has(p) ? "已隐藏（公众看不到），点击公开" : "公众可见，点击隐藏"}
                onClick={() => toggleHide(p)}
                className="absolute bottom-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-[11px]"
              >
                {hidden.has(p) ? "🔒" : "🔓"}
              </button>
              {hidden.has(p) && (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-white/90 px-1 text-[10px] font-semibold text-red-600">已隐藏</span>
              )}
            </div>
          ))}
          {photos.length === 0 && <span className="text-sm text-slate-400">无照片</span>}
        </div>
      </div>

        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3">
          <div className="mb-1.5 text-[13px] font-semibold text-red-700">危险操作</div>
          <button type="button" className="btn btn-danger btn-sm w-full" onClick={() => onDelete(item)}>
            🗑 删除此物品（将弹出确认，输入「确认」后执行）
          </button>
        </div>
        <div className="mt-4 flex gap-3">
          <button type="button" className="btn btn-outline flex-1" onClick={onClose}>取消</button>
          <button className="btn flex-1">保存修改</button>
        </div>
      </form>
    </Modal>
  );
}
