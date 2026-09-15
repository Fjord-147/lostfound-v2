"use client";
// 报失处理：四状态筛选 + 登记入总表(确认) + 已找到(弹认领抽屉一步到位) + 忽略(确认) + 重新查找
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CATEGORY_ICONS } from "@/lib/types";
import { toast, ConfirmDanger, PhotoZoom, Drawer } from "@/components/ui";
import PhotoPicker, { PickedPhoto } from "@/components/PhotoPicker";
import { uploadFiles } from "@/lib/api";
import { nowLocalStr } from "@/lib/types";

const STATUSES = ["待查找", "已登记", "已找到", "已忽略"];

export default function ReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("待查找");
  const [q, setQ] = useState("");
  const [confirmReg, setConfirmReg] = useState<any>(null);
  const [confirmIg, setConfirmIg] = useState<any>(null);
  const [foundRep, setFoundRep] = useState<any>(null);
  const [zoomPhotos, setZoomPhotos] = useState<string[] | null>(null);
  const [me, setMe] = useState("");

  useEffect(() => { api("/api/auth/me").then((d) => d.ok && setMe(d.user.name)); }, []);

  const load = useCallback(() => {
    const p = new URLSearchParams({ status, ...(q && { q }) });
    api(`/api/reports?${p}`).then((d) => {
      if (d.ok) { setReports(d.reports); setCounts(d.counts); }
    });
  }, [status, q]);
  useEffect(() => { load(); }, [load]);

  async function register(e?: React.FormEvent) {
    e?.preventDefault();
    const d = await api(`/api/reports/${confirmReg.id}/register`, {
      method: "POST", body: JSON.stringify({ note: confirmReg.__note || "" }),
    });
    toast(d.msg, d.ok ? "success" : "error");
    setConfirmReg(null);
    if (d.ok) load();
  }
  async function ignore() {
    const d = await api(`/api/reports/${confirmIg.id}/handle`, {
      method: "POST", body: JSON.stringify({ action: "ignore", note: confirmIg.__note || "" }),
    });
    toast(d.msg, d.ok ? "success" : "error");
    setConfirmIg(null);
    if (d.ok) load();
  }
  async function reopen(rep: any) {
    const d = await api(`/api/reports/${rep.id}/handle`, { method: "POST", body: JSON.stringify({ action: "reopen" }) });
    toast(d.msg, d.ok ? "success" : "error");
    if (d.ok) load();
  }

  return (
    <div>
      <h1 className="text-[22px] font-bold">📬 报失处理</h1>
      <p className="mb-4 text-sm text-slate-500">公众提交的报失记录（{reports.length} 条）</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full px-4 py-1.5 text-sm ${status === s ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-500"}`}>
            {s} ({counts[s] ?? 0})
          </button>
        ))}
        <button onClick={() => setStatus("all")}
          className={`rounded-full px-4 py-1.5 text-sm ${status === "all" ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-500"}`}>全部</button>
      </div>

      <div className="card mb-4 flex gap-2 p-4">
        <input className="inp sm:w-72" placeholder="按失主姓名/电话/物品名搜索" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-outline btn-sm" onClick={load}>筛选</button>
        <button className="btn btn-outline btn-sm" onClick={() => setQ("")}>重置</button>
      </div>

      <div className="space-y-3.5">
        {reports.map((r) => (
          <div key={r.id} className={`card border-l-4 p-4 ${r.status === "已找到" ? "border-l-green-500 opacity-90" : r.status === "已忽略" ? "border-l-slate-400 opacity-70" : "border-l-orange-400"}`}>
            <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
              <span className="text-[17px] font-semibold">{r.itemName}</span>
              <span className={`tag ${r.status === "已找到" ? "tag-returned" : r.status === "待查找" ? "tag-pending" : "bg-slate-100 text-slate-500"}`}>{r.status}</span>
              <span className="ml-auto text-xs text-slate-400">{r.createdAt}</span>
            </div>
            <div className="flex gap-3.5">
              {r.photo && (r.photo.split(",").map((p: string) => p.trim()).filter(Boolean).map((p: string, i: number) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={`/api/upload/files/${p}`} onClick={() => setZoomPhotos(r.photo.split(",").map((x: string) => x.trim()).filter(Boolean))}
                  className="h-[90px] w-[90px] flex-shrink-0 cursor-zoom-in rounded border border-slate-200 object-cover" alt="" />
              )))}
              <div className="flex-1 text-sm leading-relaxed">
                <div><span className="text-slate-500">失主：</span>{r.ownerName}　<span className="text-slate-500">电话：</span>{r.ownerPhone}</div>
                <div><span className="text-slate-500">类别：</span>{CATEGORY_ICONS[r.itemCategory || ""] || ""} {r.itemCategory || "—"}　<span className="text-slate-500">丢失地点：</span>{r.lostLocation || "—"}</div>
                <div><span className="text-slate-500">丢失时间：</span>{r.lostTime || "—"}</div>
                {r.description && <div><span className="text-slate-500">特征：</span>{r.description}</div>}
                {r.status !== "待查找" && (
                  <div className="mt-1 border-t border-dashed border-slate-200 pt-1 text-[13px] text-slate-400">
                    处理：{r.handledBy || "—"} · {r.handledAt}{r.note ? ` · ${r.note}` : ""}
                  </div>
                )}
              </div>
            </div>
            {r.status === "待查找" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={() => setConfirmReg({ ...r, __note: "" })}>📥 登记入总表</button>
                <button className="btn btn-sm" onClick={() => setFoundRep(r)}>✓ 已找到</button>
                <button className="btn btn-outline btn-sm" onClick={() => setConfirmIg({ ...r, __note: "" })}>忽略</button>
              </div>
            ) : (
              <div className="mt-3 text-right">
                <button className="btn btn-outline btn-sm" onClick={() => reopen(r)}>↩ 重新查找</button>
              </div>
            )}
          </div>
        ))}
        {reports.length === 0 && <div className="card py-10 text-center text-slate-400">没有报失记录</div>}
      </div>

      {/* 登记入总表确认 */}
      <ConfirmDanger open={!!confirmReg} onClose={() => setConfirmReg(null)} title="登记入总表"
        hint={`将此报失（${confirmReg?.itemName}）登记入失物总表，标记为患者报失。`}
        onConfirm={register} />
      {/* 忽略确认 */}
      <ConfirmDanger open={!!confirmIg} onClose={() => setConfirmIg(null)} title="忽略报失"
        hint="确定要忽略这条报失吗？忽略后可在「已忽略」里恢复。"
        onConfirm={ignore} />

      {/* 已找到 → 认领抽屉 */}
      <FoundClaimDrawer rep={foundRep} me={me} onClose={() => setFoundRep(null)}
        onDone={(msg) => { toast(msg, "success"); load(); setFoundRep(null); }} />

      {zoomPhotos && <PhotoZoom photos={zoomPhotos} start={0} onClose={() => setZoomPhotos(null)} />}
    </div>
  );
}

