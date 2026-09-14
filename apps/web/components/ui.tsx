"use client";
// 基础组件：Modal / Drawer / 危险确认（输"确认"）/ 照片放大器 / toast
import { useEffect, useRef, useState, useCallback } from "react";

/* ============ Modal ============ */
export function Modal({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[86vh] overflow-y-auto rounded-xl bg-white p-6 ${wide ? "w-full max-w-2xl" : "w-full max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ============ Drawer 抽屉 ============ */
export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-mask fixed inset-0 z-[280] bg-black/40" onClick={onClose}>
      <div
        className="drawer-panel absolute right-0 top-0 flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-brand-light px-5 py-4">
          <h2 className="text-[17px] font-semibold text-brand-dark">{title}</h2>
          <button
            onClick={onClose}
            className="text-3xl leading-none text-slate-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* ============ 危险确认（必须输"确认"二字） ============ */
export function ConfirmDanger({
  open,
  onClose,
  title,
  hint,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint: string;
  onConfirm: () => void;
}) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) setText("");
  }, [open]);
  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-center">
        <div className="mb-2 text-4xl">⚠️</div>
        <div className="mb-2 text-lg font-semibold">{title}</div>
        <div className="mb-4 text-sm text-slate-500">{hint}</div>
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-700">
          请在下方输入框输入 <strong>确认</strong> 二字才会执行
        </div>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="输入 确认"
          className="inp mb-4 text-center"
        />
        <div className="flex gap-3">
          <button className="btn btn-outline flex-1" onClick={onClose}>
            取消
          </button>
          <button
            className="btn flex-1 bg-red-600 from-red-600 to-red-700"
            disabled={text.trim() !== "确认"}
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            确定执行
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ============ 照片放大器（缩放/还原/上下张/滚轮/键盘） ============ */
export function PhotoZoom({
  photos,
  start,
  onClose,
}: {
  photos: string[]; // 文件名数组（原图，需登录）
  start: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(start);
  const [scale, setScale] = useState(1);
  const ref = useRef<HTMLDivElement>(null);
  const step = useCallback((d: number) => {
    if (photos.length <= 1) return;
    setIdx((i) => (i + d + photos.length) % photos.length);
    setScale(1);
  }, [photos.length]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, step]);
  if (!photos.length) return null;
  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-black/95">
      <div className="flex items-center gap-2 bg-black/50 px-4 py-2.5 text-white">
        <button className="h-9 w-9 rounded-md bg-white/15 text-lg hover:bg-white/30" onClick={() => setScale((s) => Math.max(0.2, s - 0.2))}>➖</button>
        <span className="min-w-[50px] text-center text-sm">{Math.round(scale * 100)}%</span>
        <button className="h-9 w-9 rounded-md bg-white/15 text-lg hover:bg-white/30" onClick={() => setScale((s) => Math.min(5, s + 0.2))}>➕</button>
        <button className="h-9 w-9 rounded-md bg-white/15 text-lg hover:bg-white/30" onClick={() => setScale(1)}>⟲</button>
        {photos.length > 1 && (
          <>
            <span className="mx-2 text-sm text-white/70">{idx + 1}/{photos.length}</span>
            <button className="h-9 w-9 rounded-md bg-white/15 text-lg hover:bg-white/30" onClick={() => step(-1)}>‹</button>
            <button className="h-9 w-9 rounded-md bg-white/15 text-lg hover:bg-white/30" onClick={() => step(1)}>›</button>
          </>
        )}
        <button className="ml-auto rounded-md bg-red-600 px-3 py-2 text-sm hover:bg-red-700" onClick={onClose}>✕ 关闭</button>
      </div>
      <div
        ref={ref}
        className="flex flex-1 items-center justify-center overflow-auto p-5"
        onWheel={(e) => {
          e.preventDefault();
          setScale((s) => Math.max(0.2, Math.min(5, s + (e.deltaY < 0 ? 0.15 : -0.15))));
        }}
        onClick={(e) => e.target === ref.current && onClose()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/upload/files/${photos[idx]}`}
          alt="照片"
          className="max-h-full max-w-[92%] select-none transition-transform"
          style={{ transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}

/* ============ Toast ============ */
let toastFn: ((msg: string, type?: string) => void) | null = null;
export function toast(msg: string, type = "info") {
  toastFn?.(msg, type);
}
export function ToastHost() {
  const [list, setList] = useState<{ id: number; msg: string; type: string }[]>([]);
  useEffect(() => {
    toastFn = (msg, type = "info") => {
      const id = Date.now() + Math.random();
      setList((l) => [...l, { id, msg, type }]);
      setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 2600);
    };
    return () => {
      toastFn = null;
    };
  }, []);
  return (
    <div className="pointer-events-none fixed left-1/2 top-5 z-[500] -translate-x-1/2 space-y-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-5 py-3 text-[15px] text-white shadow-lg ${
            t.type === "error"
              ? "bg-red-600"
              : t.type === "success"
                ? "bg-green-600"
                : "bg-brand"
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
