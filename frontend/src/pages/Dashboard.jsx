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

      <div className="cards">
        <article className="card">
          <h3>Total de itens</h3>
          <strong>{stats.total || 0}</strong>
        </article>
        {Object.entries(stats.by_category || {}).map(([key, value]) => (
          <article className="card" key={key}>
            <h3>{key}</h3>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="filter-row">
        <label htmlFor="category">Filtro por categoria</label>
        <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((option) => (
            <option key={option || "all"} value={option}>
              {option || "todas"}
            </option>
          ))}
        </select>
      </div>

      {loading && <p>Carregando...</p>}
      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Sistema</th>
            <th>Modulo</th>
            <th>Titulo</th>
            <th>Criado em</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) => (
            <tr key={item.id}>
              <td>{item.category}</td>
              <td>{item.system || "-"}</td>
              <td>{item.module || "-"}</td>
              <td>{item.title || "-"}</td>
              <td>{item.created_at || "-"}</td>
            </tr>
          ))}
          {!filteredItems.length && (
            <tr>
              <td colSpan={5}>Nenhum item encontrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}