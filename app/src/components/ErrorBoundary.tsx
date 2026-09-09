import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-600/15 text-red-500">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold">Wystąpił błąd w tym module</h2>
          <p className="max-w-md text-sm text-zinc-400">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Spróbuj ponownie
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
