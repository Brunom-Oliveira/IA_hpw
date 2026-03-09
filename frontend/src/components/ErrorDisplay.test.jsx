import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorDisplay from "../components/ErrorDisplay";

describe("ErrorDisplay", () => {
  it("deve retornar null quando error é null", () => {
    const { container } = render(<ErrorDisplay error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar erro de validação", () => {
    const error = {
      type: "validation",
      message: "Campo obrigatório",
    };

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText("Erro de Validação")).toBeInTheDocument();
    expect(screen.getByText("Campo obrigatório")).toBeInTheDocument();
    expect(screen.getByText("📋")).toBeInTheDocument();
  });

  it("deve renderizar erro de autenticação", () => {
    const error = {
      type: "auth",
      message: "Não autorizado",
    };

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText("Acesso Negado")).toBeInTheDocument();
    expect(screen.getByText("🔒")).toBeInTheDocument();
  });

  it("deve renderizar erro de servidor", () => {
    const error = {
      type: "server",
      message: "Erro interno",
      status: 500,
    };

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText("Erro do Servidor")).toBeInTheDocument();
    expect(screen.getByText("⚠️")).toBeInTheDocument();
    expect(screen.getByText(/Status: 500/)).toBeInTheDocument();
  });

  it("deve renderizar erro de rede", () => {
    const error = {
      type: "network",
      message: "Sem conexão",
    };

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText("Erro de Conexão")).toBeInTheDocument();
    expect(screen.getByText("🌐")).toBeInTheDocument();
  });

  it("deve renderizar erro de rate limit", () => {
    const error = {
      type: "ratelimit",
      message: "Muitas requisições",
    };

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText("Limite de Taxa Excedido")).toBeInTheDocument();
    expect(screen.getByText("⏸️")).toBeInTheDocument();
  });

  it("deve renderizar erro de timeout", () => {
    const error = {
      type: "timeout",
      message: "Requisição demorou",
    };

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText("Requisição Expirou")).toBeInTheDocument();
    expect(screen.getByText("⏱️")).toBeInTheDocument();
  });

  it("deve chamar onDismiss ao clicar no botão fechar", () => {
    const onDismiss = vi.fn();
    const error = {
      type: "validation",
      message: "Erro",
    };

    render(<ErrorDisplay error={error} onDismiss={onDismiss} />);

    const closeButton = screen.getByLabelText("Fechar erro");
    fireEvent.click(closeButton);

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("deve exibir detalhes de validação de arquivo", () => {
    const error = {
      type: "validation",
      message: "Alguns arquivos falharam",
    };

    const details = [
      { filename: "arquivo1.txt", error: "Extensão não permitida" },
      { filename: "arquivo2.pdf", error: "Arquivo muito grande" },
    ];

    render(<ErrorDisplay error={error} details={details} />);

    expect(screen.getByText(/arquivo1.txt/)).toBeInTheDocument();
    expect(screen.getByText(/Extensão não permitida/)).toBeInTheDocument();
    expect(screen.getByText(/arquivo2.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/Arquivo muito grande/)).toBeInTheDocument();
  });

  it("deve exibir botão Tentar Novamente quando retry é fornecido", () => {
    const retry = vi.fn();
    const error = {
      type: "network",
      message: "Erro de rede",
      retry,
    };

    render(<ErrorDisplay error={error} />);

    const retryButton = screen.getByRole("button", { name: /tentar novamente/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(retry).toHaveBeenCalledOnce();
  });

  it("deve aplicar classe CSS correta para cada tipo", () => {
    const { container: container1 } = render(
      <ErrorDisplay error={{ type: "validation", message: "Erro" }} />
    );
    expect(container1.firstChild).toHaveClass("error-validation");

    const { container: container2 } = render(
      <ErrorDisplay error={{ type: "auth", message: "Erro" }} />
    );
    expect(container2.firstChild).toHaveClass("error-auth");

    const { container: container3 } = render(
      <ErrorDisplay error={{ type: "server", message: "Erro" }} />
    );
    expect(container3.firstChild).toHaveClass("error-server");
  });

  it("deve renderizar status do servidor quando presente", () => {
    const error = {
      type: "server",
      message: "Erro",
      status: 503,
    };

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText("Status: 503")).toBeInTheDocument();
  });

  it("deve renderizar mensagem genérica quando tipo é específico", () => {
    const error = {
      type: "generic",
      message: "Algo deu errado",
    };

    render(<ErrorDisplay error={error} />);

    expect(screen.getByText("Erro")).toBeInTheDocument();
    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
  });
});
