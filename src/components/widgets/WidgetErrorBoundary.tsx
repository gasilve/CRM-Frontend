import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/** Keeps one bad widget from blanking the whole dashboard GridStack host. */
export class WidgetErrorBoundary extends Component<
  { children: ReactNode; name?: string },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[widget] ${this.props.name ?? "unknown"} crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid h-full min-h-[3rem] place-items-center gap-1.5 p-4 text-center">
          <AlertTriangle size={16} strokeWidth={1.6} className="text-[#f59e0b]" />
          <span className="font-mono text-[0.65625rem] text-[var(--color-text-lo)]">
            This widget failed to render.
          </span>
        </div>
      );
    }
    return this.props.children;
  }
}
