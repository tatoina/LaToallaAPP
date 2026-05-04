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
const UNIDADES = [
  "uds",
  "litros",
  "kg",
  "cajas",
  "bolsas",
  "paquetes",
  "botellas",
  "latas",
];

const EMPTY_ITEM = {
  nombre: "",
  categoria: "Bebida",
  cantidad: "",
  unidad: "uds",
  notas: "",
};

export default function GestionStock() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("Todos");

  // New item form
  const [showForm, setShowForm] = useState(false);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "stock"),
      orderBy("categoria"),
      orderBy("nombre")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando stock:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError("");
    if (!newItem.nombre.trim()) {
      setAddError("El nombre es obligatorio.");
      return;
    }
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
    } catch (err) {
      console.error(err);
      setAddError("Error al añadir el artículo.");
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditData({
      nombre: item.nombre,
      categoria: item.categoria,
      cantidad: item.cantidad,
      unidad: item.unidad,
      notas: item.notas || "",
    });
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
    } catch (err) {
      console.error(err);
      alert("Error al guardar. Intenta de nuevo.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este artículo del almacén?")) return;
    try {
      await deleteDoc(doc(db, "stock", id));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar. Intenta de nuevo.");
    }
  };

  const displayItems =
    activeCategory === "Todos"
      ? items
      : items.filter((i) => i.categoria === activeCategory);

  // Group displayed items by category preserving CATEGORIAS order
  const grouped = CATEGORIAS.reduce((acc, cat) => {
    const catItems = displayItems.filter((i) => i.categoria === cat);
    if (catItems.length > 0) acc.push({ cat, catItems });
    return acc;
  }, []);

  return (
    <div className="page">
      <div
        className="card"
        style={{
          padding: 16,
          width: "100%",
          maxWidth: "none",
          boxSizing: "border-box",
        }}
      >
        <style>{`
          .stock-table { width: 100%; border-collapse: collapse; }
          .stock-table th,
          .stock-table td {
            padding: 10px 12px;
            font-size: 14px;
            border-top: 1px solid rgba(0,0,0,0.05);
            box-sizing: border-box;
          }
          .stock-table th {
            text-align: left;
            color: #666;
            background: rgba(0,0,0,0.03);
            font-weight: 600;
          }
          .stock-edit-input {
            width: 100%;
            padding: 6px 8px;
            box-sizing: border-box;
            border: 1px solid rgba(0,0,0,0.15);
            border-radius: 4px;
          }
          .stock-actions { display: flex; gap: 6px; justify-content: flex-end; }
          .stock-qty-zero { color: #e05c5c; font-weight: 700; }
          .stock-qty-low { color: #e08c2c; font-weight: 700; }
          .stock-qty-ok { color: #5a9e5a; font-weight: 700; }
          .stock-cat-header {
            margin: 20px 0 8px;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #555;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .stock-cat-header span { font-weight: 400; color: #999; font-size: 12px; }
        `}</style>

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <h2 style={{ margin: 0 }}>GESTIÓN DE STOCK</h2>
          <button
            className="btn small"
            onClick={() => {
              setShowForm((f) => !f);
              setAddError("");
            }}
          >
            {showForm ? "Cancelar" : "+ Añadir artículo"}
          </button>
        </div>

        {/* Add item form */}
        {showForm && (
          <form
            onSubmit={handleAdd}
            style={{
              marginTop: 16,
              padding: 14,
              background: "rgba(0,0,0,0.02)",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <h3 style={{ margin: "0 0 12px" }}>Nuevo artículo</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <label className="form" style={{ margin: 0 }}>
                Nombre *
                <input
                  required
                  value={newItem.nombre}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, nombre: e.target.value }))
                  }
                  placeholder="Ej: Agua mineral"
                />
              </label>
              <label className="form" style={{ margin: 0 }}>
                Categoría
                <select
                  value={newItem.categoria}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, categoria: e.target.value }))
                  }
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="form" style={{ margin: 0 }}>
                Cantidad
                <input
                  type="number"
                  min="0"
                  value={newItem.cantidad}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, cantidad: e.target.value }))
                  }
                  placeholder="0"
                />
              </label>
              <label className="form" style={{ margin: 0 }}>
                Unidad
                <select
                  value={newItem.unidad}
                  onChange={(e) =>
                    setNewItem((p) => ({ ...p, unidad: e.target.value }))
                  }
                >
                  {UNIDADES.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </label>
            </div>
            <label
              className="form"
              style={{ margin: "10px 0 0", display: "block" }}
            >
              Notas
              <input
                value={newItem.notas}
                onChange={(e) =>
                  setNewItem((p) => ({ ...p, notas: e.target.value }))
                }
                placeholder="Opcional..."
              />
            </label>
            {addError && (
              <p className="error" style={{ marginTop: 6 }}>
                {addError}
              </p>
            )}
            <div
              style={{ display: "flex", gap: 8, marginTop: 12 }}
            >
              <button className="btn" type="submit" disabled={adding}>
                {adding ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                className="btn outline small"
                onClick={() => {
                  setShowForm(false);
                  setAddError("");
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Category filter tabs */}
        <div
          style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}
        >
          {["Todos", ...CATEGORIAS].map((cat) => (
            <button
              key={cat}
              className={`btn ${activeCategory === cat ? "" : "outline"} small`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="centered" style={{ marginTop: 24 }}>
            Cargando...
          </div>
        ) : grouped.length === 0 ? (
          <p className="info" style={{ marginTop: 16 }}>
            {activeCategory === "Todos"
              ? 'No hay artículos en el almacén. Pulsa "+ Añadir artículo" para empezar.'
              : `No hay artículos en la categoría "${activeCategory}".`}
          </p>
        ) : (
          grouped.map(({ cat, catItems }) => (
            <section key={cat}>
              <div className="stock-cat-header">
                {cat} <span>({catItems.length})</span>
              </div>
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Artículo</th>
                      <th>Cantidad</th>
                      <th>Unidad</th>
                      <th>Notas</th>
                      <th style={{ textAlign: "right" }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((item) => {
                      const isEditing = editingId === item.id;
                      const qty = Number(item.cantidad || 0);
                      const qtyClass =
                        qty === 0
                          ? "stock-qty-zero"
                          : qty <= 5
                          ? "stock-qty-low"
                          : "stock-qty-ok";
                      return (
                        <tr key={item.id}>
                          <td style={{ fontWeight: 600 }}>
                            {isEditing ? (
                              <input
                                className="stock-edit-input"
                                value={editData.nombre}
                                onChange={(e) =>
                                  setEditData((p) => ({
                                    ...p,
                                    nombre: e.target.value,
                                  }))
                                }
                              />
                            ) : (
                              item.nombre
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <input
                                className="stock-edit-input"
                                type="number"
                                min="0"
                                value={editData.cantidad}
                                onChange={(e) =>
                                  setEditData((p) => ({
                                    ...p,
                                    cantidad: e.target.value,
                                  }))
                                }
                                style={{ width: 90 }}
                              />
                            ) : (
                              <span className={qtyClass}>{qty}</span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <select
                                value={editData.unidad}
                                onChange={(e) =>
                                  setEditData((p) => ({
                                    ...p,
                                    unidad: e.target.value,
                                  }))
                                }
                              >
                                {UNIDADES.map((u) => (
                                  <option key={u}>{u}</option>
                                ))}
                              </select>
                            ) : (
                              item.unidad
                            )}
                          </td>
                          <td style={{ color: "#888", fontSize: 13 }}>
                            {isEditing ? (
                              <input
                                className="stock-edit-input"
                                value={editData.notas}
                                onChange={(e) =>
                                  setEditData((p) => ({
                                    ...p,
                                    notas: e.target.value,
                                  }))
                                }
                                placeholder="Notas..."
                              />
                            ) : (
                              item.notas || "—"
                            )}
                          </td>
                          <td>
                            <div className="stock-actions">
                              {isEditing ? (
                                <>
                                  <button
                                    className="btn small"
                                    onClick={() => saveEdit(item.id)}
                                    disabled={savingEdit}
                                  >
                                    {savingEdit ? "..." : "Guardar"}
                                  </button>
                                  <button
                                    className="btn outline small"
                                    onClick={() => setEditingId(null)}
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn small"
                                    onClick={() => startEdit(item)}
                                  >
                                    Editar
                                  </button>
                                  <button
                                    className="btn outline small"
                                    onClick={() => handleDelete(item.id)}
                                  >
                                    Borrar
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
        </div>
      </div>

      <div className="page-bottom-nav">
        <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
      </div>
    </div>
  );
}