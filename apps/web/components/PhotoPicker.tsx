"use client";
// 多照片选择器：拍照（摄像头）/上传 + 缩略图 + 单张🔒隐藏 + 删除
// photos: 文件名数组；hidden: 隐藏文件名集合；最终由父组件提交
import { useEffect, useRef, useState } from "react";
import { toast } from "./ui";

export interface PickedPhoto {
  filename?: string; // 已上传（编辑场景回显）
  dataUrl?: string; // 拍照 base64（待提交）
  preview: string;
  hidden: boolean;
}

export default function PhotoPicker({
  photos,
  setPhotos,
  allowHide = true,
  hideHint,
}: {
  photos: PickedPhoto[];
  setPhotos: (p: PickedPhoto[]) => void;
  allowHide?: boolean;
  hideHint?: string;
}) {
  const [tab, setTab] = useState<"camera" | "upload">("camera");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // 摄像头开关
  useEffect(() => {
    if (tab === "camera") {
      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: "environment" } })
        .then((s) => {
          streamRef.current = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(() => {
          toast("无法打开摄像头，请改用上传图片", "warn");
          setTab("upload");
        });
    } else {
      stopCam();
    }
    return () => stopCam();
  }, [tab]);

  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return toast("摄像头还没准备好", "warn");
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    setPhotos([...photos, { dataUrl, preview: dataUrl, hidden: false }]);
    toast(`已抓拍第 ${photos.length + 1} 张`, "success");
  }

  function pickFiles(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    let loaded = 0;
    const next = [...photos];
    for (const f of arr) {
      const r = new FileReader();
      r.onload = (e) => {
        next.push({ dataUrl: e.target?.result as string, preview: e.target?.result as string, hidden: false });
        if (++loaded === arr.length) setPhotos([...next]);
      };
      r.readAsDataURL(f);
    }
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3">
      {hideHint && <div className="mb-2 text-xs text-slate-500">{hideHint}</div>}
      <div className="mb-2 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => setTab("camera")}
          className={`rounded-full px-4 py-1.5 text-[13px] ${tab === "camera" ? "bg-brand text-white" : "bg-slate-200 text-slate-600"}`}
        >
          📷 拍照
        </button>
        <button
          type="button"
          onClick={() => setTab("upload")}
          className={`rounded-full px-4 py-1.5 text-[13px] ${tab === "upload" ? "bg-brand text-white" : "bg-slate-200 text-slate-600"}`}
        >
          📁 上传
        </button>
      </div>

      {tab === "camera" ? (
        <div className="text-center">
          <video ref={videoRef} autoPlay playsInline className="mx-auto max-h-56 w-full rounded-lg" />
          <button type="button" className="btn btn-sm mt-2" onClick={capture}>
            📸 抓拍（可连拍多张）
          </button>
        </div>
      ) : (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="inp"
          onChange={(e) => {
            pickFiles(e.target.files);
            e.target.value = "";
          }}
        />
      )}

      {photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <div key={i} className="relative h-[72px] w-[72px] overflow-hidden rounded-md border border-slate-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.preview}
                alt=""
                className={`h-full w-full object-cover ${p.hidden ? "opacity-35" : ""}`}
              />
              <button
                type="button"
                className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500/90 text-[15px] leading-none text-white"
                onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
              >
                ×
              </button>
              {allowHide && (
                <button
                  type="button"
                  title={p.hidden ? "已隐藏（公众看不到），点击取消" : "公众可见，点击隐藏（敏感图）"}
                  className="absolute bottom-0.5 left-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white/90 text-[11px]"
                  onClick={() =>
                    setPhotos(photos.map((q, j) => (j === i ? { ...q, hidden: !q.hidden } : q)))
                  }
                >
                  {p.hidden ? "🔒" : "🔓"}
                </button>
              )}
              {p.hidden && (
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-white/90 px-1 text-[10px] font-semibold text-red-600">
                  已隐藏
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