function FoundClaimDrawer({ rep, me, onClose, onDone }: { rep: any; me: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [group, setGroup] = useState("");
  const [gender, setGender] = useState("");
  const [time, setTime] = useState(nowLocalStr());
  const [verified, setVerified] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (rep) {
      setName(rep.ownerName || ""); setPhone(rep.ownerPhone || "");
      setGroup(""); setGender(""); setVerified(false); setPhotos([]); setTime(nowLocalStr());
    }
  }, [rep]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!verified) return toast("请勾选已核对物品特征", "error");
    setSubmitting(true);
    try {
      let claimerPhoto: string | undefined;
      const cam = photos.filter((p) => !p.filename && p.dataUrl);
      if (cam.length) {
        const blobs = await Promise.all(cam.map((p) => fetch(p.dataUrl!).then((r) => r.blob())));
        const files = blobs.map((b, i) => new File([b], `rc_${i}.jpg`, { type: "image/jpeg" }));
        claimerPhoto = (await uploadFiles(files))[0];
      }
      const d = await api(`/api/reports/${rep.id}/found-claim`, {
        method: "POST",
        body: JSON.stringify({ claimerName: name, claimerPhone: phone, claimerGroup: group, claimerGender: gender, claimedAt: time, featureVerified: verified, claimerPhoto }),
      });
      if (d.ok) onDone(d.msg); else toast(d.msg, "error");
    } finally { setSubmitting(false); }
  }

  if (!rep) return null;
  return (
    <Drawer open={!!rep} onClose={onClose} title="✓ 已找到 · 认领登记">
      <div className="mb-4 rounded-lg border border-sky-200 bg-brand-light p-4">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="tag tag-source">🙋 患者报失</span><span>报失#{rep.id}</span>
        </div>
        <div className="my-1.5 text-lg font-semibold">{rep.itemName}</div>
        {rep.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/upload/files/${rep.photo}`} className="max-h-44 rounded-lg border border-slate-200" alt="" />
        )}
        <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
          <div><span className="text-slate-500">类别：</span>{rep.itemCategory || "—"}</div>
          <div><span className="text-slate-500">丢失地点：</span>{rep.lostLocation || "—"}</div>
          <div className="col-span-2"><span className="text-slate-500">报失人：</span>{rep.ownerName} {rep.ownerPhone}</div>
          <div className="col-span-2 font-semibold text-red-600"><span className="font-normal text-slate-500">特征（请核对）：</span>{rep.description || "—"}</div>
        </div>
      </div>
      <form onSubmit={submit}>
        <div className="grid grid-cols-2 gap-3.5">
          <div><label className="lbl">认领人姓名 *</label><input className="inp" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div><label className="lbl">电话</label><input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div><label className="lbl">人群</label>
            <select className="inp" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">请选择</option>{["老人", "小孩", "青年", "中年", "其他"].map((g) => <option key={g}>{g}</option>)}
            </select></div>
          <div><label className="lbl">性别</label>
            <select className="inp" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">请选择</option><option value="男">男士</option><option value="女">女士</option>
            </select></div>
        </div>
        <div className="mt-3.5"><label className="lbl">认领时间</label><input type="datetime-local" className="inp" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <label className="mt-3.5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
          <span>我已核对物品特征无误</span>
        </label>
        <div className="mt-3.5">
          <label className="lbl">认领人照片 <span className="text-xs font-normal text-slate-400">（选填）</span></label>
          <PhotoPicker photos={photos} setPhotos={setPhotos} allowHide={false} />
        </div>
        <button className="btn mt-4 w-full" disabled={submitting}>{submitting ? "提交中..." : "✓ 确认已找到并认领"}</button>
      </form>
    </Drawer>
  );
}
