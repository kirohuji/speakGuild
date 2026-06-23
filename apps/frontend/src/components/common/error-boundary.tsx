import { Component, type ReactNode, type ErrorInfo } from 'react'
import { ErrorState } from '@/components/common/error-state'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] 捕获渲染错误:', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <ErrorState
          title="页面出错了"
          description={this.state.error?.message || '发生了未知错误，请重试'}
          onRetry={this.handleRetry}
          className="min-h-[60dvh]"
        />
      )
    }

    return this.props.children
  }
}
