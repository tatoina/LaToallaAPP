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
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const CATEGORIAS = ["Bebida", "Comida", "Menaje", "Limpieza", "Otros"];
const CAT_COMPRA = ["Bebida", "Menaje", "Limpieza", "Otros"];
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

  const [editingQtyId, setEditingQtyId] = useState(null);
  const [editingQtyVal, setEditingQtyVal] = useState("");

  // Compra Inicial
  const [showCompra, setShowCompra] = useState(false);
  const [listaCompra, setListaCompra] = useState([]);
  const [activeCatCompra, setActiveCatCompra] = useState(new Set());
  const [compradoFilter, setCompradoFilter] = useState("pendiente"); // "pendiente" | "comprado"
  const [newCompra, setNewCompra] = useState({ nombre: "", cantidad: "", categoria: "Bebida" });
  const [addingCompra, setAddingCompra] = useState(false);
  const [compraError, setCompraError] = useState("");
  const [editingCompraId, setEditingCompraId] = useState(null);
  const [editingCompraData, setEditingCompraData] = useState({});
  const [showAddCompra, setShowAddCompra] = useState(false);
  const [compraView, setCompraView] = useState("lista"); // "lista" | "historico"
  const [historicos, setHistoricos] = useState([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [historicoAnio, setHistoricoAnio] = useState("");
  const [savingHistorico, setSavingHistorico] = useState(false);
  const [expandedHistorico, setExpandedHistorico] = useState(null);
  const [editingHistoricoId, setEditingHistoricoId] = useState(null);
  const [editingHistoricoLabel, setEditingHistoricoLabel] = useState("");

  const [collapsedCats, setCollapsedCats] = useState(new Set());
  const [collapsedCatsCompra, setCollapsedCatsCompra] = useState(new Set());

  const toggleCat = (cat) => setCollapsedCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });
  const toggleCatCompra = (cat) => setCollapsedCatsCompra(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });

  useEffect(() => {
    const q = query(collection(db, "lista_compra"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || (a.nombre || "").localeCompare(b.nombre || ""));
      setListaCompra(docs);
    }, (err) => console.error("Firestore lista_compra error:", err));
    return () => unsub();
  }, []);

  const handleAddCompra = async (e) => {
    e.preventDefault();
    setCompraError("");
    if (!newCompra.nombre.trim()) { setCompraError("El nombre es obligatorio."); return; }
    setAddingCompra(true);
    try {
      await addDoc(collection(db, "lista_compra"), {
        nombre: newCompra.nombre.trim(),
        cantidad: Number(newCompra.cantidad) || 0,
        categoria: newCompra.categoria,
        createdAt: serverTimestamp(),
      });
      setNewCompra({ nombre: "", cantidad: "", categoria: "Bebida" });
      setShowAddCompra(false);
    } catch (err) { console.error(err); setCompraError("Error al añadir."); }
    finally { setAddingCompra(false); }
  };

  const handleDeleteCompra = async (id) => {
    try { await deleteDoc(doc(db, "lista_compra", id)); }
    catch (err) { console.error(err); }
  };

  const handleToggleComprado = async (item) => {
    try { await updateDoc(doc(db, "lista_compra", item.id), { comprado: !item.comprado }); }
    catch (err) { console.error(err); }
  };

  const handleClearCompra = async () => {
    if (!window.confirm("¿Vaciar toda la lista de compra?")) return;
    try {
      await Promise.all(listaCompra.map(item => deleteDoc(doc(db, "lista_compra", item.id))));
    } catch (err) { console.error(err); }
  };

  const startEditCompra = (item) => {
    setEditingCompraId(item.id);
    setEditingCompraData({ nombre: item.nombre, cantidad: item.cantidad, categoria: item.categoria });
  };

  const saveEditCompra = async (id) => {
    try {
      await updateDoc(doc(db, "lista_compra", id), {
        nombre: editingCompraData.nombre.trim(),
        cantidad: Number(editingCompraData.cantidad) || 0,
        categoria: editingCompraData.categoria,
      });
      setEditingCompraId(null);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const q = query(collection(db, "historico_compra"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.anio || "").localeCompare(a.anio || ""));
      setHistoricos(docs);
    }, (err) => console.error("historico_compra error:", err));
    return () => unsub();
  }, []);

  const handleSaveHistorico = async () => {
    setSavingHistorico(true);
    const now = new Date();
    const autoLabel = now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " + now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    const label = historicoAnio.trim() || autoLabel;
    try {
      await addDoc(collection(db, "historico_compra"), {
        anio: label,
        items: listaCompra.map(({ nombre, cantidad, categoria }) => ({ nombre, cantidad, categoria })),
        savedAt: serverTimestamp(),
      });
      setShowSaveForm(false);
      setHistoricoAnio("");
      setCompraView("historico");
    } catch (err) { console.error(err); }
    finally { setSavingHistorico(false); }
  };

  const handleUpdateHistoricoLabel = async (id) => {
    if (!editingHistoricoLabel.trim()) return;
    try {
      await updateDoc(doc(db, "historico_compra", id), { anio: editingHistoricoLabel.trim() });
      setEditingHistoricoId(null);
    } catch (err) { console.error(err); }
  };

  const handleDeleteHistorico = async (id) => {
    if (!window.confirm("¿Eliminar este histórico?")) return;
    try { await deleteDoc(doc(db, "historico_compra", id)); }
    catch (err) { console.error(err); }
  };

  const handleCopyHistorico = async (hist) => {
    if (!window.confirm(`¿Recuperar la lista "${hist.anio}"? Se cargará como lista actual.`)) return;
    try {
      await Promise.all(listaCompra.map(item => deleteDoc(doc(db, "lista_compra", item.id))));
      await Promise.all((hist.items || []).map(it =>
        addDoc(collection(db, "lista_compra"), {
          nombre: it.nombre,
          cantidad: it.cantidad,
          categoria: it.categoria,
          createdAt: serverTimestamp(),
        })
      ));
      setCompraView("lista");
      setExpandedHistorico(null);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const q = query(collection(db, "stock"));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const catCmp = (a.categoria || "").localeCompare(b.categoria || "");
        if (catCmp !== 0) return catCmp;
        return (a.nombre || "").localeCompare(b.nombre || "");
      });
      setItems(docs);
      setLoading(false);
    }, (err) => { console.error("Firestore error:", err); setLoading(false); });
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

  const saveQty = async (item) => {
    const next = Math.max(0, Number(editingQtyVal) || 0);
    setEditingQtyId(null);
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

  return (
    <div className="page">
      <style>{`
        .gs-page { max-width: 680px; margin: 0 auto; padding: 16px; }
        .gs-header { display: flex; flex-direction: row; align-items: stretch; gap: 10px; margin-bottom: 16px; }
        .gs-header .btn { flex: 1; }
        .gs-title { font-size: 20px; font-weight: 800; color: var(--text); margin: 0; }

        .gs-search { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 15px; box-sizing: border-box; margin-bottom: 12px; background: var(--card); }
        .gs-search:focus { outline: none; border-color: var(--accent); }

        .gs-cat-tabs { display: flex; gap: 4px; flex-wrap: nowrap; margin-bottom: 12px; width: 100%; }
        .gs-cat-tab { flex: 1; padding: 5px 2px; border-radius: 16px; border: 1.5px solid rgba(0,0,0,0.12); background: transparent; font-size: 11px; font-weight: 600; cursor: pointer; color: var(--text); transition: all 0.15s; text-align: center; white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .gs-cat-tab.active { background: var(--accent); border-color: var(--accent); color: white; }

        .gs-add-form { background: var(--card); border-radius: 12px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 6px rgba(0,0,0,0.08); }
        .gs-add-form h3 { margin: 0 0 12px; font-size: 15px; }
        .gs-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .gs-form-grid label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #666; gap: 4px; }
        .gs-form-grid input, .gs-form-grid select { padding: 8px 10px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; }
        .gs-form-full { margin-top: 10px; display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #666; gap: 4px; }
        .gs-form-full input { padding: 8px 10px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.1); font-size: 14px; }
        .gs-form-btns { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }

        .gs-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 14px 0 6px; display: flex; align-items: center; gap: 6px; }
        .gs-section-count { font-weight: 400; font-size: 11px; }

        /* GRID compacto de 2 columnas */
        .gs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        @media (max-width: 360px) { .gs-grid { grid-template-columns: 1fr; } }

        /* Fila compacta */
        .gs-row { background: var(--card); border-radius: 10px; padding: 7px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; flex-direction: column; gap: 5px; }
        .gs-row.zero { border-left: 3px solid #e05c5c; }
        .gs-row.low  { border-left: 3px solid #e08c2c; }
        .gs-row.ok   { border-left: 3px solid var(--accent); }

        .gs-row-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 4px; }
        .gs-row-name { font-size: 12px; font-weight: 700; color: var(--text); line-height: 1.2; word-break: break-word; flex: 1; }
        .gs-row-edit { background: none; border: none; cursor: pointer; font-size: 13px; padding: 0 2px; color: #aaa; flex-shrink: 0; line-height: 1; }
        .gs-row-edit:hover { color: var(--accent); }

        .gs-row-bottom { display: flex; align-items: center; justify-content: center; gap: 4px; }
        .gs-mini-btn { width: 24px; height: 24px; border-radius: 5px; border: 1.5px solid rgba(0,0,0,0.13); background: #f0f0f0; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1; color: var(--text); padding: 0; }
        .gs-mini-btn:active { background: #e0e0e0; transform: scale(0.90); }
        .gs-mini-val { min-width: 32px; text-align: center; font-size: 16px; font-weight: 800; cursor: pointer; border-radius: 4px; padding: 1px 2px; }
        .gs-mini-val:hover { background: rgba(0,0,0,0.05); }
        .gs-mini-val.zero { color: #e05c5c; }
        .gs-mini-val.low  { color: #e08c2c; }
        .gs-mini-val.ok   { color: var(--accent); }
        .gs-qty-input { width: 44px; text-align: center; font-size: 16px; font-weight: 800; border: 1.5px solid var(--accent); border-radius: 6px; padding: 1px 4px; background: white; color: var(--text); }

        /* Formulario de edición inline (ocupa 2 columnas) */
        .gs-edit-card { background: #f8faf4; border: 1.5px solid var(--accent); border-radius: 10px; padding: 12px; margin-bottom: 6px; grid-column: 1 / -1; box-sizing: border-box; width: 100%; }
        .gs-edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; box-sizing: border-box; }
        .gs-edit-label { display: flex; flex-direction: column; font-size: 12px; font-weight: 600; color: #666; gap: 3px; min-width: 0; }
        .gs-edit-input { padding: 7px 8px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.12); font-size: 13px; box-sizing: border-box; width: 100%; min-width: 0; max-width: 100%; }
        .gs-edit-btns { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
        .gs-edit-btns .btn-delete-right { margin-left: auto; }

        .gs-empty { text-align: center; padding: 40px 0; color: #aaa; font-size: 15px; }

        /* Compra Inicial */
        .ci-overlay { position: fixed; inset: 0; background: var(--bg, #f4f6f0); z-index: 200; display: flex; flex-direction: column; overflow: hidden; }
        .ci-modal { width: 100%; max-width: 640px; margin: 0 auto; flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 12px 14px 8px; overflow: hidden; box-sizing: border-box; }
        .ci-modal-header { display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
        .ci-modal-title { font-size: 16px; font-weight: 800; margin: 0; text-align: center; }
        .ci-modal-add-btn { flex-shrink: 0; padding: 7px 14px; border-radius: 8px; border: none; background: #e67e22; color: white; font-size: 13px; font-weight: 800; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 6px rgba(230,126,34,0.4); }
        .ci-modal-add-btn.cancel { background: rgba(0,0,0,0.12); color: var(--text); box-shadow: none; }
        .ci-tabs-row { display: flex; gap: 6px; align-items: center; margin-bottom: 6px; }
        .ci-close-btn { display: none; }
        .ci-form { background: var(--card); border-radius: 12px; padding: 14px; margin-bottom: 12px; }
        .ci-form-row { display: grid; grid-template-columns: 2fr 1fr 1.4fr; gap: 8px; align-items: end; }
        .ci-form-label { display: flex; flex-direction: column; font-size: 11px; font-weight: 700; color: #666; gap: 4px; }
        .ci-form-input { padding: 9px 10px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.12); font-size: 14px; box-sizing: border-box; width: 100%; background: white; }
        .ci-form-input:focus { outline: none; border-color: var(--accent); }
        .ci-add-btn { margin-top: 10px; width: 100%; }
        .ci-list { overflow-y: auto; flex: 1; min-height: 0; }
        .ci-cat-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 10px 0 4px; }
        .ci-item { background: transparent; border-bottom: 1px solid rgba(0,0,0,0.07); padding: 8px 0; margin-bottom: 0; display: flex; align-items: center; gap: 8px; overflow: visible; }
        .ci-item:last-child { border-bottom: none; }
        .ci-item-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex: 1; min-width: 0; }
        .ci-item-info { display: flex; align-items: center; gap: 8px; flex: 1; cursor: pointer; min-width: 0; }
        .ci-item-name { font-size: 14px; font-weight: 600; color: var(--text); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ci-item-qty { font-size: 13px; font-weight: 800; color: var(--accent); background: rgba(0,0,0,0.06); border-radius: 5px; padding: 1px 7px; white-space: nowrap; flex-shrink: 0; }
        .ci-items-list { background: var(--card); border-radius: 10px; padding: 0 10px; margin-bottom: 8px; overflow: visible; }
        .ci-item-edit-full { background: #f0f0f0; border-radius: 8px; padding: 10px; margin: 4px 0 8px; display: flex; flex-direction: column; gap: 8px; }
        /* filter tabs in compra */
        .ci-filters { background: var(--card); border-radius: 12px; padding: 10px 12px; margin-bottom: 10px; display: flex; flex-direction: column; gap: 8px; }
        .ci-filter-row { display: flex; flex-direction: column; gap: 4px; }
        .ci-filter-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #999; white-space: nowrap; }
        .ci-filter-pills { display: flex; gap: 4px; flex-wrap: wrap; }
        .ci-pill { padding: 3px 8px; border-radius: 20px; border: 1.5px solid rgba(0,0,0,0.12); background: transparent; font-size: 11px; font-weight: 600; cursor: pointer; color: var(--text); white-space: nowrap; flex-shrink: 0; }
        .ci-pill.active-cat  { background: var(--accent); border-color: var(--accent); color: white; }
        .ci-pill.active-all  { background: #555; border-color: #555; color: white; }
        .ci-pill.active-pend { background: #e67e22; border-color: #e67e22; color: white; }
        .ci-pill.active-done { background: #27ae60; border-color: #27ae60; color: white; }
        /* checkbox */
        .ci-check { width: 20px; height: 20px; border-radius: 5px; border: 2px solid #ccc; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; transition: all 0.15s; padding: 0; }
        .ci-check.done { background: #27ae60; border-color: #27ae60; color: white; }
        .ci-item.done .ci-item-name { text-decoration: line-through; color: #aaa; }
        .ci-item.done .ci-item-qty { opacity: 0.4; }
        .ci-item-edit { background: #f0f0f0; border-radius: 8px; padding: 8px; margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
        .ci-item-edit-row { display: grid; grid-template-columns: 2fr 1fr 1.4fr; gap: 6px; }
        .ci-item-edit-label { display: flex; flex-direction: column; font-size: 10px; font-weight: 700; color: #666; gap: 3px; }
        .ci-item-edit-input { padding: 7px 8px; border-radius: 7px; border: 1.5px solid rgba(0,0,0,0.12); font-size: 13px; box-sizing: border-box; width: 100%; background: white; }
        .ci-item-edit-input:focus { outline: none; border-color: var(--accent); }
        .ci-item-edit-btns { display: flex; gap: 6px; }
        .ci-del-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #bbb; padding: 4px; line-height: 1; flex-shrink: 0; }
        .ci-del-btn:hover { color: #e05c5c; }
        .ci-footer { margin-top: 12px; display: flex; gap: 8px; }
        .ci-empty { text-align: center; padding: 30px 0; color: #bbb; font-size: 14px; }
        /* tabs */
        .ci-tabs { display: flex; gap: 6px; flex: 1; }
        .ci-tab { flex: 1; padding: 8px; border-radius: 10px; border: 1.5px solid rgba(0,0,0,0.12); background: transparent; font-size: 13px; font-weight: 700; cursor: pointer; color: var(--text); }
        .ci-tab.active { background: var(--accent); border-color: var(--accent); color: white; }
        /* save historico form */
        .ci-save-form { background: var(--card); border-radius: 10px; padding: 12px; margin-bottom: 10px; display: flex; align-items: flex-end; gap: 8px; }
        .ci-save-form label { display: flex; flex-direction: column; font-size: 11px; font-weight: 700; color: #666; gap: 4px; flex: 1; }
        .ci-save-form input { padding: 9px 10px; border-radius: 8px; border: 1.5px solid rgba(0,0,0,0.12); font-size: 14px; box-sizing: border-box; width: 100%; background: white; }
        /* historico list */
        .ci-hist-item { background: var(--card); border-radius: 10px; margin-bottom: 8px; overflow: hidden; }
        .ci-hist-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; }
        .ci-hist-title { font-size: 15px; font-weight: 800; cursor: pointer; flex: 1; }
        .ci-hist-edit-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: #bbb; padding: 0 3px; }
        .ci-hist-edit-btn:hover { color: var(--accent); }
        .ci-hist-label-form { display: flex; gap: 6px; align-items: center; padding: 0 14px 12px; }
        .ci-hist-label-input { flex: 1; padding: 7px 10px; border-radius: 8px; border: 1.5px solid var(--accent); font-size: 14px; background: white; }
        .ci-hist-meta { font-size: 11px; color: #999; margin-top: 2px; }
        .ci-hist-body { padding: 0 14px 12px; }
        .ci-hist-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 5px 0; border-bottom: 1px solid rgba(0,0,0,0.05); }
        .ci-hist-row:last-child { border-bottom: none; }
        .ci-hist-cat { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 10px 0 4px; }
        .ci-hist-actions { display: flex; gap: 6px; margin-top: 10px; }
      `}</style>

      <div className="gs-page">
        <div className="page-header">
          <h2 className="page-header-title">📦 Almacén</h2>
        </div>
        <div className="gs-header">
          <button className="btn small" onClick={() => { setShowForm(f => !f); setAddError(""); }}>
            {showForm ? "✕ Cancelar" : "+ Añadir"}
          </button>
          <button className="btn small" style={{ background: "#e67e22", borderColor: "#e67e22", color: "white" }} onClick={() => setShowCompra(true)}>
            🛒 Compra Inicial
          </button>
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
              {cat}
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
              <div className="gs-section-title" onClick={() => toggleCat(cat)} style={{ cursor: "pointer" }}>
                {CAT_EMOJI[cat]} {cat} <span className="gs-section-count">({catItems.length})</span>
                <span style={{ marginLeft: "auto", fontSize: 12 }}>{collapsedCats.has(cat) ? "▶" : "▼"}</span>
              </div>
              {!collapsedCats.has(cat) && <div className="gs-grid">
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
                          <button className="btn danger small btn-delete-right" onClick={() => handleDelete(item.id)}>🗑️ Borrar</button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className={`gs-row ${level}`} key={item.id}>
                      <div className="gs-row-top">
                        <div className="gs-row-name">{item.nombre}</div>
                        <button className="gs-row-edit" title="Editar" onClick={() => startEdit(item)}>✏️</button>
                      </div>
                      <div className="gs-row-bottom">
                        <button className="gs-mini-btn" onClick={() => adjustQty(item, -1)}>−</button>
                        {editingQtyId === item.id ? (
                          <input
                            className="gs-qty-input"
                            type="number"
                            min="0"
                            value={editingQtyVal}
                            autoFocus
                            onChange={e => setEditingQtyVal(e.target.value)}
                            onBlur={() => saveQty(item)}
                            onKeyDown={e => { if (e.key === "Enter") saveQty(item); if (e.key === "Escape") setEditingQtyId(null); }}
                          />
                        ) : (
                          <span
                            className={`gs-mini-val ${level}`}
                            title="Toca para editar"
                            onClick={() => { setEditingQtyId(item.id); setEditingQtyVal(String(qty)); }}
                          >{qty}</span>
                        )}
                        <button className="gs-mini-btn" onClick={() => adjustQty(item, +1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>}
            </section>
          ))
        )}
      </div>

      {showCompra && (
        <div className="ci-overlay">
          <div className="ci-modal">
            <div className="ci-modal-header">
              <h3 className="ci-modal-title">🛒 Compra Inicial</h3>
            </div>

            <div className="ci-tabs-row">
              <div className="ci-tabs">
                <button className={`ci-tab${compraView === "lista" ? " active" : ""}`} onClick={() => setCompraView("lista")}>📋 Lista actual</button>
                <button className={`ci-tab${compraView === "historico" ? " active" : ""}`} onClick={() => setCompraView("historico")}>📅 Histórico ({historicos.length})</button>
              </div>
              {compraView === "lista" && (
                <button className={`ci-modal-add-btn${showAddCompra ? " cancel" : ""}`} onClick={() => { setShowAddCompra(v => !v); setCompraError(""); }}>
                  {showAddCompra ? "✕" : "+ Añadir"}
                </button>
              )}
            </div>

            {compraView === "lista" && (
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {showAddCompra && (
            <div className="ci-form">
              <form onSubmit={handleAddCompra}>
                <div className="ci-form-row">
                  <label className="ci-form-label">
                    Producto
                    <input className="ci-form-input" autoFocus value={newCompra.nombre} onChange={e => setNewCompra(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Agua mineral" />
                  </label>
                  <label className="ci-form-label">
                    Cantidad
                    <input className="ci-form-input" type="number" min="0" value={newCompra.cantidad} onChange={e => setNewCompra(p => ({ ...p, cantidad: e.target.value }))} placeholder="0" />
                  </label>
                  <label className="ci-form-label">
                    Categoría
                    <select className="ci-form-input" value={newCompra.categoria} onChange={e => setNewCompra(p => ({ ...p, categoria: e.target.value }))}>
                      {CAT_COMPRA.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </label>
                </div>
                {compraError && <p className="error" style={{ margin: "6px 0 0", fontSize: 12 }}>{compraError}</p>}
                <button className="btn ci-add-btn" type="submit" disabled={addingCompra}>
                  {addingCompra ? "Añadiendo..." : "+ Añadir a la lista"}
                </button>
              </form>
            </div>
                )}

            <div className="ci-list">
              {listaCompra.length === 0 ? (
                <div className="ci-empty">La lista está vacía.<br />Añade productos arriba.</div>
              ) : (
                <>
                  <div className="ci-filters">
                    <div className="ci-filter-row">
                      <span className="ci-filter-label">Estado</span>
                      <div className="ci-filter-pills">
                        <button className={`ci-pill${compradoFilter === "pendiente" ? " active-pend" : ""}`} onClick={() => setCompradoFilter("pendiente")}>⏳ Pendiente</button>
                        <button className={`ci-pill${compradoFilter === "comprado" ? " active-done" : ""}`} onClick={() => setCompradoFilter("comprado")}>✅ Comprado</button>
                      </div>
                    </div>
                    <div className="ci-filter-row">
                      <span className="ci-filter-label">Categoría</span>
                      <div className="ci-filter-pills">
                        {CAT_COMPRA.map(cat => (
                          <button key={cat} className={`ci-pill${activeCatCompra.has(cat) ? " active-cat" : ""}`} onClick={() => setActiveCatCompra(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; })}>
                            {CAT_EMOJI[cat]} {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {CAT_COMPRA.map(cat => {
                    if (activeCatCompra.size > 0 && !activeCatCompra.has(cat)) return null;
                    const catItems = listaCompra.filter(i => {
                      if (i.categoria !== cat) return false;
                      if (compradoFilter === "pendiente") return !i.comprado;
                      if (compradoFilter === "comprado") return !!i.comprado;
                      return true;
                    });
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat}>
                      <div className="ci-cat-title" onClick={() => toggleCatCompra(cat)} style={{ cursor: "pointer", display: "flex", alignItems: "center" }}>
                        {CAT_EMOJI[cat]} {cat} <span style={{fontWeight:400, marginLeft: 4}}>({catItems.length})</span>
                        <span style={{ marginLeft: "auto" }}>{collapsedCatsCompra.has(cat) ? "▶" : "▼"}</span>
                      </div>
                      {!collapsedCatsCompra.has(cat) && <div className="ci-items-list">
                        {catItems.map(item => (
                          <React.Fragment key={item.id}>
                            <div className={`ci-item${item.comprado ? " done" : ""}`}>
                              <button className={`ci-check${item.comprado ? " done" : ""}`} onClick={() => handleToggleComprado(item)}>
                                {item.comprado ? "✓" : ""}
                              </button>
                              <div className="ci-item-info" onClick={() => editingCompraId === item.id ? null : startEditCompra(item)}>
                                <span className="ci-item-name">{item.nombre}</span>
                                <span className="ci-item-qty">×{item.cantidad}</span>
                              </div>
                              <button className="ci-del-btn" style={{fontSize:14}} title="Eliminar" onClick={() => handleDeleteCompra(item.id)}>🗑️</button>
                            </div>
                            {editingCompraId === item.id && (
                              <div className="ci-item-edit-full">
                                <div className="ci-item-edit-row">
                                  <label className="ci-item-edit-label">Producto
                                    <input className="ci-item-edit-input" value={editingCompraData.nombre} autoFocus onChange={e => setEditingCompraData(p => ({ ...p, nombre: e.target.value }))} />
                                  </label>
                                  <label className="ci-item-edit-label">Cantidad
                                    <input className="ci-item-edit-input" type="number" min="0" value={editingCompraData.cantidad} onChange={e => setEditingCompraData(p => ({ ...p, cantidad: e.target.value }))} />
                                  </label>
                                  <label className="ci-item-edit-label">Categoría
                                    <select className="ci-item-edit-input" value={editingCompraData.categoria} onChange={e => setEditingCompraData(p => ({ ...p, categoria: e.target.value }))}>
                                      {CAT_COMPRA.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                  </label>
                                </div>
                                <div className="ci-item-edit-btns">
                                  <button className="btn small" onClick={() => saveEditCompra(item.id)}>✔ Guardar</button>
                                  <button className="btn outline small" onClick={() => setEditingCompraId(null)}>Cancelar</button>
                                </div>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>}
                    </div>
                  );
                })}
                </>
              )}
            </div>

            {listaCompra.length > 0 && (
              <div className="ci-footer">
                <button className="btn danger small" style={{ flex: 1 }} onClick={handleClearCompra}>🗑️ Vaciar lista</button>
                <button className="btn small" style={{ flex: 1, background: "#2980b9", borderColor: "#2980b9", color: "white" }} onClick={() => {
                  if (!showSaveForm) {
                    const now = new Date();
                    setHistoricoAnio(now.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }));
                  }
                  setShowSaveForm(s => !s);
                }}>
                  {showSaveForm ? "✕ Cancelar" : "💾 Guardar histórico"}
                </button>
              </div>
            )}
            {showSaveForm && (
              <div className="ci-save-form">
                <label>Etiqueta (opcional)
                  <input value={historicoAnio} onChange={e => setHistoricoAnio(e.target.value)} placeholder="Se usará la fecha y hora actual" />
                </label>
                <button className="btn small" disabled={savingHistorico} onClick={handleSaveHistorico}>
                  {savingHistorico ? "Guardando..." : "✔ Guardar"}
                </button>
              </div>
            )}
            </div>
            )}

            {compraView === "historico" && (
              <div className="ci-list">
                {historicos.length === 0 ? (
                  <div className="ci-empty">No hay históricos guardados.</div>
                ) : (
                  historicos.map(hist => (
                    <div className="ci-hist-item" key={hist.id}>
                      <div className="ci-hist-header">
                        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setExpandedHistorico(expandedHistorico === hist.id ? null : hist.id)}>
                          <div className="ci-hist-title">📅 {hist.anio}</div>
                          <div className="ci-hist-meta">{hist.items?.length || 0} productos · {hist.savedAt?.toDate ? hist.savedAt.toDate().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "Sin fecha"}</div>
                        </div>
                        <button className="ci-hist-edit-btn" title="Editar etiqueta" onClick={() => { setEditingHistoricoId(hist.id); setEditingHistoricoLabel(hist.anio); }}>✏️</button>
                        <button className="ci-hist-edit-btn" title="Eliminar" onClick={() => handleDeleteHistorico(hist.id)}>🗑️</button>
                        <span style={{ fontSize: 16, color: "#aaa", cursor: "pointer", paddingLeft: 4 }} onClick={() => setExpandedHistorico(expandedHistorico === hist.id ? null : hist.id)}>{expandedHistorico === hist.id ? "▲" : "▼"}</span>
                      </div>
                      {editingHistoricoId === hist.id && (
                        <div className="ci-hist-label-form">
                          <input className="ci-hist-label-input" value={editingHistoricoLabel} autoFocus onChange={e => setEditingHistoricoLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleUpdateHistoricoLabel(hist.id); if (e.key === "Escape") setEditingHistoricoId(null); }} />
                          <button className="btn small" onClick={() => handleUpdateHistoricoLabel(hist.id)}>✔</button>
                          <button className="btn outline small" onClick={() => setEditingHistoricoId(null)}>✕</button>
                        </div>
                      )}
                      {expandedHistorico === hist.id && (
                        <div className="ci-hist-body">
                          {CAT_COMPRA.map(cat => {
                            const catItems = (hist.items || []).filter(i => i.categoria === cat);
                            if (catItems.length === 0) return null;
                            return (
                              <div key={cat}>
                                <div className="ci-hist-cat">{CAT_EMOJI[cat]} {cat}</div>
                                {catItems.map((it, idx) => (
                                  <div className="ci-hist-row" key={idx}>
                                    <span>{it.nombre}</span>
                                    <span style={{ fontWeight: 700 }}>×{it.cantidad}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                          <div className="ci-hist-actions">
                            <button className="btn small" style={{ flex: 1, background: "#2980b9", borderColor: "#2980b9", color: "white" }} onClick={() => handleCopyHistorico(hist)}>� Recuperar lista</button>

                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <div style={{ padding: "10px 16px 16px", maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
            <button className="nav-bottom-btn" style={{ width: "100%" }} onClick={() => { setShowCompra(false); setCompraView("lista"); }}>← Volver</button>
          </div>
        </div>
      )}

      <div style={{ padding: "14px 0 8px", display: "flex", justifyContent: "center" }}>
        <button className="nav-bottom-btn" style={{ minWidth: 160 }} onClick={() => navigate("/")}>← Inicio</button>
      </div>
    </div>
  );
}
