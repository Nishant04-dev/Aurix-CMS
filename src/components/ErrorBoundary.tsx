import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-8 text-center">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 shadow-xl max-w-2xl">
            <h1 className="text-2xl font-bold text-destructive mb-4">Application Error</h1>
            <p className="text-muted-foreground mb-6">
              A runtime exception occurred in the component tree. This is likely due to missing or malformed database data.
            </p>
            <div className="bg-card p-4 rounded-lg border border-border text-left overflow-auto max-h-60 mb-6 font-mono text-xs">
              <p className="font-bold text-destructive mb-2">{this.state.error?.name}: {this.state.error?.message}</p>
              <pre className="text-muted-foreground">{this.state.error?.stack}</pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold hover:bg-primary/90 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
