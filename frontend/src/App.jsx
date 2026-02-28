import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ChatRag from "./pages/ChatRag";
import AddKnowledge from "./pages/AddKnowledge";
import UploadAudio from "./pages/UploadAudio";
import UploadSQL from "./pages/UploadSQL";

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <img
          src="/logo-harpia.png"
          alt="Harpia Vision"
          className="sidebar-logo"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <h1>Harpia Vision</h1>
        <p className="sidebar-tagline">Pergunte. Entenda. Execute.</p>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/chat">Perguntas</Link>
          <Link to="/add">Inserir Manual</Link>
          <Link to="/upload-audio">Upload Audio</Link>
          <Link to="/upload-sql">Upload SQL</Link>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatRag />} />
          <Route path="/add" element={<AddKnowledge />} />
          <Route path="/upload-audio" element={<UploadAudio />} />
          <Route path="/upload-sql" element={<UploadSQL />} />
        </Routes>
      </main>
    </div>
  );
}
