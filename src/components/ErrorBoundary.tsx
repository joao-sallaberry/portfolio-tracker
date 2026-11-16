// SPDX-License-Identifier: AGPL-3.0-or-later

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Clears the error when it changes (e.g. the route), so navigating away recovers. */
  resetKey?: string;
  /** Fills the whole screen (errors outside the app layout). */
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** Shows a recovery screen instead of a blank page when rendering throws. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro ao renderizar a página:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    // After a deploy, the chunks of the page the user had open no longer exist on the server
    const staleChunk = /dynamically imported module|Importing a module script failed/i.test(error.message);

    return (
      <div
        role="alert"
        className={
          this.props.fullScreen
            ? 'flex min-h-screen items-center justify-center bg-background p-4'
            : 'flex min-h-[50vh] items-center justify-center'
        }
      >
        <div className="max-w-md space-y-4 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="text-2xl font-bold">Algo deu errado</h1>
          <p className="text-muted-foreground">
            {staleChunk
              ? 'Uma nova versão do aplicativo foi publicada. Recarregue a página para continuar.'
              : 'Ocorreu um erro inesperado ao exibir esta página. Seus dados não foram alterados.'}
          </p>
          {!staleChunk && <p className="wrap-break-word font-mono text-xs text-muted-foreground">{error.message}</p>}
          <div className="flex justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Recarregar a página</Button>
            {!staleChunk && (
              <Button variant="outline" onClick={() => window.location.assign('/')}>
                Ir para a Visão Geral
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
