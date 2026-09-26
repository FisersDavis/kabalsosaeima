import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[kabalsosaeima.lv] Uncaught UI Exception:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-lg space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-900">
                Pārlūka attēlošanas kļūda
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Radās neparedzēta kļūda datu attēlošanā. Lūdzu, pārlādējiet lapu, lai atjaunotu stabilo stāvokli.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="rounded-lg bg-slate-100 p-2.5 text-left text-[11px] font-mono text-slate-700 overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Pārlādēt lapu</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
