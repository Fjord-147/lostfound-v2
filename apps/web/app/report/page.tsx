"use client";
// 公众报失页：姓名*电话*物品* + 类别/地点/特征/时间 + 照片（拍照/上传）
import { useState } from "react";
import Link from "next/link";
import { API, uploadFiles, dataUrlToBlob } from "@/lib/api";
import { CATEGORIES, LOCATIONS, nowLocalStr } from "@/lib/types";
import PhotoPicker, { PickedPhoto } from "@/components/PhotoPicker";

export default function ReportPage() {
  const [ownerName, setOwnerName] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [lostLocation, setLostLocation] = useState(LOCATIONS[0]);
  const [locOther, setLocOther] = useState("");
  const [description, setDescription] = useState("");
  const [lostTime, setLostTime] = useState(nowLocalStr());
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [agree, setAgree] = useState(false);
  const [ok, setOk] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOk("");
    setBusy(true);
    try {
      // 多张照片全部上传，逗号拼接存储（与失物端 photo 字段格式一致）
      let photo: string | undefined;
      const cam = photos.filter((p) => !p.filename && p.dataUrl);
      if (cam.length) {
        // 公众未登录：必须走公开上传端点
        const names = await uploadFiles(cam.map((p) => dataUrlToBlob(p.dataUrl!)), "rep", "/api/upload/public-photo");
        photo = names.join(",");
      }
      const res = await fetch(`${API}/api/public/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName, ownerPhone, itemName, itemCategory: category,
          lostLocation: lostLocation === "其他" ? locOther : lostLocation,
          description, lostTime, photo,
        }),
      });
      const d = await res.json();
      if (d.ok) {
        setOk(d.msg);
        setOwnerName(""); setOwnerPhone(""); setItemName(""); setDescription(""); setPhotos([]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setErr(d.msg || "提交失败");
    } catch (e: any) {
      // 透传真实原因（上传失败/未授权/网络异常），不再一律说"网络异常"误导用户
      setErr(`提交失败：${e?.message || "网络异常，请重试"}`);
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-3 pb-8">
      <nav className="sticky top-0 z-20 -mx-3 mb-1 flex items-center bg-gradient-to-r from-brand to-brand-dark px-3 py-2.5 text-white shadow">
        <Link href="/" className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-base no-underline">←</Link>
        <div className="truncate text-[15px] font-semibold">🏥 苏州和康中医医院 · 失物招领</div>
      </nav>

      <div className="py-4 text-center">
        <h1 className="text-xl font-bold text-brand-dark">📝 我要报失</h1>
        <p className="mt-1 text-[13px] text-slate-500">丢了东西？登记一下，我们会帮您留意</p>
      </div>

      {ok && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{ok}</div>
      )}
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{err}</div>
      )}

      <div className="card p-5">
        <form onSubmit={submit}>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div><label className="lbl">您的姓名 *</label><input className="inp" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required /></div>
            <div><label className="lbl">联系电话 *</label><input className="inp" type="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} required /></div>
          </div>
          <div className="mt-3.5"><label className="lbl">丢失物品名称 *</label><input className="inp" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="如：黑色钱包、医保卡" required /></div>
          <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <label className="lbl">物品类别</label>
              <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl">丢失地点</label>
              <select className="inp" value={lostLocation} onChange={(e) => setLostLocation(e.target.value)}>
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
              {lostLocation === "其他" && <input className="inp mt-1.5" value={locOther} onChange={(e) => setLocOther(e.target.value)} placeholder="手填地点" />}
            </div>
          </div>
          <div className="mt-3.5">
            <label className="lbl">物品特征描述</label>
            <textarea className="inp min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="描述越详细越容易找到，如：内有医保卡一张、钥匙两把" />
          </div>
          <div className="mt-3.5">
            <label className="lbl">丢失时间（大约）</label>
            <input type="datetime-local" className="inp" value={lostTime} onChange={(e) => setLostTime(e.target.value)} />
          </div>
          <div className="mt-3.5">
            <label className="lbl">物品照片 <span className="text-xs font-normal text-slate-400">（选填，手机点「上传」可直接调起相机）</span></label>
            <PhotoPicker photos={photos} setPhotos={setPhotos} allowHide={false} />
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm">
            <input type="checkbox" className="h-5 w-5" checked={agree} onChange={(e) => setAgree(e.target.checked)} required />
            <span>我承诺所填信息真实，便于导医联系核对认领。</span>
          </label>
          <div className="mt-4 flex gap-3">
            <Link href="/" className="btn btn-outline flex-1 no-underline">返回</Link>
            <button className="btn flex-[2]" disabled={busy}>{busy ? "提交中..." : "✓ 提交报失"}</button>
          </div>
        </form>
      </div>

      <div className="card mt-4 border-amber-200 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-800">
        <strong>⚠️ 温馨提示</strong>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
          <li>您填写的信息仅门诊导医台可见，不会公开展示。</li>
          <li>报失后仍建议您主动到导医台询问，或定期查看失物招领列表。</li>
          <li>认领时需本人到场，核对物品特征无误后归还。</li>
        </ul>
      </div>
    </div>
  );
}
