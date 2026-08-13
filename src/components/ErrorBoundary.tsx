// Error Boundary component for handling React errors gracefully
import React, { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call the optional error handler
    this.props.onError?.(error, errorInfo);

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              An unexpected error occurred in the face tracking application.
            </p>
            
            {this.state.error && (
              <details className="mb-4 bg-gray-50 p-3 rounded text-sm">
                <summary className="cursor-pointer font-semibold text-gray-700">
                  Error details
                </summary>
                <pre className="mt-2 text-red-700 overflow-auto max-h-40">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}

            {this.state.errorInfo && (
              <details className="mb-4 bg-gray-50 p-3 rounded text-sm">
                <summary className="cursor-pointer font-semibold text-gray-700">
                  Stack trace
                </summary>
                <pre className="mt-2 text-gray-700 overflow-auto max-h-40">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.reset}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
