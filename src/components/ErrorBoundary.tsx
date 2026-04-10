import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from "@/utils/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by boundary:', error, errorInfo);

    // SAIL Detection: Report error to the autonomous intelligence layer (non-critical)
    // Uses dynamic import so that missing SAIL tables or modules never cascade.
    try {
      import('../sail/detection/detectionSystem')
        .then(({ detectionSystem }) => {
          if (detectionSystem && typeof detectionSystem.detectError === 'function') {
            detectionSystem.detectError({
              message: error.message,
              stack: error.stack,
              component: errorInfo.componentStack?.split('\n')[1]?.trim() || 'unknown',
              url: window.location.href,
            }).catch(() => { /* SAIL detection is non-critical */ });
          }
        })
        .catch(() => { /* SAIL module not available — non-critical */ });
    } catch {
      // SAIL detection is entirely non-critical — never block error display
    }
  }

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                We encountered an unexpected error. Please try refreshing the page.
              </p>
              <Button onClick={this.handleRefresh} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}