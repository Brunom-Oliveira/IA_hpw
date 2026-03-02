import { useState, useEffect } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ChatRag from "./pages/ChatRag";
import Settings from "./pages/Settings";
import AddKnowledge from "./pages/AddKnowledge";
import UploadAudio from "./pages/UploadAudio";
import UploadSQL from "./pages/UploadSQL";

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const location = useLocation();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <img src="/logo-harpia.png" alt="Harpia Vision" className="sidebar-logo" />
        <h1>Harpia</h1>
        <p className="sidebar-tagline">Pergunte. Entenda. Execute.</p>

        <nav>
          <Link to="/chat" className={location.pathname === "/chat" ? "active" : ""}>
            Perguntas
          </Link>
          <Link
            to="/upload-audio"
            className={location.pathname === "/upload-audio" ? "active" : ""}
          >
            Transcricao e Resumo
          </Link>
          <Link to="/settings" className={location.pathname === "/settings" ? "active" : ""}>
            Configuracao
          </Link>
        </nav>

        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "Modo Escuro" : "Modo Claro"}
        </button>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatRag />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/add" element={<AddKnowledge />} />
          <Route path="/upload-audio" element={<UploadAudio />} />
          <Route path="/upload-sql" element={<UploadSQL />} />
        </Routes>
      </main>
    </div>
  );
}
