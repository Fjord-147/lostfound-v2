"use client";
// 拾物登记抽屉：多照片+🔒+存放位置必填+登记人；AJAX 提交后回调刷新
import { useState } from "react";
import { Drawer, toast } from "./ui";
import PhotoPicker, { PickedPhoto } from "./PhotoPicker";
import { api, uploadFiles, dataUrlToBlob } from "@/lib/api";
import { CATEGORIES, LOCATIONS, nowLocalStr } from "@/lib/types";

export default function RegisterDrawer({
  open,
  onClose,
  me,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  me: string; // 当前真名
  onDone: (item: any) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [foundLocation, setFoundLocation] = useState(LOCATIONS[0]);
  const [locOther, setLocOther] = useState("");
  const [foundTime, setFoundTime] = useState(nowLocalStr());
  const [founder, setFounder] = useState("");
  const [registeredBy, setRegisteredBy] = useState("");
  const [storage, setStorage] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName(""); setDescription(""); setCategory(CATEGORIES[0]);
    setFoundLocation(LOCATIONS[0]); setLocOther("");
    setFoundTime(nowLocalStr()); setStorage(""); setPhotos([]);
  }

  function close() {
    if (name || description || storage || photos.length) {
      if (!confirm("表单已填写内容，确定要退出编辑吗？退出后内容将丢失。")) return;
    }
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!storage.trim()) return toast("请填写存放位置", "error");
    setSubmitting(true);
    try {
      // 1) 未上传的（拍照dataUrl）先传服务器（兼容写法，绕开老浏览器限制）
      const toUpload = photos.filter((p) => !p.filename && p.dataUrl);
      let uploaded: string[] = [];
      if (toUpload.length) {
        const blobs = toUpload.map((p) => dataUrlToBlob(p.dataUrl!));
        uploaded = await uploadFiles(blobs, "cam");
      }
      // 2) 组装文件名数组（保持 photos 顺序：先已上传的再新传的）
      const allNames: string[] = [];
      let ui = 0;
      for (const p of photos) {
        if (p.filename) allNames.push(p.filename);
        else allNames.push(uploaded[ui++] || "");
      }
      const hidden = photos.filter((p) => p.hidden).map((p) => p.filename).filter(Boolean) as string[];
      // 拍照隐藏的靠 index 对应（上传后才知道名字）——简化：拍照图不允许单独隐藏提示在前端
      const d = await api("/api/items", {
        method: "POST",
        body: JSON.stringify({
          name, category, description,
          foundLocation: foundLocation === "其他" ? locOther : foundLocation,
          foundTime, founder: founder || me, registeredBy: registeredBy || me,
          storageLocation: storage.trim(),
          photos: allNames.filter(Boolean),
          hiddenPhotos: hidden,
        }),
      });
      if (d.ok) {
        toast(`登记成功！编号 ${d.item.code}`, "success");
        reset();
        onDone(d.item);
        onClose();
      } else {
        toast(d.msg || "登记失败", "error");
      }
    } catch (e: any) {
      // 具体失败原因提示（上传/提交/兼容性任一环节崩了都能看到）
      toast(`提交失败：${e?.message || "未知错误"}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer open={open} onClose={close} title="📝 拾物登记">
      <form onSubmit={submit}>
        <div className="mb-3.5">
          <label className="lbl">物品名称 <span className="text-red-600">*</span></label>
          <input className="inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：黑色钱包" required />
        </div>
        <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className="lbl">类别</label>
            <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl">捡到地点</label>
            <select className="inp" value={foundLocation} onChange={(e) => setFoundLocation(e.target.value)}>
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
            {foundLocation === "其他" && (
              <input className="inp mt-1.5" value={locOther} onChange={(e) => setLocOther(e.target.value)} placeholder="手填地点" />
            )}
          </div>
        </div>
        <div className="mb-3.5">
          <label className="lbl">特征描述</label>
          <textarea className="inp min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="关键核对信息，如：内有医保卡一张" />
        </div>
        <div className="mb-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <label className="lbl">捡到时间</label>
            <input type="datetime-local" className="inp" value={foundTime} onChange={(e) => setFoundTime(e.target.value)} />
          </div>
          <div>
            <label className="lbl">捡到人</label>
            <input className="inp" value={founder} onChange={(e) => setFounder(e.target.value)} placeholder={me} />
          </div>
        </div>
        <div className="mb-3.5">
          <label className="lbl">登记人</label>
          <input className="inp" value={registeredBy} onChange={(e) => setRegisteredBy(e.target.value)} placeholder={me} />
        </div>
        <div className="mb-3.5">
          <label className="lbl">存放位置 <span className="text-red-600">*</span></label>
          <input className="inp" value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="如：导诊台2号抽屉、3号柜" />
        </div>
        <div className="mb-4">
          <label className="lbl">物品照片 <span className="text-xs font-normal text-slate-400">（可传多张；已上传图片点🔒可对公众隐藏）</span></label>
          <PhotoPicker
            photos={photos}
            setPhotos={setPhotos}
            hideHint="💡 点缩略图左下角 🔒 可隐藏单张照片（含证件等敏感图，公众看不到）"
          />
        </div>
        <button className="btn w-full" disabled={submitting}>
          {submitting ? "提交中..." : "✓ 提交登记"}
        </button>
      </form>
    </Drawer>
  );
}
