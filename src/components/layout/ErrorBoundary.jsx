import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 40px', textAlign: 'center', maxWidth: '480px', margin: '0 auto' }}>
          <div style={{ fontSize: '52px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ color: '#dc2626', marginBottom: '8px', fontWeight: '900', fontSize: '18px' }}>
            Erreur inattendue dans ce module
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '6px', fontSize: '14px' }}>
            {this.state.error?.message || 'Une erreur interne est survenue.'}
          </p>
          <p style={{ color: '#9ca3af', marginBottom: '24px', fontSize: '12px', direction: 'rtl', fontFamily: 'serif' }}>
            حدث خطأ غير متوقع في هذه الوحدة — يرجى المحاولة مجدداً
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', backgroundColor: '#1e3a8a', color: 'white', cursor: 'pointer', fontWeight: '800', fontSize: '13px', marginRight: '10px' }}>
            ↻ Réessayer
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '13px', color: '#374151' }}>
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
