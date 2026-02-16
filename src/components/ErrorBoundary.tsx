'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { logger } from '@/lib/logging/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface InternalProps extends ErrorBoundaryProps {
  router: ReturnType<typeof useRouter>;
}

/**
 * Error Boundary Component (Wyshkit 2026 Pattern)
 * Catches runtime errors and displays user-friendly error messages
 * Prevents entire app crash from single component errors
 */
class ErrorBoundaryInternal extends React.Component<InternalProps, ErrorBoundaryState> {
  constructor(props: InternalProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[ErrorBoundary] Caught error', error, undefined, { componentStack: errorInfo.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    // WYSHKIT 2026: Use router.push('/') for SPA feel recovery
    this.props.router.push('/');
    this.handleReset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-white">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="size-16 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="size-8 text-red-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-zinc-900">Something went wrong</h1>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={this.handleReset}
                className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl"
              >
                <RefreshCw className="size-4 mr-2" />
                Try Again
              </Button>

              <Button
                onClick={this.handleReload}
                variant="outline"
                className="w-full h-12 border-zinc-200 text-zinc-600 font-bold rounded-xl"
              >
                Reload Page
              </Button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
              <details className="mt-6 text-left">
                <summary className="text-xs font-medium text-zinc-400 cursor-pointer hover:text-zinc-600">
                  Error Details (Dev Mode)
                </summary>
                <pre className="mt-2 p-3 bg-zinc-50 rounded-lg text-[10px] text-zinc-700 overflow-auto max-h-48 font-mono">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function ErrorBoundary(props: ErrorBoundaryProps) {
  const router = useRouter();
  return <ErrorBoundaryInternal {...props} router={router} />;
}
