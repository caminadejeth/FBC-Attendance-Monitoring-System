import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  declare props: ErrorBoundaryProps;
  declare state: ErrorBoundaryState;
  declare setState: (
    partial:
      | Partial<ErrorBoundaryState>
      | ((prevState: ErrorBoundaryState) => Partial<ErrorBoundaryState>)
  ) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleResetAndReload = () => {
    try {
      localStorage.removeItem('fbc_current_user');
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF9F5] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border-2 border-zinc-950 shadow-2xl overflow-hidden">
            <div className="bg-zinc-950 text-amber-400 px-5 py-4 border-b-2 border-amber-400 flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="text-sm font-black uppercase tracking-wider">
                Application Recovery
              </h2>
            </div>
            <div className="p-5 space-y-4 text-zinc-900">
              <p className="text-xs font-bold text-zinc-700 leading-relaxed">
                Something went wrong while rendering this view. You can retry or reset your current session safely without losing saved cloud data.
              </p>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-mono text-rose-800 break-words">
                {this.state.errorMessage}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
                <button
                  type="button"
                  onClick={this.handleResetAndReload}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 border border-zinc-950 text-xs font-black uppercase cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Session & Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
