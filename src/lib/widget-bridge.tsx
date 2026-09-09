/**
 * GridStack mounts each widget via `createRoot()`, which is a *separate* React
 * tree — it does not inherit Router or Auth context from AppShell. Without this
 * bridge, `useNavigate()` / `useAuth()` throw and the error boundary paints
 * "This widget failed to render."
 *
 * `WidgetBridgeSync` runs inside the real app tree and copies the live
 * navigate + auth values into a module slot. `WidgetTreeProviders` re-provides
 * them around every createRoot render.
 */
import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { AuthContext, useAuth, type AuthContextValue } from "@/contexts/AuthContext";

type Bridge = {
  navigate: NavigateFunction;
  auth: AuthContextValue;
};

let bridge: Bridge | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

/** Mount once under AppShell (Dashboard + Case detail). Keeps the bridge fresh. */
export function WidgetBridgeSync() {
  const navigate = useNavigate();
  const auth = useAuth();

  // Assign during render so the very first createRoot paint already has auth/
  // navigate — an effect would run too late and widgets would crash on mount.
  const prev = bridge;
  if (!prev || prev.navigate !== navigate || prev.auth !== auth) {
    bridge = { navigate, auth };
  }

  useLayoutEffect(() => {
    notify();
    return () => {
      if (bridge?.navigate === navigate) {
        bridge = null;
        notify();
      }
    };
  }, [navigate, auth]);

  return null;
}

/** Wrap createRoot widget output so useAuth / useWidgetNavigate work. */
export function WidgetTreeProviders({ children }: { children: ReactNode }) {
  const [, bump] = useState(0);
  useEffect(() => subscribeWidgetBridge(() => bump((n) => n + 1)), []);

  const snap = bridge;
  if (!snap) return <>{children}</>;
  return <AuthContext.Provider value={snap.auth}>{children}</AuthContext.Provider>;
}

/** Drop-in for useNavigate() inside createRoot widget trees. */
export function useWidgetNavigate(): NavigateFunction {
  const fallback: NavigateFunction = ((to, opts) => {
    if (bridge?.navigate) return bridge.navigate(to, opts);
    if (typeof to === "number") {
      window.history.go(to);
      return;
    }
    const path = typeof to === "string" ? to : (to.pathname ?? "/");
    if (opts?.replace) window.location.replace(path);
    else window.location.assign(path);
  }) as NavigateFunction;
  return bridge?.navigate ?? fallback;
}

export function getWidgetBridge(): Bridge | null {
  return bridge;
}

/** Subscribe to bridge readiness — used if a host needs to remount after sync. */
export function subscribeWidgetBridge(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
