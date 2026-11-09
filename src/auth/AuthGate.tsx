import React, { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import "./auth.css";

type User = { id: string; name: string; email: string };
type ShopData = {
  products: unknown[];
  customers: unknown[];
  sales: unknown[];
  expenses: unknown[];
  vendors: unknown[];
  purchases: unknown[];
  stockMoves: unknown[];
  seasons: unknown[];
  [key: string]: unknown;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const LEGACY_KEY = "dukaan-ledger-web-v1";
const dirtyKey = (userId: string) => "dukaan-ledger-dirty:" + userId;
const EMPTY_DATA: ShopData = {
  products: [], customers: [], sales: [], expenses: [],
  vendors: [], purchases: [], stockMoves: [], seasons: [],
};

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "The request could not be completed.");
  return body;
}

function oidcReturnTarget() {
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  if (!candidate) return null;
  try {
    const target = new URL(candidate);
    return target.origin === new URL(API_URL).origin && target.pathname.startsWith("/oidc/interaction/") ? target.toString() : null;
  } catch { return null; }
}

function resumeOidc() {
  const target = oidcReturnTarget();
  if (target) window.location.assign(target);
}

function hasShopData(value: unknown): value is ShopData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return ["products", "customers", "sales", "expenses", "vendors", "purchases", "stockMoves", "seasons"]
    .every((key) => Array.isArray(data[key]));
}

function AccountAuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [importData, setImportData] = useState<ShopData | null>(null);
  const [conflictData, setConflictData] = useState<ShopData | null>(null);
  const [cloudData, setCloudData] = useState<ShopData | null>(null);
  const [cloudRevision, setCloudRevision] = useState(0);
  const revisionRef = useRef(0);
  const [syncState, setSyncState] = useState<"synced" | "saving" | "offline" | "conflict">("synced");
  const googleButton = useRef<HTMLDivElement>(null);
  const googleCallback = useRef<(credential: string) => void>(() => undefined);

  const loadCsrf = useCallback(async () => {
    const result = await api("/api/auth/csrf");
    setCsrfToken(result.csrfToken);
    return result.csrfToken as string;
  }, []);

  const saveShopData = useCallback(async (data: ShopData, currentRevision: number, token: string) => {
    return api("/api/data", {
      method: "PUT",
      headers: { "X-CSRF-Token": token },
      body: JSON.stringify({ data, revision: currentRevision }),
    });
  }, []);

  const activateAccount = useCallback(async (account: User, token: string) => {
    localStorage.setItem("dukaan-active-user-id", account.id);
    localStorage.setItem("dukaan-active-user-name", account.name);
    const remote = await api("/api/data");
    if (remote.data) {
      const accountKey = LEGACY_KEY + ":" + account.id;
      const dirty = localStorage.getItem(dirtyKey(account.id)) === "1";
      let localCopy: ShopData | null = null;
      try {
        const cached = JSON.parse(localStorage.getItem(accountKey) || "null");
        if (hasShopData(cached)) localCopy = cached;
      } catch {
        localCopy = null;
      }
      revisionRef.current = Number(remote.revision || 0);
      if (dirty && localCopy) {
        setConflictData(localCopy);
        setCloudData(remote.data);
        setCloudRevision(Number(remote.revision || 0));
        setImportData(null);
        setUser(account);
        return true;
      }
      localStorage.setItem(accountKey, JSON.stringify(remote.data));
      localStorage.removeItem(dirtyKey(account.id));
      setConflictData(null);
      setCloudData(null);
      setImportData(null);
      setUser(account);
      return false;
    }
    let legacy: ShopData | null = null;
    try {
      const parsed = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      if (hasShopData(parsed)) legacy = parsed;
    } catch {
      legacy = null;
    }
    if (legacy) {
      setImportData(legacy);
      revisionRef.current = 0;
      setUser(account);
      return true;
    }
    localStorage.setItem(LEGACY_KEY + ":" + account.id, JSON.stringify(EMPTY_DATA));
    const saved = await saveShopData(EMPTY_DATA, 0, token);
    revisionRef.current = Number(saved.revision || 1);
    setImportData(null);
    setUser(account);
    return false;
  }, [saveShopData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await loadCsrf();
        const result = await api("/api/auth/me");
        if (!cancelled) {
          const needsImport = await activateAccount(result.user, token);
          if (!needsImport) resumeOidc();
        }
      } catch (reason) {
        if (!cancelled) {
          const message = reason instanceof Error ? reason.message : "";
          if (!message.includes("Authentication required") && !message.includes("Session expired")) {
            setError(message);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activateAccount, loadCsrf]);

  const finishSignIn = useCallback(async (path: string, payload: unknown) => {
    setSubmitting(true);
    setError("");
    try {
      const token = csrfToken || await loadCsrf();
      const result = await api(path, {
        method: "POST",
        headers: { "X-CSRF-Token": token },
        body: JSON.stringify(payload),
      });
      setCsrfToken(token);
      const needsImport = await activateAccount(result.user, token);
      if (!needsImport) resumeOidc();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }, [activateAccount, csrfToken, loadCsrf]);

  googleCallback.current = (credential) => {
    void finishSignIn("/api/auth/google", { credential });
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButton.current || user || importData) return;
    let cancelled = false;
    const render = () => {
      if (cancelled || !window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => googleCallback.current(response.credential),
      });
      googleButton.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButton.current, {
        theme: "outline", size: "large", shape: "rectangular", width: 320,
        text: "continue_with", logo_alignment: "left",
      });
    };
    if (window.google) render();
    else {
      const script = document.querySelector<HTMLScriptElement>('script[data-google-identity="true"]')
        || document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
      script.onload = render;
      if (!script.parentNode) document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [user, importData]);

  useEffect(() => {
    if (!user || importData || conflictData) return;
    let timer: number | undefined;
    let saving = false;
    let pending: ShopData | null = null;
    const handleUpdate = (event: Event) => {
      const custom = event as CustomEvent<ShopData>;
      pending = custom.detail;
      localStorage.setItem(dirtyKey(user.id), "1");
      setSyncState("saving");
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        if (!pending || saving) return;
        saving = true;
        const current = pending;
        pending = null;
        try {
          const result = await saveShopData(current, revisionRef.current, csrfToken);
          revisionRef.current = Number(result.revision);
          localStorage.removeItem(dirtyKey(user.id));
          setSyncState("synced");
        } catch (reason) {
          const message = reason instanceof Error ? reason.message : "";
          if (message.includes("another session")) {
            try {
              const remote = await api("/api/data");
              let latestLocal: ShopData | null = null;
              try {
                const cached = JSON.parse(localStorage.getItem(LEGACY_KEY + ":" + user.id) || "null");
                if (hasShopData(cached)) latestLocal = cached;
              } catch {
                latestLocal = null;
              }
              setConflictData(latestLocal || current);
              setCloudData(remote.data);
              setCloudRevision(Number(remote.revision || 0));
              revisionRef.current = Number(remote.revision || 0);
              setSyncState("conflict");
            } catch {
              setSyncState("offline");
            }
          } else {
            setSyncState("offline");
          }
        } finally {
          saving = false;
          if (pending) handleUpdate(new CustomEvent("dukaan:data-updated", { detail: pending }));
        }
      }, 800);
    };
    window.addEventListener("dukaan:data-updated", handleUpdate);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("dukaan:data-updated", handleUpdate);
    };
  }, [user, importData, conflictData, csrfToken, saveShopData]);

  useEffect(() => {
    const handleLogout = async () => {
      let token = csrfToken;
      try {
        if (!token) token = await loadCsrf();
      } catch {
        // Continue with local sign-out if the API is unavailable.
      }
      if (token && user && !conflictData) {
        try {
          const cached = localStorage.getItem(LEGACY_KEY + ":" + user.id);
          if (cached) {
            const data = JSON.parse(cached) as ShopData;
            const saved = await saveShopData(data, revisionRef.current, token);
            revisionRef.current = Number(saved.revision || revisionRef.current);
            localStorage.removeItem(dirtyKey(user.id));
          }
        } catch {
          // Keep the dirty marker so the next login can resolve local/cloud versions.
        }
      }
      if (token) {
        try {
          await api("/api/auth/logout", { method: "POST", headers: { "X-CSRF-Token": token } });
        } catch {
          // The server session expires naturally if the network is unavailable.
        }
      }
      localStorage.removeItem("dukaan-active-user-id");
      localStorage.removeItem("dukaan-active-user-name");
      setUser(null);
      setImportData(null);
      setConflictData(null);
      setCloudData(null);
      setPassword("");
      revisionRef.current = 0;
    };
    window.addEventListener("dukaan:logout", handleLogout);
    return () => window.removeEventListener("dukaan:logout", handleLogout);
  }, [csrfToken, loadCsrf, user, conflictData, saveShopData]);

  async function importExistingData() {
    if (!importData) return;
    setSubmitting(true);
    try {
      const result = await saveShopData(importData, 0, csrfToken);
      localStorage.setItem(LEGACY_KEY + ":" + user?.id, JSON.stringify(importData));
      revisionRef.current = Number(result.revision || 1);
      if (user) localStorage.removeItem(dirtyKey(user.id));
      setImportData(null);
      resumeOidc();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not import existing data.");
    } finally {
      setSubmitting(false);
    }
  }

  async function startFresh() {
    if (!user) return;
    setSubmitting(true);
    try {
      const result = await saveShopData(EMPTY_DATA, 0, csrfToken);
      localStorage.setItem(LEGACY_KEY + ":" + user.id, JSON.stringify(EMPTY_DATA));
      revisionRef.current = Number(result.revision || 1);
      localStorage.removeItem(dirtyKey(user.id));
      setImportData(null);
      resumeOidc();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your shop.");
    } finally {
      setSubmitting(false);
    }
  }

  async function useCloudVersion() {
    if (!user || !cloudData) return;
    localStorage.setItem(LEGACY_KEY + ":" + user.id, JSON.stringify(cloudData));
    localStorage.removeItem(dirtyKey(user.id));
    revisionRef.current = cloudRevision;
    setConflictData(null);
    setCloudData(null);
    setSyncState("synced");
    resumeOidc();
  }

  async function keepDeviceVersion() {
    if (!user || !conflictData) return;
    setSubmitting(true);
    setError("");
    try {
      const saved = await saveShopData(conflictData, cloudRevision, csrfToken);
      localStorage.setItem(LEGACY_KEY + ":" + user.id, JSON.stringify(conflictData));
      localStorage.removeItem(dirtyKey(user.id));
      revisionRef.current = Number(saved.revision || cloudRevision + 1);
      setConflictData(null);
      setCloudData(null);
      setSyncState("synced");
      resumeOidc();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not resolve the sync conflict.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="auth-loading"><div className="auth-spinner" /><span>Connecting to your shop…</span></div>;
  }

  if (user && conflictData) {
    const localRecords = Object.values(conflictData).reduce<number>((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
    const cloudRecords = Object.values(cloudData || {}).reduce<number>((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
    return (
      <div className="auth-page">
        <section className="auth-card auth-import-card">
          <div className="auth-brand"><span className="auth-brand-mark">द</span><span>Dukaan Ledger</span></div>
          <div className="auth-eyebrow">SYNC NEEDS ATTENTION</div>
          <h1>Choose which shop data to keep</h1>
          <p>This device has unsynced changes, and the cloud copy has also changed. Choose one version before opening your dashboard.</p>
          <div className="auth-conflict-options">
            <div><strong>This device</strong><span>{localRecords} records · local changes</span></div>
            <div><strong>Cloud account</strong><span>{cloudRecords} records · latest saved copy</span></div>
          </div>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={submitting || !cloudData} onClick={() => void useCloudVersion()}>
            Use cloud version
          </button>
          <button className="auth-secondary" disabled={submitting} onClick={() => void keepDeviceVersion()}>
            {submitting ? "Saving…" : "Keep this device's version"}
          </button>
          <small>Your device copy is not discarded unless you choose the cloud version.</small>
        </section>
      </div>
    );
  }

  if (user && importData) {
    const recordCount = Object.values(importData).reduce<number>((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
    return (
      <div className="auth-page">
        <section className="auth-card auth-import-card">
          <div className="auth-brand"><span className="auth-brand-mark">द</span><span>Dukaan Ledger</span></div>
          <div className="auth-eyebrow">ACCOUNT SETUP</div>
          <h1>Bring your existing shop data?</h1>
          <p>We found {recordCount} existing records in this browser. You can import them into {user.name}'s account or start with an empty shop.</p>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="auth-submit" disabled={submitting} onClick={() => void importExistingData()}>
            {submitting ? "Importing…" : "Import existing shop data"}
          </button>
          <button className="auth-secondary" disabled={submitting} onClick={() => void startFresh()}>
            Start with an empty shop
          </button>
          <small>Your old browser copy is kept as a backup. Imported data becomes private to this account.</small>
        </section>
      </div>
    );
  }

  if (user) {
    return (
      <>
        <div className="account-sync-indicator" title={syncState === "synced" ? "All changes saved" : syncState}>
          <span className={"sync-dot " + syncState} />
          {syncState === "synced" ? "Synced" : syncState === "saving" ? "Saving…" : syncState === "conflict" ? "Sync conflict" : "Offline"}
          <span className="account-sync-email">{user.email}</span>
          <button className="account-signout" onClick={() => window.dispatchEvent(new Event("dukaan:logout"))}>Sign out</button>
        </div>
        {children}
      </>
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void finishSignIn(
      mode === "login" ? "/api/auth/login" : "/api/auth/register",
      mode === "login" ? { email, password } : { name, email, password }
    );
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-brand"><span className="auth-brand-mark">द</span><span>Dukaan Ledger</span></div>
        <div className="auth-eyebrow">YOUR SHOP, IN SYNC</div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-intro">Securely manage your shop, wherever you work.</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={submit} className="auth-form">
          {mode === "register" && (
            <label className="auth-field">
              <span>Full name</span>
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} placeholder="Your name" />
            </label>
          )}
          <label className="auth-field">
            <span>Email address</span>
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} placeholder="you@example.com" />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "login" ? 1 : 10} maxLength={128} placeholder={mode === "register" ? "At least 10 characters" : "Your password"} />
          </label>
          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        {GOOGLE_CLIENT_ID && (
          <>
            <div className="auth-divider"><span>or continue with</span></div>
            <div className="google-signin-slot" ref={googleButton} />
          </>
        )}
        <p className="auth-switch">
          {mode === "login" ? "New to Dukaan Ledger?" : "Already have an account?"}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="auth-security-note"><span>🔒</span> Your shop records are private to your account.</p>
      </section>
    </div>
  );
}

export default AccountAuthGate;
