'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logging/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  router?: ReturnType<typeof useRouter>;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * WYSHKIT 2026: Error Boundary for Checkout Flow
 * Catches errors in checkout components and displays user-friendly error message
 */
export class CheckoutErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('CheckoutErrorBoundary caught an error', error, undefined, { componentStack: errorInfo.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.router?.refresh();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-white p-4">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="size-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <AlertCircle className="size-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-900">Something went wrong</h2>
              <p className="text-sm text-zinc-600">
                We encountered an error while processing your checkout. Please try again.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <p className="text-xs text-red-500 mt-2 font-mono">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <Button
              onClick={this.handleReset}
              className="w-full"
              variant="default"
            >
              <RefreshCw className="size-4 mr-2" />
              Retry Checkout
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function CheckoutErrorBoundaryWithRouter(props: Omit<Props, 'router'>) {
  const router = useRouter();
  return <CheckoutErrorBoundary {...props} router={router} />;
}
