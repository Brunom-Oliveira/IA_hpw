import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      dismissed: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
      dismissed: false,
    });

    // Log para monitoramento
    console.error("ErrorBoundary capturou erro:", error, errorInfo);
  }

  handleDismiss = () => {
    this.setState({ dismissed: true });
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      dismissed: false,
    });
  };

  render() {
    if (this.state.hasError && !this.state.dismissed) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <div className="error-icon">⚠️</div>
            <h2>Erro na Aplicação</h2>
            <p className="error-message">
              Desculpe, ocorreu um problema inesperado. A página foi recarregada
              ou tente novamente.
            </p>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="error-details">
                <summary>Detalhes do Erro (Desenvolvimento)</summary>
                <pre className="error-stack">
                  {this.state.error.toString()}
                  {"\n"}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="error-actions">
              <button onClick={this.handleReset} className="btn btn-primary">
                Tentar Novamente
              </button>
              <button
                onClick={this.handleDismiss}
                className="btn btn-secondary"
              >
                Descartar
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn btn-tertiary"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
