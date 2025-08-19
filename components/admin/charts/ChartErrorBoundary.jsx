'use client';

import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Error boundary component specifically designed for chart components
 * Provides graceful error handling and recovery options
 */
class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Chart Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { height = 300, title } = this.props;
      
      return (
        <div 
          className="w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50"
          style={{ height }}
        >
          <div className="text-center space-y-4 p-6">
            <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
            <div>
              <h3 className="text-sm font-medium text-gray-900">Chart Error</h3>
              <p className="text-xs text-gray-500 mt-1">
                {title ? `Failed to render ${title}` : 'Unable to display chart'}
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-2 text-xs text-gray-400">
                  <summary className="cursor-pointer">Error details</summary>
                  <pre className="mt-1 text-left overflow-auto max-w-xs">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="mt-2"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ChartErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  height: PropTypes.number,
  title: PropTypes.string
};

export { ChartErrorBoundary };