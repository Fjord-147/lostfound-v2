"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const pwdRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 已登录访问 /login → 直接进管理端
  useEffect(() => {
    api("/api/auth/me").then((d) => {
      if (d.ok) router.replace("/admin");
    });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const d = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      if (d.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setErr(d.msg || "登录失败");
        setPassword(""); // 密码清空重输，账号保留
        pwdRef.current?.focus();
      }
    } catch {
      setErr("网络异常，请检查网络后重试");
    } finally {
      setLoading(false); // 无论如何都解除"登录中"
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand to-brand-dark p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-9 shadow-2xl">
        <h1 className="text-center text-xl font-bold text-brand-dark">🏥 苏州和康中医医院</h1>
        <div className="mb-6 mt-1 text-center text-[13px] text-slate-400">失物招领管理系统</div>
        {err && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
            {err}
          </div>
        )}
        <form onSubmit={submit}>
          <div className="mb-4">
            <label className="lbl">账号</label>
            <input className="inp" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <div className="mb-6">
            <label className="lbl">密码</label>
            <input ref={pwdRef} className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn w-full" disabled={loading}>
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
        <div className="mt-5 text-center">
          <a href="/" className="text-[13px] text-slate-400 hover:text-brand">← 返回失物招领首页</a>
        </div>
      </div>
    </div>
  );
}
