import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches errors from VnPlayer / PixiVnStage to prevent cascading crashes */
export class VnPlayerBoundary extends Component<
  { children: ReactNode; onFallback?: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onFallback?: () => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.warn('[VnPlayerBoundary] Caught:', error.message)
    this.props.onFallback?.()
  }

  render() {
    return this.props.children
  }
}


