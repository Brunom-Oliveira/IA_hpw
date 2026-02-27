import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import AddKnowledge from "./pages/AddKnowledge";
import UploadAudio from "./pages/UploadAudio";
import UploadSQL from "./pages/UploadSQL";

export default function App() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Knowledge Base</h1>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/add">Inserir Manual</Link>
          <Link to="/upload-audio">Upload Áudio</Link>
          <Link to="/upload-sql">Upload SQL</Link>
        </nav>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add" element={<AddKnowledge />} />
          <Route path="/upload-audio" element={<UploadAudio />} />
          <Route path="/upload-sql" element={<UploadSQL />} />
        </Routes>
      </main>
    </div>
  );
}

