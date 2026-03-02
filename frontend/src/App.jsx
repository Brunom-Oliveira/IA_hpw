import { Link, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ChatRag from "./pages/ChatRag";
import Settings from "./pages/Settings";
import AddKnowledge from "./pages/AddKnowledge";
import UploadAudio from "./pages/UploadAudio";
import UploadSQL from "./pages/UploadSQL";

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <img
          src="/logo.png"
          alt="Harpia Vision"
          className="sidebar-logo"
        />
        <h1>Harpia Vision</h1>
        <p className="sidebar-tagline">Inteligência Logística de Ponta</p>
        <nav>
          <Link to="/chat">Perguntas</Link>
          <Link to="/settings">Configuração</Link>
        </nav>
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
