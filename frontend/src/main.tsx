import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#09090b', color: '#ef4444', padding: '32px', fontFamily: 'monospace', minHeight: '100vh' }}>
          <h1 style={{ color: '#f87171', marginBottom: '16px' }}>React Error</h1>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#fca5a5', background: '#1c1917', padding: '16px', borderRadius: '8px' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
