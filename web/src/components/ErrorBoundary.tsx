import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to your error tracker (Sentry, LogRocket, etc.)
    // For now log to console so devs can still inspect.
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  handleHome = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const isDev = import.meta.env.DEV

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#e2e8f0] p-6 text-center shadow-sm">
          <div className="text-[48px] mb-3">⚠</div>
          <h1 className="text-[18px] font-bold text-[#111] mb-1">Terjadi Kesalahan</h1>
          <p className="text-[13px] text-[#666] mb-5">
            Maaf, ada gangguan saat memuat halaman. Coba muat ulang atau kembali ke beranda.
          </p>

          {isDev && this.state.error && (
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-xl p-3 mb-4 text-left">
              <p className="text-[10px] font-bold text-[#b91c1c] uppercase tracking-wide mb-1">Dev Info</p>
              <p className="text-[11px] text-[#7f1d1d] font-mono break-words">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={this.handleHome}
              className="flex-1 bg-[#f1f5f9] text-[#555] text-[13px] font-semibold py-2.5 rounded-xl active:bg-[#e2e8f0]"
            >
              Beranda
            </button>
            <button
              onClick={this.handleReload}
              className="flex-1 bg-[#1E4FD8] text-white text-[13px] font-semibold py-2.5 rounded-xl active:bg-[#1A45BF]"
            >
              Muat Ulang
            </button>
          </div>
        </div>
      </div>
    )
  }
}
