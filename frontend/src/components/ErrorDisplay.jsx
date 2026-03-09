import "./ErrorDisplay.css";

export function ErrorDisplay({ error, onDismiss, details = [] }) {
  if (!error) return null;

  const getIcon = () => {
    switch (error.type) {
      case "validation":
        return "📋";
      case "auth":
        return "🔒";
      case "server":
        return "⚠️";
      case "network":
        return "🌐";
      case "ratelimit":
        return "⏸️";
      case "timeout":
        return "⏱️";
      default:
        return "❌";
    }
  };

  const getTitle = () => {
    switch (error.type) {
      case "validation":
        return "Erro de Validação";
      case "auth":
        return "Acesso Negado";
      case "server":
        return "Erro do Servidor";
      case "network":
        return "Erro de Conexão";
      case "ratelimit":
        return "Limite de Taxa Excedido";
      case "timeout":
        return "Requisição Expirou";
      default:
        return "Erro";
    }
  };

  return (
    <div className={`error-display error-${error.type}`}>
      <div className="error-header">
        <span className="error-icon">{getIcon()}</span>
        <h3 className="error-title">{getTitle()}</h3>
        {onDismiss && (
          <button
            aria-label="Fechar erro"
            className="error-close"
            onClick={onDismiss}
          >
            ✕
          </button>
        )}
      </div>

      <div className="error-body">
        <p className="error-message">{error.message}</p>

        {error.status && <p className="error-status">Status: {error.status}</p>}

        {details.length > 0 && (
          <ul className="error-details">
            {details.map((detail, idx) => (
              <li key={idx}>
                <strong>{detail.filename || "Arquivo"}:</strong> {detail.error}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error.retry && (
        <div className="error-footer">
          <button onClick={error.retry} className="btn btn-primary btn-small">
            Tentar Novamente
          </button>
        </div>
      )}
    </div>
  );
}

export default ErrorDisplay;
