"use client";
// 认领抽屉：搜索定位 → 详情（照片可放大）→ 认领表单
// 防冒领：电话必填(11位手机号) / 自述特征≥10字 / 高价值类别强制拍照 /
//          患者报失手机号不一致需勾选原因 / 无特征物品提示补录
import { useEffect, useState } from "react";
import { Drawer, toast, PhotoZoom } from "./ui";
import PhotoPicker, { PickedPhoto } from "./PhotoPicker";
import { api, uploadFiles, dataUrlToBlob } from "@/lib/api";
import { photosOf, nowLocalStr, CATEGORY_ICONS, HIGH_VALUE_CATEGORIES } from "@/lib/types";

export default function ClaimDrawer({
  open,
  onClose,
  targetId,
  me,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  targetId: number | null; // 直接指定物品（总表/工作台点认领）
  me: string;
  onDone: (msg: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [target, setTarget] = useState<any>(null);
  const [reportPhone, setReportPhone] = useState<string | null>(null);
  const [claimerName, setClaimerName] = useState("");
  const [claimerPhone, setClaimerPhone] = useState("");
  const [claimerNote, setClaimerNote] = useState("");
  const [group, setGroup] = useState("");
  const [gender, setGender] = useState("");
  const [claimedAt, setClaimedAt] = useState(nowLocalStr());
  const [verified, setVerified] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [descTopUp, setDescTopUp] = useState(""); // 无特征物品：认领时补录登记特征
  const [mismatchReason, setMismatchReason] = useState("");
  const [mismatchNote, setMismatchNote] = useState("");
  const [zoom, setZoom] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 打开时重置；带 targetId 直接加载
  useEffect(() => {
    if (!open) return;
    setQ(""); setResults([]); setTarget(null); setReportPhone(null); setClaimerName("");
    setClaimerPhone(""); setClaimerNote(""); setGroup(""); setGender(""); setVerified(false);
    setPhotos([]); setClaimedAt(nowLocalStr()); setDescTopUp(""); setMismatchReason(""); setMismatchNote("");
    if (targetId) loadItem(targetId);
  }, [open, targetId]);

  async function loadItem(id: number) {
    const d = await api(`/api/items/${id}`);
    if (d.ok) {
      setTarget(d.item);
      setReportPhone(d.reportPhone || null);
      // 患者报失来源：认领人手机号默认回填报失手机号，自述特征默认引用
      // 患者报失时的原话——本人来领零填写；家属代领时改手机号会触发软拦截
      if (d.item.source === "患者报失") {
        setClaimerPhone(d.reportPhone || "");
        setClaimerNote(d.item.description || "");
      }
    }
  }

  async function search() {
    const d = await api(`/api/items?status=待认领${q ? `&q=${encodeURIComponent(q)}` : ""}`);
    if (d.ok) setResults(d.items);
  }

  useEffect(() => {
    if (open && !targetId) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!verified) return toast("请勾选已核对物品特征", "error");
    // 前端先行校验（后端有同款真闸门，这里只是友好提示）
    if (!/^1[3-9]\d{9}$/.test(claimerPhone.trim())) return toast("请填写认领人11位手机号（仅收手机号码）", "error");
    if (claimerNote.trim().length < 10) return toast("请填写认领人自述特征（至少10个字）", "error");
    if (highValue && photos.length === 0) return toast(`「${target.category}」类物品必须现场拍摄认领人照片`, "error");
    if (mismatchNeeded && !mismatchReason) return toast("认领手机号与报失手机号不一致，请勾选原因", "error");
    if (mismatchReason === "其他" && mismatchNote.trim().length < 2) return toast("选择「其他」请填写具体说明", "error");
    setSubmitting(true);
    try {
      let claimerPhoto: string | undefined;
      const toUpload = photos.filter((p) => !p.filename && p.dataUrl);
      if (toUpload.length) {
        const blobs = toUpload.map((p) => dataUrlToBlob(p.dataUrl!));
        claimerPhoto = (await uploadFiles(blobs, "cp"))[0];
      } else if (photos[0]?.filename) {
        claimerPhoto = photos[0].filename;
      }
      const d = await api(`/api/items/${target.id}/claim`, {
        method: "POST",
        body: JSON.stringify({
          claimerName, claimerPhone, claimerGroup: group, claimerGender: gender,
          claimedAt, featureVerified: verified, claimerPhoto, claimerNote,
          ...(descTopUp.trim().length >= 5 ? { description: descTopUp.trim() } : {}),
          ...(mismatchNeeded ? { claimMismatchReason: mismatchReason, claimMismatchNote: mismatchNote.trim() || undefined } : {}),
        }),
      });
      if (d.ok) {
        onDone(d.msg);
        onClose();
      } else toast(d.msg, "error");
    } catch (e: any) {
      toast(`提交失败：${e?.message || "未知错误"}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const tps = target ? photosOf(target) : [];
  const highValue = !!target && HIGH_VALUE_CATEGORIES.includes(target.category || "");
  // 患者报失来源：认领号码与报失号码不一致 → 软拦截（后端强制，前端提示）
  const mismatchNeeded =
    !!target && target.source === "患者报失" && !!reportPhone && claimerPhone.trim() !== "" && claimerPhone.trim() !== reportPhone;

  return (
    <Drawer open={open} onClose={onClose} title="🔍 认领登记">
      {/* 搜索 */}
      {!target && (
        <div className="mb-4">
          <label className="lbl">输入失物编号或名称定位</label>
          <div className="flex gap-2">
            <input
              className="inp"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
              placeholder="如：20260914-001 或 钱包"
            />
            <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={search}>搜索</button>
          </div>
          <div className="mt-3 space-y-2">
            {results.map((it) => (
              <div
                key={it.id}
                onClick={() => loadItem(it.id)}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-2.5 hover:bg-brand-light"
              >
                {it.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/upload/files/${photosOf(it)[0]}`} className="h-13 w-13 h-[52px] w-[52px] rounded object-cover" alt="" />
                ) : (
                  <div className="flex h-[52px] w-[52px] items-center justify-center rounded bg-slate-100 text-2xl">
                    {CATEGORY_ICONS[it.category || ""] || "📦"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-400">{it.code}</div>
                  <div className="font-semibold">{it.name}</div>
                  <div className="text-xs text-slate-500">{it.category} · {it.foundLocation || "—"}</div>
                </div>
                <span className="btn btn-sm btn-outline pointer-events-none">认领</span>
              </div>
            ))}
            {results.length === 0 && <div className="py-6 text-center text-sm text-slate-400">没有待认领物品</div>}
          </div>
        </div>
      )}

      {/* 详情 + 表单 */}
      {target && (
        <form onSubmit={submit}>
          <div className="mb-4 rounded-lg border border-sky-200 bg-brand-light p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>编号 {target.code}</span>
              <span className="tag tag-pending">待认领</span>
              {target.source === "患者报失" && <span className="tag tag-source">🙋 患者报失</span>}
            </div>
            <div className="my-1.5 text-lg font-semibold">{target.name}</div>
            {tps.length > 0 && (
              <div className="flex gap-2 overflow-x-auto">
                {tps.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={`/api/upload/files/${p}`}
                    onClick={() => setZoom(i)}
                    className="h-20 w-20 flex-shrink-0 cursor-zoom-in rounded-lg border border-slate-200 object-cover"
                    alt=""
                  />
                ))}
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div><span className="text-slate-500">类别：</span>{target.category || "—"}</div>
              <div><span className="text-slate-500">地点：</span>{target.foundLocation || "—"}</div>
              <div><span className="text-slate-500">存放：</span>{target.storageLocation || "—"}</div>
              <div><span className="text-slate-500">捡到人：</span>{target.founder || "—"}</div>
            </div>
            <div className="mt-2 text-sm">
              <span className="text-slate-500">特征（请核对）：</span>
              <div className="font-semibold text-red-600">{target.description || "—"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="lbl">认领人姓名 <span className="text-red-600">*</span></label>
              <input className="inp" value={claimerName} onChange={(e) => setClaimerName(e.target.value)} required />
            </div>
            <div>
              <label className="lbl">认领人手机号 <span className="text-red-600">*</span></label>
              <input className="inp" value={claimerPhone} onChange={(e) => setClaimerPhone(e.target.value)} inputMode="numeric" placeholder="11位手机号（谁领填谁的）" required />
            </div>
            <div>
              <label className="lbl">人群</label>
              <select className="inp" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">请选择</option>
                {["老人", "小孩", "青年", "中年", "其他"].map((g) => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">性别</label>
              <select className="inp" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">请选择</option>
                <option value="男">男士</option>
                <option value="女">女士</option>
              </select>
            </div>
          </div>
          <div className="mt-3.5">
            <label className="lbl">认领人自述特征 <span className="text-red-600">*</span> <span className="text-xs font-normal text-slate-400">（至少10字：颜色/品牌/内含物/磨损点，需与登记特征一致）</span></label>
            <textarea className="inp min-h-[70px]" value={claimerNote} onChange={(e) => setClaimerNote(e.target.value)} placeholder="如：蓝色折叠伞，伞柄缠了黄色胶带，伞面右下角有磨损" />
            {target.source === "患者报失" && (
              <div className="mt-1 text-xs leading-relaxed text-slate-400">
                🙋 患者报失物品已自动回填：手机号取自报失记录，自述特征引用报失原话（均可修改；家属代领请把手机号改成代领人的，系统会记录原因）。
              </div>
            )}
          </div>
          {/* 无特征物品：提醒并允许认领时补录 */}
          {!target.description && (
            <div className="mt-3.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5">
              <div className="text-[13px] font-semibold text-amber-800">⚠️ 该物品登记时未留特征描述</div>
              <div className="mb-1.5 mt-0.5 text-xs text-amber-700">建议现场问清物品特征补录后再核对认领（补录会存入登记信息）。</div>
              <textarea className="inp min-h-[60px]" value={descTopUp} onChange={(e) => setDescTopUp(e.target.value)} placeholder="补录登记特征（至少5字）" />
            </div>
          )}
          {/* 患者报失：号码不一致软拦截 */}
          {mismatchNeeded && (
            <div className="mt-3.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2.5">
              <div className="text-[13px] font-semibold text-orange-800">⚠️ 认领手机号与报失手机号（{reportPhone}）不一致</div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {["家属代领", "报失号码已换", "其他"].map((r) => (
                  <label key={r} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${mismatchReason === r ? "border-orange-500 bg-white font-semibold text-orange-700" : "border-orange-200 bg-white/60 text-slate-600"}`}>
                    <input type="radio" className="hidden" checked={mismatchReason === r} onChange={() => setMismatchReason(r)} />
                    {r}
                  </label>
                ))}
              </div>
              {mismatchReason === "其他" && (
                <input className="inp mt-2" value={mismatchNote} onChange={(e) => setMismatchNote(e.target.value)} placeholder="请填写具体说明" />
              )}
              <div className="mt-1.5 text-xs text-orange-600">选择原因并提交后，系统会记录此次不一致，请当面核实身份。</div>
            </div>
          )}
          <div className="mt-3.5">
            <label className="lbl">认领时间</label>
            <input type="datetime-local" className="inp" value={claimedAt} onChange={(e) => setClaimedAt(e.target.value)} />
          </div>
          <label className="mt-3.5 flex cursor-pointer items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            <span>我已核对物品特征无误</span>
          </label>
          <div className="mt-3.5">
            <label className="lbl">
              认领人照片 {highValue ? <span className="text-red-600">*</span> : <span className="text-xs font-normal text-slate-400">（选填）</span>}
              {highValue && <span className="text-xs font-normal text-slate-400">　「{target.category}」类物品必须现场拍照</span>}
            </label>
            <PhotoPicker photos={photos} setPhotos={setPhotos} allowHide={false} />
          </div>
          <button className="btn mt-4 w-full" disabled={submitting}>
            {submitting ? "提交中..." : "✓ 确认认领"}
          </button>
          {!highValue && <div className="mt-2 text-center text-xs text-slate-400">普通物品不传照片也能正常认领</div>}
        </form>
      )}

      {zoom !== null && <PhotoZoom photos={tps} start={zoom} onClose={() => setZoom(null)} />}
    </Drawer>
  );
}
