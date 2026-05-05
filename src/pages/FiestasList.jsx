import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function formatDateLabel(iso) {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "2-digit" });
  } catch {
    return iso;
  }
}

const FIXED_TABS = [
  { key: "juventud", label: "🎉 Fiestas Juventud" },
  { key: "fiestas",  label: "🎊 Fiestas Santiago" },
  { key: "ferias",   label: "🎡 Ferias" },
];

export default function FiestasList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [signups, setSignups] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loadingSignups, setLoadingSignups] = useState(true);
  const [loadingEventos, setLoadingEventos] = useState(true);

  const [activeTab, setActiveTab] = useState("juventud");

  // Meal filter: null = todos, o uno de 'almuerzo'|'comida'|'cena'
  const [mealFilter, setMealFilter] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ adults: 1, children: 0, almuerzo: false, comida: false, cena: false });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "fiestas_signups"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setSignups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingSignups(false);
    }, (err) => { console.error(err); setLoadingSignups(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "eventos"), orderBy("fecha", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingEventos(false);
    }, (err) => { console.error(err); setLoadingEventos(false); });
    return () => unsub();
  }, []);

  const loading = loadingSignups || loadingEventos;

  const allTabs = useMemo(() => [
    ...FIXED_TABS,
    ...eventos.map((ev) => ({
      key: `evento_${ev.id}`,
      label: `📅 ${ev.nombre}`,
    })),
  ], [eventos]);

  const filteredByTab = useMemo(() => {
    return signups.filter((s) => {
      if (s.eventType) return s.eventType === activeTab;
      if (Array.isArray(s.eventTypes)) return s.eventTypes.includes(activeTab);
      return false;
    });
  }, [signups, activeTab]);

  // Apply meal filter on top
  const filteredByMeal = useMemo(() => {
    if (!mealFilter) return filteredByTab;
    return filteredByTab.filter((s) => !!s[mealFilter]);
  }, [filteredByTab, mealFilter]);

  const grouped = useMemo(() => {
    const map = {};
    filteredByMeal.forEach((s) => {
      const key = s.date || "sin-fecha";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return Object.keys(map).sort().map((date) => ({ date, rows: map[date] }));
  }, [filteredByMeal]);

  const totalsByDate = useMemo(() => {
    const totals = {};
    grouped.forEach(({ date, rows }) => {
      const t = {
        almuerzo: { adults: 0, children: 0 },
        comida:   { adults: 0, children: 0 },
        cena:     { adults: 0, children: 0 },
      };
      rows.forEach((r) => {
        const a = Number(r.adults || 0);
        const c = Number(r.children || 0);
        if (r.almuerzo) { t.almuerzo.adults += a; t.almuerzo.children += c; }
        if (r.comida)   { t.comida.adults   += a; t.comida.children   += c; }
        if (r.cena)     { t.cena.adults     += a; t.cena.children     += c; }
      });
      totals[date] = t;
    });
    return totals;
  }, [grouped]);

  const grandTotals = useMemo(() => {
    const t = {
      almuerzo: { adults: 0, children: 0 },
      comida:   { adults: 0, children: 0 },
      cena:     { adults: 0, children: 0 },
    };
    filteredByMeal.forEach((r) => {
      const a = Number(r.adults || 0);
      const c = Number(r.children || 0);
      if (r.almuerzo) { t.almuerzo.adults += a; t.almuerzo.children += c; }
      if (r.comida)   { t.comida.adults   += a; t.comida.children   += c; }
      if (r.cena)     { t.cena.adults     += a; t.cena.children     += c; }
    });
    return t;
  }, [filteredByMeal]);

  const displayName = (s) => s.name || (s.email ? s.email.split("@")[0] : "anónimo");

  const comidasLabel = (s) => {
    const parts = [];
    if (s.almuerzo) parts.push("Alm.");
    if (s.comida)   parts.push("Com.");
    if (s.cena)     parts.push("Cena");
    return parts.length ? parts.join(" · ") : "—";
  };

  const onEditClick = (row) => {
    setEditingId(row.id);
    setEditData({ adults: Number(row.adults || 0), children: Number(row.children || 0), almuerzo: !!row.almuerzo, comida: !!row.comida, cena: !!row.cena });
  };

  const onSaveEdit = async (id) => {
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "fiestas_signups", id), {
        adults: Number(editData.adults),
        children: Number(editData.children),
        almuerzo: !!editData.almuerzo,
        comida: !!editData.comida,
        cena: !!editData.cena,
      });
      setEditingId(null);
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar la edición.");
    } finally {
      setSavingEdit(false);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm("¿Borrar esta inscripción?")) return;
    try { await deleteDoc(doc(db, "fiestas_signups", id)); }
    catch (err) { console.error(err); alert("No se pudo borrar."); }
  };

  const currentTabLabel = allTabs.find((t) => t.key === activeTab)?.label || activeTab;

  return (
    <div className="list-page">
      {/* Cabecera */}
      <div className="page-header">
        <h2 className="page-header-title">📋 Inscripciones</h2>
      </div>

      {/* Tabs scrollables */}
      {!loading && (
        <div className="list-event-tabs">
          {allTabs.map(({ key, label }) => (
            <button
              key={key}
              className={`list-tab${activeTab === key ? " active" : ""}`}
              onClick={() => { setActiveTab(key); setEditingId(null); setMealFilter(null); }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Filtro por tipo de comida */}
      {!loading && (
        <div className="meal-filter-bar">
          <span className="meal-filter-label">Filtrar:</span>
          {[
            { key: "almuerzo",  label: "🥐 Almuerzo" },
            { key: "comida",    label: "🍽️ Comida" },
            { key: "cena",      label: "🌙 Cena" },
          ].map(({ key, label }) => (
            <button
              key={String(key)}
              className={`meal-filter-btn${mealFilter === key ? " active" : ""}`}
              onClick={() => setMealFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="centered">Cargando...</div>
      ) : (
        <>
          {grouped.length === 0 ? (
            <div className="list-section-card" style={{ padding: 20, textAlign: "center", color: "#999" }}>
              No hay inscripciones para {currentTabLabel}
            </div>
          ) : (
            grouped.map(({ date, rows }) => {
              const t = totalsByDate[date];
              return (
                <div key={date} className="list-section-card">
                  <div className="list-section-header">
                    <span className="list-section-date">{formatDateLabel(date)}</span>
                    <div className="list-totals-row">
                      {[
                        { key: "almuerzo", label: "🥐 Alm.",  color: "orange" },
                        { key: "comida",   label: "🍽️ Com.",  color: "orange" },
                        { key: "cena",     label: "🌙 Cena",  color: "purple" },
                      ]
                        .filter((m) => t[m.key].adults + t[m.key].children > 0)
                        .map((m) => (
                          <div key={m.key} className={`list-date-meal ${m.color}`}>
                            <span className="list-date-meal-name">{m.label}</span>
                            <span className="list-date-meal-counts">
                              Adultos: {t[m.key].adults} · Niños: {t[m.key].children}
                            </span>
                          </div>
                        ))
                      }
                    </div>
                  </div>

                  {rows.map((s) => {
                    const isOwner = user && s.uid && user.uid === s.uid;
                    const isEditing = editingId === s.id;
                    return (
                      <div key={s.id} className="list-signup-row">
                        <span className="list-signup-name">{displayName(s)}</span>

                        {isEditing ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
                            {[["almuerzo","Alm."],["comida","Com."],["cena","Cena"]].map(([field, lbl]) => (
                              <label key={field} style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
                                <input type="checkbox" checked={!!editData[field]}
                                  onChange={(e) => setEditData((p) => ({ ...p, [field]: e.target.checked }))} />
                                {lbl}
                              </label>
                            ))}
                            <input type="number" min="0" value={editData.adults}
                              onChange={(e) => setEditData((p) => ({ ...p, adults: e.target.value }))}
                              style={{ width: 55, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }}
                              placeholder="Ad." />
                            <input type="number" min="0" value={editData.children}
                              onChange={(e) => setEditData((p) => ({ ...p, children: e.target.value }))}
                              style={{ width: 55, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }}
                              placeholder="Ni." />
                          </div>
                        ) : (
                          <div className="list-signup-details">
                            <span className="list-signup-meals">{comidasLabel(s)}</span>
                            <div className="list-signup-counts">
                              <span>Ad: {s.adults || 0}</span>
                              <span>Ni: {s.children || 0}</span>
                            </div>
                          </div>
                        )}

                        <div className="list-signup-actions">
                          {isOwner && (
                            isEditing ? (
                              <>
                                <button className="btn small" onClick={() => onSaveEdit(s.id)} disabled={savingEdit}>
                                  {savingEdit ? "..." : "Guardar"}
                                </button>
                                <button className="btn outline small" onClick={() => setEditingId(null)}>✕</button>
                              </>
                            ) : (
                              <>
                                <button className="btn small" onClick={() => onEditClick(s)}>Editar</button>
                                <button className="btn outline small" onClick={() => onDelete(s.id)}>Borrar</button>
                              </>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </>
      )}

      {/* Botón fijo al fondo */}
      {!loading && (
        <div className="page-bottom-nav">
          <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
        </div>
      )}
    </div>
  );
}
