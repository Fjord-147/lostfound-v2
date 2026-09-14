"use client";
// 认领管理：已认领列表 + ✏物品/✎认领/↩撤销(输确认)/🗑删除(输确认)
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { photosOf, CATEGORY_ICONS, CATEGORY_STYLE } from "@/lib/types";
import { toast, Modal, ConfirmDanger, PhotoZoom } from "@/components/ui";
import { CATEGORIES } from "@/lib/types";

export default function ClaimsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "card">("table");
  const [unclaimItem, setUnclaimItem] = useState<any>(null);
  const [delItem, setDelItem] = useState<any>(null);
  const [editClaim, setEditClaim] = useState<any>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [zoom, setZoom] = useState<{ photos: string[]; start: number } | null>(null);

  useEffect(() => setView((localStorage.getItem("lf_cview") as any) || "table"), []);
  const load = useCallback(() => {
    api(`/api/items?view=claims${q ? `&q=${encodeURIComponent(q)}` : ""}`).then((d) => d.ok && setItems(d.items));
  }, [q]);
  useEffect(() => { load(); }, [load]);

  async function doUnclaim() {
    const d = await api(`/api/items/${unclaimItem.id}/unclaim`, { method: "POST", body: JSON.stringify({ confirm: "确认" }) });
    toast(d.msg, d.ok ? "success" : "error");
    if (d.ok) load();
  }
  async function doDelete() {
    const d = await api(`/api/items/${delItem.id}/delete`, { method: "POST", body: JSON.stringify({ confirm: "确认" }) });
    toast(d.msg, d.ok ? "success" : "error");
    if (d.ok) load();
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold">✅ 认领管理</h1>
      <p className="mb-4 text-sm text-slate-500">已认领的物品在这里管理（共 {items.length} 条）</p>

      <div className="card mb-4 flex flex-wrap items-center gap-2 p-4">
        <input className="inp sm:w-72" placeholder="按编号/名称/认领人/电话搜索" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-outline btn-sm" onClick={load}>筛选</button>
        <button className="btn btn-outline btn-sm" onClick={() => setQ("")}>重置</button>
        <div className="ml-auto flex overflow-hidden rounded-lg border border-slate-300">
          <button onClick={() => { setView("table"); localStorage.setItem("lf_cview", "table"); }} className={`px-3.5 py-1.5 text-sm ${view === "table" ? "bg-brand text-white" : "bg-white text-slate-500"}`}>📋</button>
          <button onClick={() => { setView("card"); localStorage.setItem("lf_cview", "card"); }} className={`px-3.5 py-1.5 text-sm ${view === "card" ? "bg-brand text-white" : "bg-white text-slate-500"}`}>🎴</button>
        </div>
      </div>

      {view === "table" && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-light text-left text-brand-dark">
                {["编号", "名称", "认领人", "电话", "人群/性别", "认领时间", "经办人", "操作"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2">{it.code}</td>
                  <td className="px-3 py-2 font-medium">{it.name}</td>
                  <td className="px-3 py-2">{it.claimerName}</td>
                  <td className="whitespace-nowrap px-3 py-2">{it.claimerPhone || "未留"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{it.claimerGroup || "—"}/{it.claimerGender || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{it.claimedAt}</td>
                  <td className="whitespace-nowrap px-3 py-2">{it.operator || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex gap-1.5">
                      <button className="btn btn-outline btn-sm" onClick={() => setEditItem(it)}>✏ 物品</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditClaim(it)}>✎ 认领</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setUnclaimItem(it)}>↩ 撤销</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDelItem(it)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="py-10 text-center text-slate-400">没有已认领的记录</div>}
        </div>
      )}

      {view === "card" && (
        <div className="grid grid-cols-1 justify-items-start gap-4 sm:grid-cols-[repeat(auto-fill,340px)]">
          {items.map((it) => {
            const st = CATEGORY_STYLE[it.category || "其他"] || CATEGORY_STYLE["其他"];
            const tps = photosOf(it);
            return (
              <div key={it.id} className="w-full rounded-xl border p-4" style={{ background: st.bg, borderColor: st.border }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-slate-500">{it.code}</span>
                  <span className="text-xl">{CATEGORY_ICONS[it.category || ""]}</span>
                  <span className="tag tag-returned">已认领</span>
                  {it.source === "患者报失" && <span className="tag tag-source">🙋 患者报失</span>}
                </div>
                <div className="my-1 text-[17px] font-semibold">{it.name}</div>
                {tps.length > 0 && (
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {tps.map((p, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={`/api/upload/files/${p}`} onClick={() => setZoom({ photos: tps, start: i })}
                        className="h-20 w-20 flex-shrink-0 cursor-zoom-in rounded-lg border border-slate-200 object-cover" alt="" />
                    ))}
                  </div>
                )}
                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-white p-3 text-[13px]">
                  <div><span className="text-slate-500">认领人：</span>{it.claimerName}</div>
                  <div><span className="text-slate-500">电话：</span>{it.claimerPhone || "未留"}</div>
                  <div><span className="text-slate-500">人群：</span>{it.claimerGroup || "未选"}</div>
                  <div><span className="text-slate-500">性别：</span>{it.claimerGender || "未选"}</div>
                  <div><span className="text-slate-500">认领时间：</span>{it.claimedAt}</div>
                  <div><span className="text-slate-500">经办人：</span>{it.operator || "—"}</div>
                </div>
                <div className="mt-2.5 flex flex-wrap justify-end gap-2">
                  <button className="btn btn-outline btn-sm" onClick={() => setEditItem(it)}>✏ 物品</button>
                  <button className="btn btn-outline btn-sm" onClick={() => setEditClaim(it)}>✎ 认领信息</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setUnclaimItem(it)}>↩ 撤销认领</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setDelItem(it)}>🗑 删除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDanger open={!!unclaimItem} onClose={() => setUnclaimItem(null)} title="撤销认领"
        hint={`物品 ${unclaimItem?.code} 将退回「待认领」，认领人信息会被清空。`} onConfirm={doUnclaim} />
      <ConfirmDanger open={!!delItem} onClose={() => setDelItem(null)} title="删除整条记录"
        hint={`将永久删除 ${delItem?.code} ${delItem?.name} 及其所有照片，无法恢复！`} onConfirm={doDelete} />
      <EditClaimModal item={editClaim} onClose={() => setEditClaim(null)} onSaved={() => { setEditClaim(null); load(); }} />
      <EditItemModal item={editItem} onClose={() => setEditItem(null)} onSaved={() => { setEditItem(null); load(); }} />
      {zoom && <PhotoZoom photos={zoom.photos} start={zoom.start} onClose={() => setZoom(null)} />}
    </div>
  );
}

function EditClaimModal({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (item) setF({ claimerName: item.claimerName || "", claimerPhone: item.claimerPhone || "", claimerGroup: item.claimerGroup || "", claimerGender: item.claimerGender || "" });
  }, [item]);
  if (!item || !f) return null;
  return (
    <Modal open={!!item} onClose={onClose}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const d = await api(`/api/items/${item.id}/claim`, { method: "POST", body: JSON.stringify({ ...f, featureVerified: true, keepClaim: true }) });
        if (d.ok) { toast("认领信息已更新", "success"); onSaved(); } else toast(d.msg, "error");
      }}>
        <div className="mb-4 text-lg font-semibold">修改认领信息 <span className="text-sm font-normal text-slate-400">{item?.code}</span></div>
        <div className="space-y-3.5">
          <div><label className="lbl">认领人姓名 *</label><input className="inp" value={f.claimerName} onChange={(e) => setF({ ...f, claimerName: e.target.value })} required /></div>
          <div><label className="lbl">电话</label><input className="inp" value={f.claimerPhone} onChange={(e) => setF({ ...f, claimerPhone: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3.5">
            <div><label className="lbl">人群</label>
              <select className="inp" value={f.claimerGroup} onChange={(e) => setF({ ...f, claimerGroup: e.target.value })}>
                <option value="">请选择</option>{["老人", "小孩", "青年", "中年", "其他"].map((g) => <option key={g}>{g}</option>)}
              </select></div>
            <div><label className="lbl">性别</label>
              <select className="inp" value={f.claimerGender} onChange={(e) => setF({ ...f, claimerGender: e.target.value })}>
                <option value="">请选择</option><option value="男">男士</option><option value="女">女士</option>
              </select></div>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-outline flex-1" onClick={onClose}>取消</button>
          <button className="btn flex-1">保存修改</button>
        </div>
      </form>
    </Modal>
  );
}

function EditItemModal({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    if (item) setF({ name: item.name, category: item.category || "其他", description: item.description || "", foundLocation: item.foundLocation || "", foundTime: (item.foundTime || "").replace(" ", "T"), storageLocation: item.storageLocation || "", founder: item.source === "患者报失" ? "患者报失" : item.founder || "", locked: item.source === "患者报失" });
  }, [item]);
  if (!item || !f) return null;
  return (
    <Modal open={!!item} onClose={onClose} wide>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const d = await api(`/api/items/${item.id}`, { method: "PUT", body: JSON.stringify(f) });
        if (d.ok) { toast(d.msg, "success"); onSaved(); } else toast(d.msg, "error");
      }}>
        <div className="mb-1 text-lg font-semibold">编辑物品信息</div>
        <div className="mb-4 text-[13px] text-slate-500">编号 {item.code}</div>
        <div className="mb-3.5"><label className="lbl">物品名称 *</label><input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div className="mb-3.5 grid grid-cols-2 gap-3.5">
          <div><label className="lbl">类别</label><select className="inp" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="lbl">捡到地点</label><input className="inp" value={f.foundLocation} onChange={(e) => setF({ ...f, foundLocation: e.target.value })} /></div>
        </div>
        <div className="mb-3.5"><label className="lbl">特征描述</label><textarea className="inp min-h-[70px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div className="mb-3.5 grid grid-cols-2 gap-3.5">
          <div><label className="lbl">捡到时间</label><input type="datetime-local" className="inp" value={f.foundTime} onChange={(e) => setF({ ...f, foundTime: e.target.value })} /></div>
          <div><label className="lbl">捡到人</label><input className="inp" value={f.founder} disabled={f.locked} onChange={(e) => setF({ ...f, founder: e.target.value })} /></div>
        </div>
        <div className="mb-4"><label className="lbl">存放位置</label><input className="inp" value={f.storageLocation} onChange={(e) => setF({ ...f, storageLocation: e.target.value })} /></div>
        <div className="flex gap-3">
          <button type="button" className="btn btn-outline flex-1" onClick={onClose}>取消</button>
          <button className="btn flex-1">保存修改</button>
        </div>
      </form>
    </Modal>
  );
}
