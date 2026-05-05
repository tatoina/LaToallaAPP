import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const CATEGORIAS = ["Bebida", "Comida", "Menaje", "Limpieza", "Otros"];
const CAT_EMOJI = { Bebida: "🍺", Comida: "🍕", Menaje: "🍽️", Limpieza: "🧹", Otros: "📦" };
const UNIDADES = ["uds", "litros", "kg", "cajas", "bolsas", "paquetes", "botellas", "latas"];

const EMPTY_ITEM = { nombre: "", categoria: "Bebida", cantidad: "", unidad: "uds", notas: "" };

function qtyLevel(qty) {
  if (qty === 0) return "zero";
  if (qty <= 5) return "low";
  return "ok";
}

export default function GestionStock() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "stock"), orderBy("categoria"), orderBy("nombre"));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError("");
    if (!newItem.nombre.trim()) { setAddError("El nombre es obligatorio."); return; }
    setAdding(true);
    try {
      await addDoc(collection(db, "stock"), {
        nombre: newItem.nombre.trim(),
        categoria: newItem.categoria,
        cantidad: Number(newItem.cantidad) || 0,
        unidad: newItem.unidad,
        notas: newItem.notas.trim(),
        updatedAt: serverTimestamp(),
      });
      setNewItem(EMPTY_ITEM);
      setShowForm(false);
    } catch (err) { console.error(err); setAddError("Error al añadir el artículo."); }
    finally { setAdding(false); }
  };

  const adjustQty = async (item, delta) => {
    const next = Math.max(0, Number(item.cantidad || 0) + delta);
    try { await updateDoc(doc(db, "stock", item.id), { cantidad: next, updatedAt: serverTimestamp() }); }
    catch (err) { console.error(err); }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditData({ nombre: item.nombre, categoria: item.categoria, cantidad: item.cantidad, unidad: item.unidad, notas: item.notas || "" });
  };

  const saveEdit = async (id) => {
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "stock", id), {
        nombre: editData.nombre.trim(),
        categoria: editData.categoria,
        cantidad: Number(editData.cantidad) || 0,
        unidad: editData.unidad,
        notas: editData.notas.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
    } catch (err) { console.error(err); alert("Error al guardar."); }
    finally { setSavingEdit(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este artículo del almacén?")) return;
    try { await deleteDoc(doc(db, "stock", id)); }
    catch (err) { console.error(err); alert("Error al eliminar."); }
  };

  const filtered = items.filter((i) => {
    const matchCat = activeCategory === "Todos" || i.categoria === activeCategory;
    const matchSearch = !search.trim() || i.nombre.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const grouped = CATEGORIAS.reduce((acc, cat) => {
    const catItems = filtered.filter((i) => i.categoria === cat);
    if (catItems.length > 0) acc.push({ cat, catItems });
    return acc;
  }, []);

  const totalItems = items.length;
  const lowItems = items.filter((i) => Number(i.cantidad || 0) <= 5 && Number(i.cantidad || 0) > 0).length;
  const zeroItems = items.filter((i) => Number(i.cantidad || 0) === 0).length;

  return (
    <div className="page">
      <style>{`
        .gs-page { max-width: 680px; margin: 0 auto; padding: 16px; }
        .gs-header { display: flex; flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 16px; }
        .gs-title { font-size: 20px; font-weight: 800; color: var(--text); margin: 0; }

        .gs-stats { display: flex; gap: 10px; margin-bottom: 16px; }
        .gs-stat { flex: 1; background: var(--card); border-radius: 10px; padding: 10px 12px; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .gs-stat-value { font-size: 22px; font-weight: 800; }
        .gs-stat-label { font-size: 11px; color: #888; margin-top: 2px; }
        .gs-stat-value.zero { color: #e05c5c; }
        .gs-stat-value.low { color: #e08c2c; }
        .gs-stat-value.ok { color: var(--accent); }

        .gs-search { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 15px; box-sizing: border-box; margin-bottom: 12px; background: var(--card); }
        .gs-search:focus { outline: none; border-color: var(--accent); }

        .gs-cat-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .gs-cat-tab { padding: 6px 14px; border-radius: 20px; border: 1.5px solid rgba(0,0,0,0.12); background: transparent; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--text); transition: all 0.15s; }
        .gs-cat-tab.active { background: var(--accent); border-color: var(--accent); color: white; }

        .gs-add-form { background: var(--card); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08); }
        .gs-add-form h3 { margin: 0 0 12px; font-size: 15px; }
        .gs-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .gs-form-grid label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #666; gap: 4px; }
        .gs-form-grid input, .gs-form-grid select { padding: 8px 10px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; }
        .gs-form-full { margin-top: 10px; display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #666; gap: 4px; }
        .gs-form-full input { padding: 8px 10px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; }
        .gs-form-btns { display: flex; gap: 8px; margin-top: 12px; }

        .gs-section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 20px 0 8px; display: flex; align-items: center; gap: 6px; }
        .gs-section-count { font-weight: 400; font-size: 11px; }

        .gs-card { background: var(--card); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); display: flex; flex-direction: column; gap: 10px; }
        .gs-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
        .gs-card-name { font-size: 16px; font-weight: 700; color: var(--text); }
        .gs-card-notes { font-size: 12px; color: #999; margin-top: 2px; }
        .gs-qty-row { display: flex; align-items: center; gap: 0; }
        .gs-qty-btn { width: 38px; height: 38px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.12); background: white; font-size: 22px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .gs-qty-btn:active { background: #f0f0f0; }
        .gs-qty-val { min-width: 56px; text-align: center; font-size: 22px; font-weight: 800; }
        .gs-qty-unit { font-size: 12px; color: #888; margin-left: 6px; }
        .gs-qty-val.zero { color: #e05c5c; }
        .gs-qty-val.low { color: #e08c2c; }
        .gs-qty-val.ok { color: var(--accent); }
        .gs-qty-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 20px; margin-left: 8px; }
        .gs-qty-badge.zero { background: #fdecea; color: #e05c5c; }
        .gs-qty-badge.low { background: #fff3e0; color: #e08c2c; }

        .gs-edit-card { background: #f8faf4; border: 1.5px solid var(--accent); border-radius: 12px; padding: 14px 16px; margin-bottom: 10px; }
        .gs-edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .gs-edit-label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #666; gap: 3px; }
        .gs-edit-input { padding: 7px 10px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.12); font-size: 14px; }
        .gs-edit-btns { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

        .gs-empty { text-align: center; padding: 40px 0; color: #aaa; font-size: 15px; }
      `}</style>

      <div className="gs-page">
        <div className="gs-header">
          <h2 className="gs-title">📦 Almacén</h2>
          <button className="btn small" onClick={() => { setShowForm(f => !f); setAddError(""); }}>
            {showForm ? "✕ Cancelar" : "+ Añadir"}
          </button>
        </div>

        <div className="gs-stats">
          <div className="gs-stat">
            <div className="gs-stat-value ok">{totalItems}</div>
            <div className="gs-stat-label">Artículos</div>
          </div>
          <div className="gs-stat">
            <div className="gs-stat-value low">{lowItems}</div>
            <div className="gs-stat-label">Stock bajo</div>
          </div>
          <div className="gs-stat">
            <div className="gs-stat-value zero">{zeroItems}</div>
            <div className="gs-stat-label">Agotados</div>
          </div>
        </div>

        {showForm && (
          <form className="gs-add-form" onSubmit={handleAdd}>
            <h3>Nuevo artículo</h3>
            <div className="gs-form-grid">
              <label>Nombre *<input required value={newItem.nombre} onChange={e => setNewItem(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Agua mineral" /></label>
              <label>Categoría<select value={newItem.categoria} onChange={e => setNewItem(p => ({ ...p, categoria: e.target.value }))}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></label>
              <label>Cantidad<input type="number" min="0" value={newItem.cantidad} onChange={e => setNewItem(p => ({ ...p, cantidad: e.target.value }))} placeholder="0" /></label>
              <label>Unidad<select value={newItem.unidad} onChange={e => setNewItem(p => ({ ...p, unidad: e.target.value }))}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></label>
            </div>
            <label className="gs-form-full">Notas<input value={newItem.notas} onChange={e => setNewItem(p => ({ ...p, notas: e.target.value }))} placeholder="Opcional..." /></label>
            {addError && <p className="error" style={{ marginTop: 6 }}>{addError}</p>}
            <div className="gs-form-btns">
              <button className="btn" type="submit" disabled={adding}>{adding ? "Guardando..." : "Guardar"}</button>
              <button type="button" className="btn outline small" onClick={() => { setShowForm(false); setAddError(""); }}>Cancelar</button>
            </div>
          </form>
        )}

        <input className="gs-search" placeholder="🔍  Buscar artículo..." value={search} onChange={e => setSearch(e.target.value)} />

        <div className="gs-cat-tabs">
          {["Todos", ...CATEGORIAS].map(cat => (
            <button key={cat} className={`gs-cat-tab${activeCategory === cat ? " active" : ""}`} onClick={() => setActiveCategory(cat)}>
              {cat === "Todos" ? "Todos" : `${CAT_EMOJI[cat]} ${cat}`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="centered" style={{ marginTop: 32 }}>Cargando...</div>
        ) : grouped.length === 0 ? (
          <div className="gs-empty">{search ? `Sin resultados para "${search}"` : "No hay artículos en esta categoría."}</div>
        ) : (
          grouped.map(({ cat, catItems }) => (
            <section key={cat}>
              <div className="gs-section-title">{CAT_EMOJI[cat]} {cat} <span className="gs-section-count">({catItems.length})</span></div>
              {catItems.map(item => {
                const qty = Number(item.cantidad || 0);
                const level = qtyLevel(qty);
                const isEditing = editingId === item.id;

                if (isEditing) {
                  return (
                    <div className="gs-edit-card" key={item.id}>
                      <div className="gs-edit-grid">
                        <label className="gs-edit-label">Nombre<input className="gs-edit-input" value={editData.nombre} onChange={e => setEditData(p => ({ ...p, nombre: e.target.value }))} /></label>
                        <label className="gs-edit-label">Categoría<select className="gs-edit-input" value={editData.categoria} onChange={e => setEditData(p => ({ ...p, categoria: e.target.value }))}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></label>
                        <label className="gs-edit-label">Cantidad<input className="gs-edit-input" type="number" min="0" value={editData.cantidad} onChange={e => setEditData(p => ({ ...p, cantidad: e.target.value }))} /></label>
                        <label className="gs-edit-label">Unidad<select className="gs-edit-input" value={editData.unidad} onChange={e => setEditData(p => ({ ...p, unidad: e.target.value }))}>{UNIDADES.map(u => <option key={u}>{u}</option>)}</select></label>
                      </div>
                      <label className="gs-edit-label" style={{ marginTop: 8 }}>Notas<input className="gs-edit-input" value={editData.notas} onChange={e => setEditData(p => ({ ...p, notas: e.target.value }))} placeholder="Notas..." /></label>
                      <div className="gs-edit-btns">
                        <button className="btn small" onClick={() => saveEdit(item.id)} disabled={savingEdit}>{savingEdit ? "..." : "✔ Guardar"}</button>
                        <button className="btn outline small" onClick={() => setEditingId(null)}>Cancelar</button>
                        <button className="btn danger small" style={{ marginLeft: "auto" }} onClick={() => handleDelete(item.id)}>🗑️ Borrar</button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="gs-card" key={item.id}>
                    <div className="gs-card-top">
                      <div>
                        <div className="gs-card-name">{item.nombre}</div>
                        {item.notas && <div className="gs-card-notes">{item.notas}</div>}
                      </div>
                      <button className="btn outline small" onClick={() => startEdit(item)} style={{ fontSize: 12, flexShrink: 0 }}>✏️ Editar</button>
                    </div>
                    <div className="gs-qty-row">
                      <button className="gs-qty-btn" onClick={() => adjustQty(item, -1)}>-</button>
                      <span className={`gs-qty-val ${level}`}>{qty}</span>
                      <button className="gs-qty-btn" onClick={() => adjustQty(item, +1)}>+</button>
                      <span className="gs-qty-unit">{item.unidad}</span>
                      {level === "zero" && <span className="gs-qty-badge zero">AGOTADO</span>}
                      {level === "low" && <span className="gs-qty-badge low">BAJO</span>}
                    </div>
                  </div>
                );
              })}
            </section>
          ))
        )}
      </div>

      <div className="page-bottom-nav">
        <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
      </div>
    </div>
  );
}
