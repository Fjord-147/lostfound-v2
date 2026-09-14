"use client";
// 失物总表：表格/卡片双视图 + 筛选搜索日期 + ✏编辑 + 就地认领 + 照片放大轮播
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { photosOf, CATEGORY_ICONS, CATEGORY_STYLE, CATEGORIES } from "@/lib/types";
import { toast, PhotoZoom, Modal, ConfirmDanger } from "@/components/ui";
import ClaimDrawer from "@/components/ClaimDrawer";

export default function ItemsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("待认领");
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

  useEffect(() => {
    setView((localStorage.getItem("lf_view") as "table" | "card") || "table");
    api("/api/auth/me").then((d) => d.ok && setMe(d.user.name));
  }, []);

  const load = useCallback(() => {
    const p = new URLSearchParams({ status, ...(q && { q }), ...(dateFrom && { dateFrom }), ...(dateTo && { dateTo }) });
    api(`/api/items?${p}`).then((d) => d.ok && setItems(d.items));
  }, [status, q, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);

  function switchView(v: "table" | "card") {
    setView(v);
    localStorage.setItem("lf_view", v);
  }

  // 卡片轮播
  function slide(d: number, len: number) {
    setCarousel((i) => (i + d + len) % len);
  }

  // 表格内联改捡到人
  async function saveFounder(it: any, founder: string) {
    const d = await api(`/api/items/${it.id}/founder`, { method: "PUT", body: JSON.stringify({ founder }) });
    toast(d.msg, d.ok ? "success" : "error");
    if (d.ok) setItems((l) => l.map((x) => (x.id === it.id ? { ...x, founder } : x)));
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold">📋 失物总表</h1>
      <p className="mb-4 text-sm text-slate-500">共 {items.length} 条记录</p>

      {/* 筛选 + 视图切换 */}
      <div className="card mb-4 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {["待认领", "all"].map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              className={`rounded-full px-4 py-1.5 text-sm ${status === s ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-500"}`}>
              {s === "all" ? "全部" : s}
            </button>
          ))}
          <Link href="/admin/claims" className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-500 no-underline">
            已认领管理 ✅ →
          </Link>
          <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300">
            <button onClick={() => switchView("table")} className={`px-3.5 py-1.5 text-sm ${view === "table" ? "bg-brand text-white" : "bg-white text-slate-500"}`}>📋 表格</button>
            <button onClick={() => switchView("card")} className={`px-3.5 py-1.5 text-sm ${view === "card" ? "bg-brand text-white" : "bg-white text-slate-500"}`}>🎴 卡片</button>
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
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-light text-left text-brand-dark">
                {["照片", "编号", "名称", "类别", "捡到地点", "捡到时间", "状态", "捡到人", "登记人", "认领人", "认领时间", "操作"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const tps = photosOf(it);
                return (
                  <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      {tps.length ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/upload/files/${tps[0]}`} onClick={() => setZoom({ photos: tps, start: 0 })}
                          className="h-11 w-11 cursor-zoom-in rounded border border-slate-200 object-cover transition hover:scale-110" alt="" />
                      ) : <span className="text-slate-300">📦</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{it.code}</td>
                    <td className="px-3 py-2 font-medium">{it.name}</td>
                    <td className="whitespace-nowrap px-3 py-2">{it.category || "—"}</td>
                    <td className="px-3 py-2">{it.foundLocation || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{it.foundTime || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`tag ${it.status === "已认领" ? "tag-returned" : "tag-pending"}`}>{it.status}</span>
                      {it.source === "患者报失" && <span className="tag tag-source ml-1">🙋</span>}
                    </td>
                    <td className="px-3 py-2">
                      {it.source === "患者报失" ? <span className="text-slate-300">—</span> : (
                        <input
                          defaultValue={it.founder || ""}
                          onBlur={(e) => e.target.value.trim() !== (it.founder || "") && saveFounder(it, e.target.value.trim())}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="w-20 rounded border-b border-dashed border-brand px-1 py-0.5 outline-none focus:bg-brand-light"
                          title="点击修改捡到人"
                        />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{it.registeredBy || "—"}</td>
                    <td className="px-3 py-2">{it.claimerName || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{it.claimedAt || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex gap-1.5">
                        <button className="btn btn-outline btn-sm !px-2.5" title="编辑物品" onClick={() => setEditItem(it)}>✏</button>
                        {it.status === "待认领" && (
                          <button className="btn btn-sm" onClick={() => { setClaimId(it.id); setClaimOpen(true); }}>认领</button>
                        )}
                        <button className="btn btn-danger btn-sm !px-2.5" title="删除" onClick={() => setDelItem(it)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && <div className="py-10 text-center text-slate-400">没有符合条件的记录</div>}
        </div>
      )}

      {/* 卡片视图 */}
      {view === "card" && (
        <div className="grid grid-cols-1 justify-items-start gap-4 sm:grid-cols-[repeat(auto-fill,340px)]">
          {items.map((it) => {
            const st = CATEGORY_STYLE[it.category || "其他"] || CATEGORY_STYLE["其他"];
            const tps = photosOf(it);
            return (
              <div key={it.id} className="w-full rounded-xl border p-4" style={{ background: st.bg, borderColor: st.border }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-slate-500">编号 {it.code}</span>
                  <span className="text-xl">{CATEGORY_ICONS[it.category || ""]}</span>
                  <span className={`tag ${it.status === "已认领" ? "tag-returned" : "tag-pending"}`}>{it.status}</span>
                  {it.source === "患者报失" && <span className="tag tag-source">🙋 患者报失</span>}
                </div>
                <div className="my-1 text-[17px] font-semibold">{it.name}</div>
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
                  <div className="mt-2 flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/50 text-5xl opacity-40">
                    {CATEGORY_ICONS[it.category || ""] || "📦"}
                  </div>
                )}
                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-white p-3 text-[13px]">
                  <div><span className="text-slate-500">类别：</span>{CATEGORY_ICONS[it.category || ""]} {it.category || "未分类"}</div>
                  <div><span className="text-slate-500">捡到地点：</span>{it.foundLocation || "—"}</div>
                  <div><span className="text-slate-500">存放位置：</span>{it.storageLocation || "—"}</div>
                  <div><span className="text-slate-500">捡到时间：</span>{it.foundTime || "—"}</div>
                  <div><span className="text-slate-500">捡到人：</span>{it.source === "患者报失" ? "患者报失" : it.founder || "—"}</div>
                  <div><span className="text-slate-500">登记人：</span>{it.registeredBy || "—"}</div>
                  <div className="col-span-2 rounded bg-amber-50 px-2 py-1.5"><span className="text-amber-700">特征：</span>{it.description || "—"}</div>
                </div>
                {it.status === "已认领" && (
                  <div className="mt-2 rounded-md bg-white/70 px-3 py-2 text-[13px] leading-relaxed">
                    <strong className="text-brand-dark">认领信息</strong><br />
                    认领人：{it.claimerName}　电话：{it.claimerPhone || "未留"}<br />
                    人群：{it.claimerGroup || "未选"}　性别：{it.claimerGender || "未选"}<br />
                    认领时间：{it.claimedAt}　经办人：{it.operator}
                  </div>
                )}
                <div className="mt-2.5 flex justify-end gap-2">
                  <button className="btn btn-outline btn-sm" onClick={() => setEditItem(it)}>✏ 编辑</button>
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
      <EditModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load(); }} />

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
function EditModal({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
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
    const d = await api(`/api/items/${item.id}`, { method: "PUT", body: JSON.stringify(form) });
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
        <div className="flex gap-3">
          <button type="button" className="btn btn-outline flex-1" onClick={onClose}>取消</button>
          <button className="btn flex-1">保存修改</button>
        </div>
      </form>
    </Modal>
  );
}
