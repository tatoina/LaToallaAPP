import React, { useEffect, useMemo, useState } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function formatDateLabel(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
  } catch {
    return iso;
  }
}

export default function FiestasList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter: only two options (exclusive): 'fiestas' or 'ferias'
  const [filter, setFilter] = useState("fiestas");

  // Editing state
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    adults: 1,
    children: 0,
    almuerzo: false,
    comida: false,
    cena: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "fiestas_signups"), orderBy("date", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setSignups(arr);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching signups:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Filter signups by selected event filter.
  // Support both new `eventType` (string) and legacy `eventTypes` (array)
  const filteredSignups = useMemo(() => {
    return signups.filter((s) => {
      if (s.eventType) return s.eventType === filter;
      if (Array.isArray(s.eventTypes)) return s.eventTypes.includes(filter);
      return false;
    });
  }, [signups, filter]);

  // Group filtered signups by date (sorted ascending)
  const grouped = useMemo(() => {
    const map = {};
    filteredSignups.forEach((s) => {
      const key = s.date || "sin-fecha";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    const entries = Object.keys(map)
      .sort()
      .map((date) => ({ date, rows: map[date] }));
    return entries;
  }, [filteredSignups]);

  // Compute totals per date (adults, children) for the grouped rows
  const totalsByDate = useMemo(() => {
    const totals = {};
    grouped.forEach(({ date, rows }) => {
      let adults = 0;
      let children = 0;
      rows.forEach((r) => {
        adults += Number(r.adults || 0);
        children += Number(r.children || 0);
      });
      totals[date] = { adults, children };
    });
    return totals;
  }, [grouped]);

  const displayName = (s) => {
    if (s.name) return s.name;
    if (s.email) return s.email.split("@")[0];
    return "anónimo";
  };

  // returns comida label (joined)
  const comidasLabel = (s) => {
    const parts = [];
    if (s.almuerzo) parts.push("Almuerzo");
    if (s.comida) parts.push("Comida");
    if (s.cena) parts.push("Cena");
    return parts.length ? parts.join(" · ") : "-";
  };

  // Edit handlers
  const onEditClick = (row) => {
    setEditingId(row.id);
    setEditData({
      adults: Number(row.adults || 0),
      children: Number(row.children || 0),
      almuerzo: !!row.almuerzo,
      comida: !!row.comida,
      cena: !!row.cena,
    });
  };

  const onEditChange = (field, value) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  const onSaveEdit = async (id) => {
    setSavingEdit(true);
    try {
      const ref = doc(db, "fiestas_signups", id);
      await updateDoc(ref, {
        adults: Number(editData.adults),
        children: Number(editData.children),
        almuerzo: !!editData.almuerzo,
        comida: !!editData.comida,
        cena: !!editData.cena,
      });
      setEditingId(null);
    } catch (err) {
      console.error("Error updating signup:", err);
      alert("No se pudo guardar la edición. Intenta de nuevo.");
    } finally {
      setSavingEdit(false);
    }
  };

  const onCancelEdit = () => {
    setEditingId(null);
  };

  const onDelete = async (id) => {
    const ok = window.confirm("¿Borrar esta inscripción? Esta acción no se puede deshacer.");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "fiestas_signups", id));
    } catch (err) {
      console.error("Error borrando inscripción:", err);
      alert("No se pudo borrar. Intenta de nuevo.");
    }
  };

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
        {/* Scoped responsive styles */}
        <style>{`
          .fiestas-table-container { width: 100%; box-sizing: border-box; }

          .fiestas-table { width: 100%; border-collapse: collapse; min-width: 0; }

          .fiestas-table th,
          .fiestas-table td {
            padding: 10px 12px;
            font-size: 14px;
            border-top: 1px solid rgba(0,0,0,0.04);
            box-sizing: border-box;
          }

          .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

          @media (min-width: 720px) {
            .fiestas-table col.name { width: 35%; }
            .fiestas-table col.comida { width: 35%; }
            .fiestas-table col.adults { width: 15%; min-width: 80px; }
            .fiestas-table col.children { width: 15%; min-width: 80px; }
            .fiestas-table col.actions { width: 10%; min-width: 90px; }
          }

          @media (min-width: 520px) and (max-width: 719px) {
            .fiestas-table col.name { width: 40%; }
            .fiestas-table col.comida { width: 40%; }
            .fiestas-table col.adults { width: 10%; min-width: 60px; }
            .fiestas-table col.children { width: 10%; min-width: 60px; }
            .fiestas-table col.actions { width: 12%; min-width: 80px; }
          }

          @media (max-width: 519px) {
            .fiestas-table col.name { width: 50%; }
            .fiestas-table col.comida { width: 30%; }
            .fiestas-table col.adults { width: 10%; min-width: 36px; }
            .fiestas-table col.children { width: 10%; min-width: 36px; }
            .fiestas-table col.actions { width: 0; min-width: 60px; }
            .fiestas-table th, .fiestas-table td { font-size: 13px; padding: 8px 10px; }
          }

          .numeric { text-align: right; font-variant-numeric: tabular-nums; }
          .actions-cell { display:flex; gap:6px; justify-content:flex-end; align-items:center; }
          .actions-cell .btn { padding:6px 8px; font-size:13px; }
          .totals-row { display:flex; gap:12px; justify-content:flex-end; margin-top:8px; flex-wrap:wrap; }
          .totals-box { padding:8px 12px; border-radius:6px; background:rgba(0,0,0,0.03); }
          .edit-input { width:80px; padding:6px; }
          .edit-checkbox { margin:0 6px; transform:translateY(1px); }
        `}</style>

        <h2 style={{ margin: 0 }}>Listado — {filter === "fiestas" ? "Fiestas de Santiago" : "Ferias"}</h2>

        {/* Only two exclusive filter buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 12 }}>
          <button
            className={`btn ${filter === "fiestas" ? "" : "outline"} small`}
            onClick={() => setFilter("fiestas")}
          >
            Fiestas de Santiago
          </button>

          <button
            className={`btn ${filter === "ferias" ? "" : "outline"} small`}
            onClick={() => setFilter("ferias")}
          >
            Ferias
          </button>
        </div>

        {loading ? (
          <div className="centered">Cargando...</div>
        ) : grouped.length === 0 ? (
          <p className="info">No hay inscripciones para "{filter === "fiestas" ? "Fiestas de Santiago" : "Ferias"}".</p>
        ) : (
          grouped.map(({ date, rows }) => (
            <section key={date} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>{formatDateLabel(date)}</h3>
                <div style={{ color: "#666", fontSize: 14 }}>Inscripciones: {rows.length}</div>
              </div>

              {/* Table container */}
              <div className="fiestas-table-container">
                <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid rgba(0,0,0,0.04)" }}>
                  <table className="fiestas-table" role="table">
                    <colgroup>
                      <col className="name" />
                      <col className="comida" />
                      <col className="adults" />
                      <col className="children" />
                      <col className="actions" />
                    </colgroup>

                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                        <th style={{ textAlign: "left", color: "var(--stone, #666)" }}>Usuario</th>
                        <th style={{ textAlign: "left", color: "var(--stone, #666)" }}>Tipo de comida</th>
                        <th className="numeric" style={{ color: "var(--stone, #666)" }}>Adultos</th>
                        <th className="numeric" style={{ color: "var(--stone, #666)" }}>Niños</th>
                        <th style={{ textAlign: "right", color: "var(--stone, #666)" }}>Acciones</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((s) => {
                        const isOwner = user && s.uid && user.uid === s.uid;
                        const isEditing = editingId === s.id;
                        return (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 600 }}>
                              <span className="truncate" title={displayName(s)}>{displayName(s)}</span>
                            </td>

                            <td>
                              {isEditing ? (
                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input className="edit-checkbox" type="checkbox" checked={!!editData.almuerzo} onChange={(e) => onEditChange("almuerzo", e.target.checked)} />
                                    <span style={{ fontSize: 13 }}>Alm.</span>
                                  </label>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input className="edit-checkbox" type="checkbox" checked={!!editData.comida} onChange={(e) => onEditChange("comida", e.target.checked)} />
                                    <span style={{ fontSize: 13 }}>Com.</span>
                                  </label>
                                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input className="edit-checkbox" type="checkbox" checked={!!editData.cena} onChange={(e) => onEditChange("cena", e.target.checked)} />
                                    <span style={{ fontSize: 13 }}>Cena</span>
                                  </label>
                                </div>
                              ) : (
                                <span className="truncate" title={comidasLabel(s)}>{comidasLabel(s)}</span>
                              )}
                            </td>

                            <td className="numeric">
                              {isEditing ? (
                                <input
                                  className="edit-input"
                                  type="number"
                                  min="0"
                                  value={editData.adults}
                                  onChange={(e) => onEditChange("adults", e.target.value)}
                                />
                              ) : (
                                Number(s.adults || 0)
                              )}
                            </td>

                            <td className="numeric">
                              {isEditing ? (
                                <input
                                  className="edit-input"
                                  type="number"
                                  min="0"
                                  value={editData.children}
                                  onChange={(e) => onEditChange("children", e.target.value)}
                                />
                              ) : (
                                Number(s.children || 0)
                              )}
                            </td>

                            <td>
                              <div className="actions-cell">
                                {isOwner ? (
                                  isEditing ? (
                                    <>
                                      <button className="btn small" onClick={() => onSaveEdit(s.id)} disabled={savingEdit}>
                                        {savingEdit ? "Guardando..." : "Guardar"}
                                      </button>
                                      <button className="btn outline small" onClick={onCancelEdit}>Cancelar</button>
                                    </>
                                  ) : (
                                    <>
                                      <button className="btn small" onClick={() => onEditClick(s)}>Editar</button>
                                      <button className="btn outline small" onClick={() => onDelete(s.id)}>Borrar</button>
                                    </>
                                  )
                                ) : (
                                  <span style={{ color: "#999", fontSize: 13 }}>—</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals per date */}
              <div className="totals-row">
                <div className="totals-box"><strong>{formatDateLabel(date)}</strong></div>
                <div className="totals-box" style={{ background: "linear-gradient(180deg, rgba(106,143,58,0.08), rgba(106,143,58,0.04))" }}>
                  Adultos: <strong>{totalsByDate[date]?.adults ?? 0}</strong>
                </div>
                <div className="totals-box" style={{ background: "linear-gradient(180deg, rgba(127,186,217,0.06), rgba(127,186,217,0.03))" }}>
                  Niños: <strong>{totalsByDate[date]?.children ?? 0}</strong>
                </div>
              </div>
            </section>
          ))
        )}

        {/* Volver al dashboard */}
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
          <button className="btn outline small" onClick={() => navigate("/")}>
            Volver a inicio
          </button>
        </div>
      </div>
    </div>
  );
}