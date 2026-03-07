import { useEffect, useMemo, useState } from "react";
import api from "../api";

const categories = ["", "documentation", "schema", "audio_case", "ticket", "business_rule"];

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_category: {} });
  const [ragStats, setRagStats] = useState(null);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [activeJobId, setActiveJobId] = useState("");
  const [error, setError] = useState("");

  const filteredItems = useMemo(() => {
    if (!category) return items;
    return items.filter((item) => item.category === category);
  }, [items, category]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const currentJob = ragStats?.jobs?.find((job) => job.id === activeJobId);
    if (!currentJob || !["queued", "running"].includes(currentJob.status)) return;

    const timer = setInterval(() => {
      fetchData();
    }, 4000);

    return () => clearInterval(timer);
  }, [ragStats, activeJobId]);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const [itemsRes, statsRes, ragStatsRes] = await Promise.all([
        api.get("/knowledge/items"),
        api.get("/knowledge/stats"),
        api.get("/api/rag/stats"),
      ]);
      setItems(itemsRes.data.items || []);
      setStats(statsRes.data || { total: 0, by_category: {} });
      setRagStats(ragStatsRes.data || null);
    } catch (err) {
      setError(err?.response?.data?.error || "Falha ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function triggerReindex() {
    setReindexing(true);
    setError("");
    try {
      const { data } = await api.post("/api/rag/reindex");
      setActiveJobId(data?.job?.id || "");
      await fetchData();
    } catch (err) {
      setError(err?.response?.data?.error || "Falha ao iniciar reindexacao");
    } finally {
      setReindexing(false);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h2>Dashboard</h2>
        <div className="dashboard-actions">
          <button type="button" className="secondary" onClick={triggerReindex} disabled={reindexing || loading}>
            {reindexing ? "Reindexando..." : "Reindexar RAG"}
          </button>
          <button onClick={fetchData}>Atualizar</button>
        </div>
      </header>

      <div className="cards stats-row">
        <article className="card primary-stat">
          <h3>Total de Itens</h3>
          <strong>{stats.total || 0}</strong>
          <span className="stat-label">Registros na base</span>
        </article>
        {Object.entries(stats.by_category || {}).map(([key, value]) => (
          <article className="card category-stat" key={key}>
            <h3>{key.replace('_', ' ')}</h3>
            <strong>{value}</strong>
            <span className="stat-label">Documentos</span>
          </article>
        ))}
        {ragStats && (
          <article className="card category-stat">
            <h3>RAG Runtime</h3>
            <strong>{ragStats.runtime?.llm_model || "-"}</strong>
            <span className="stat-label">Modelo principal</span>
          </article>
        )}
      </div>

      {ragStats && (
        <div className="cards">
          <article className="card">
            <h3>Status do Cache</h3>
            <strong>{ragStats.cache?.size ?? 0}</strong>
            <span className="stat-label">Entradas em memoria / TTL {Math.round((ragStats.cache?.ttl_ms ?? 0) / 1000)}s</span>
          </article>
          <article className="card">
            <h3>Reindexacao</h3>
            <strong>{ragStats.operations?.status || "idle"}</strong>
            <span className="stat-label">
              {ragStats.operations?.finished_at
                ? `Ultima finalizacao: ${new Date(ragStats.operations.finished_at).toLocaleString()}`
                : "Nenhuma execucao registrada"}
            </span>
            {activeJobId && <span className="stat-label">Job atual: {activeJobId}</span>}
          </article>
          <article className="card">
            <h3>Pontos Reindexados</h3>
            <strong>{ragStats.operations?.total_updated ?? 0}</strong>
            <span className="stat-label">Scanned: {ragStats.operations?.total_scanned ?? 0}</span>
          </article>
        </div>
      )}

      {ragStats?.jobs?.length > 0 && (
        <div className="table-container dashboard-jobs">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th>Scanned</th>
                <th>Updated</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              {ragStats.jobs.map((job) => (
                <tr key={job.id}>
                  <td>{job.id.slice(0, 8)}</td>
                  <td><span className="badge">{job.status}</span></td>
                  <td>{job.finished_at ? new Date(job.finished_at).toLocaleString() : "-"}</td>
                  <td>{job.total_scanned ?? 0}</td>
                  <td>{job.total_updated ?? 0}</td>
                  <td>{job.error || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="filter-panel">
        <div className="filter-row">
          <label htmlFor="category">Filtrar Categoria</label>
          <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((option) => (
              <option key={option || "all"} value={option}>
                {option || "Todas as categorias"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="loading-state">Atualizando indicadores...</div>}
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Sistema</th>
              <th>Módulo</th>
              <th>Título</th>
              <th>Data de Criação</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td><span className="badge">{item.category}</span></td>
                <td>{item.system || "-"}</td>
                <td>{item.module || "-"}</td>
                <td><strong>{item.title || "-"}</strong></td>
                <td>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}</td>
              </tr>
            ))}
            {!filteredItems.length && !loading && (
              <tr>
                <td colSpan={5} className="empty-row">Nenhum dado encontrado para esta categoria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
