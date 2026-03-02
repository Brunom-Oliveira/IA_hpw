import { useEffect, useMemo, useState } from "react";
import api from "../api";

const categories = ["", "documentation", "schema", "audio_case", "ticket", "business_rule"];

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, by_category: {} });
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filteredItems = useMemo(() => {
    if (!category) return items;
    return items.filter((item) => item.category === category);
  }, [items, category]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const [itemsRes, statsRes] = await Promise.all([api.get("/knowledge/items"), api.get("/knowledge/stats")]);
      setItems(itemsRes.data.items || []);
      setStats(statsRes.data || { total: 0, by_category: {} });
    } catch (err) {
      setError(err?.response?.data?.error || "Falha ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h2>Dashboard</h2>
        <button onClick={fetchData}>Atualizar</button>
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
      </div>

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