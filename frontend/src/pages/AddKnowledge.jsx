import { useState } from "react";
import api from "../api";

const initialState = {
  category: "documentation",
  system: "",
  module: "",
  title: "",
  problem: "",
  symptoms: "",
  cause: "",
  solution: "",
  tables_related: "",
  tags: "",
};

export default function AddKnowledge() {
  const [form, setForm] = useState(initialState);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...form,
        symptoms: splitCsv(form.symptoms),
        tables_related: splitCsv(form.tables_related),
        tags: splitCsv(form.tags),
      };
      const response = await api.post("/knowledge/manual", payload);
      setMessage(`Item inserido com sucesso: ${response.data.id}`);
      setForm(initialState);
    } catch (err) {
      setError(err?.response?.data?.error || "Falha ao inserir conhecimento");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Inserção Manual</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Categoria
          <select name="category" value={form.category} onChange={handleChange}>
            <option value="documentation">documentation</option>
            <option value="schema">schema</option>
            <option value="audio_case">audio_case</option>
            <option value="ticket">ticket</option>
            <option value="business_rule">business_rule</option>
          </select>
        </label>
        <label>
          Sistema
          <input name="system" value={form.system} onChange={handleChange} />
        </label>
        <label>
          Módulo
          <input name="module" value={form.module} onChange={handleChange} />
        </label>
        <label>
          Título
          <input name="title" value={form.title} onChange={handleChange} />
        </label>
        <label className="full">
          Problema
          <textarea name="problem" value={form.problem} onChange={handleChange} rows={3} />
        </label>
        <label className="full">
          Sintomas (separados por vírgula)
          <input name="symptoms" value={form.symptoms} onChange={handleChange} />
        </label>
        <label className="full">
          Causa
          <textarea name="cause" value={form.cause} onChange={handleChange} rows={3} />
        </label>
        <label className="full">
          Solução
          <textarea name="solution" value={form.solution} onChange={handleChange} rows={3} />
        </label>
        <label>
          Tabelas relacionadas (vírgula)
          <input name="tables_related" value={form.tables_related} onChange={handleChange} />
        </label>
        <label>
          Tags (vírgula)
          <input name="tags" value={form.tags} onChange={handleChange} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Inserindo..." : "Inserir na Base"}
        </button>
      </form>
      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

