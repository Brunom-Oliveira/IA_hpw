import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

// Componente que sempre lança erro para testar ErrorBoundary
function ThrowError() {
  throw new Error("Teste erro");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suprimir logs de erro do console durante os testes
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("deve renderizar children quando não há erro", () => {
    render(
      <ErrorBoundary>
        <div>Conteúdo Normal</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Conteúdo Normal")).toBeInTheDocument();
  });

  it("deve capturar erro e exibir mensagem", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Erro na Aplicação")).toBeInTheDocument();
    expect(
      screen.getByText(/desculpe, ocorreu um problema/i),
    ).toBeInTheDocument();
  });

  it("deve ter botão Tentar Novamente", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    const button = screen.getByRole("button", { name: /tentar novamente/i });
    expect(button).toBeInTheDocument();
  });

  it("deve ter botão Descartar", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    const button = screen.getByRole("button", { name: /descartar/i });
    expect(button).toBeInTheDocument();
  });

  it("deve ter botão Recarregar Página", () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    const button = screen.getByRole("button", { name: /recarregar página/i });
    expect(button).toBeInTheDocument();
  });

  it("deve mostrar detalhes do erro em desenvolvimento", () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>,
    );

    process.env.NODE_ENV = originalEnv;

    expect(screen.getByText(/detalhes do erro/i)).toBeInTheDocument();
  });
});
