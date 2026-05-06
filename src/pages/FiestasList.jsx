import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const FIXED_LABELS = {
  juventud: "Fiestas de la Juventud",
  fiestas:  "Fiestas de Santiago",
  ferias:   "Ferias",
};

const MEALS = [
  { key: "almuerzo", label: "Almuerzo", color: "#d97706", bg: "#fffbeb" },
  { key: "comida",   label: "Comida",   color: "#059669", bg: "#f0fdf4" },
  { key: "cena",     label: "Cena",     color: "#7c3aed", bg: "#faf5ff" },
];

const WEEK = ["Dom","Lun","Mar","Mie","Jue","Vie","Sab"];

function formatDateChip(iso) {
  try {
    const d = new Date(iso + "T12:00:00");
    return `${WEEK[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  } catch { return iso; }
}

function userName(s) {
  return s.name || s.alias || (s.email ? s.email.split("@")[0] : "anonimo");
}

function getSKey(s) {
  if (s.eventType) return s.eventType;
  if (Array.isArray(s.eventTypes) && s.eventTypes.length > 0) return s.eventTypes[0];
  return "otro";
}

function money(n) {
  return `${Number(n || 0).toFixed(2)} EUR`;
}

export default function FiestasList() {
  const navigate = useNavigate();
  const { eventKey: urlKey } = useParams();
  const { user, isAdmin } = useAuth();

  const [signups, setSignups]   = useState([]);
  const [eventos, setEventos]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selDate,  setSelDate]  = useState(null);
  const [selEvent, setSelEvent] = useState(urlKey || null);
  const [selMeal,  setSelMeal]  = useState(null);
  const [editingId,  setEditingId]  = useState(null);
  const [editData,   setEditData]   = useState({ adults: 1, children: 0, almuerzo: false, comida: false, cena: false });
  const [savingEdit, setSavingEdit] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const [cuentaData, setCuentaData] = useState({ childPrice: "", tickets: [] });
  const [ticketForm, setTicketForm] = useState({ paidById: "", amount: "" });
  const [savingCuenta, setSavingCuenta] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "fiestas_signups"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setSignups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "eventos"), orderBy("fecha", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  function getLabel(key) {
    if (!key) return "";
    if (FIXED_LABELS[key]) return FIXED_LABELS[key];
    if (key.startsWith("evento_")) {
      const ev = eventos.find((e) => e.id === key.replace("evento_", ""));
      return ev ? ev.nombre : "Evento";
    }
    return key;
  }

  // Signups del evento de la URL (o todos si no hay)
  const baseSignups = useMemo(() => {
    if (!urlKey) return signups;
    return signups.filter((s) => getSKey(s) === urlKey);
  }, [signups, urlKey]);

  // Fechas disponibles
  const dates = useMemo(() => {
    const set = new Set(baseSignups.map((s) => s.date).filter(Boolean));
    return Array.from(set).sort();
  }, [baseSignups]);

  // Auto-select primera fecha
  useEffect(() => {
    if (dates.length > 0 && (!selDate || !dates.includes(selDate))) {
      setSelDate(dates[0]);
    }
  }, [dates]);

  // Signups del día seleccionado
  const dayRows = useMemo(() => {
    if (!selDate) return [];
    return baseSignups.filter((s) => s.date === selDate);
  }, [baseSignups, selDate]);

  // Eventos distintos en el día (para sub-selector)
  const eventsOnDay = useMemo(() => {
    const seen = new Set();
    const res = [];
    dayRows.forEach((s) => {
      const k = getSKey(s);
      if (!seen.has(k)) { seen.add(k); res.push(k); }
    });
    return res;
  }, [dayRows]);

  // Auto-select evento cuando cambia el día
  useEffect(() => {
    if (eventsOnDay.length === 0) return;
    if (selEvent && eventsOnDay.includes(selEvent)) return;
    setSelEvent(eventsOnDay[0]);
  }, [eventsOnDay]);

  // Signups del día + evento seleccionados
  const eventRows = useMemo(() => {
    if (!selEvent) return dayRows;
    return dayRows.filter((s) => getSKey(s) === selEvent);
  }, [dayRows, selEvent]);

  // Meals presentes en este día+evento
  const mealsOnDay = useMemo(() => {
    return MEALS.filter(({ key }) => eventRows.some((s) => !!s[key]));
  }, [eventRows]);

  // Auto-select primera meal
  useEffect(() => {
    if (mealsOnDay.length > 0 && (!selMeal || !mealsOnDay.find((m) => m.key === selMeal))) {
      setSelMeal(mealsOnDay[0].key);
    }
  }, [mealsOnDay]);

  // Filas para la meal seleccionada
  const mealRows = useMemo(() => {
    if (!selMeal) return [];
    return eventRows.filter((s) => !!s[selMeal]);
  }, [eventRows, selMeal]);

  const mealInfo = MEALS.find((m) => m.key === selMeal);
  const totAdults   = mealRows.reduce((acc, r) => acc + Number(r.adults   || 0), 0);
  const totChildren = mealRows.reduce((acc, r) => acc + Number(r.children || 0), 0);
  const cuentaDocId = useMemo(() => {
    if (!selDate || !selEvent || !selMeal) return null;
    return [selDate, selEvent, selMeal].join("__");
  }, [selDate, selEvent, selMeal]);

  useEffect(() => {
    if (!cuentaDocId) {
      setCuentaData({ childPrice: "", tickets: [] });
      setTicketForm({ paidById: "", amount: "" });
      return;
    }
    const unsub = onSnapshot(doc(db, "fiestas_cuentas", cuentaDocId), (snap) => {
      if (!snap.exists()) {
        setCuentaData({ childPrice: "", tickets: [] });
        setTicketForm({ paidById: "", amount: "" });
        setShowSettlement(false);
        return;
      }
      const data = snap.data() || {};
      const tickets = Array.isArray(data.tickets) ? data.tickets : [];
      setCuentaData({
        childPrice: data.childPrice ?? "",
        tickets,
      });
      setTicketForm({ paidById: "", amount: "" });
      // Auto-abrir si ya hay cuentas guardadas
      if (tickets.length > 0 || data.childPrice) setShowSettlement(true);
    });
    return () => unsub();
  }, [cuentaDocId]);

  const ticketOptions = useMemo(() => {
    return mealRows.map((row) => ({
      id: row.id,
      name: userName(row),
      adults: Number(row.adults || 0),
      children: Number(row.children || 0),
    }));
  }, [mealRows]);

  const ticketTotal = useMemo(() => {
    return (cuentaData.tickets || []).reduce((acc, t) => acc + Number(t.amount || 0), 0);
  }, [cuentaData]);

  const childPrice = Number(cuentaData.childPrice || 0);
  const childTotal = childPrice * totChildren;
  const remainingTotal = Math.max(0, ticketTotal - childTotal);
  const adultShare = totAdults > 0 ? remainingTotal / totAdults : 0;

  const payerSummary = useMemo(() => {
    const map = new Map();

    mealRows.forEach((row) => {
      map.set(row.id, {
        id: row.id,
        name: userName(row),
        adults: Number(row.adults || 0),
        children: Number(row.children || 0),
        paid: 0,
      });
    });

    (cuentaData.tickets || []).forEach((ticket) => {
      if (!ticket?.paidById) return;
      const existing = map.get(ticket.paidById) || {
        id: ticket.paidById,
        name: ticket.paidByName || "Usuario",
        adults: 0,
        children: 0,
        paid: 0,
      };
      existing.paid += Number(ticket.amount || 0);
      map.set(ticket.paidById, existing);
    });

    return Array.from(map.values())
      .map((item) => {
        const owes = item.children * childPrice + item.adults * adultShare;
        return {
          ...item,
          owes,
          balance: item.paid - owes,
        };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [mealRows, cuentaData, childPrice, adultShare]);

  // Lista mínima de transferencias para saldar deudas
  const transferList = useMemo(() => {
    if (!adultShare && !childPrice) return [];
    const creditors = payerSummary
      .filter((p) => p.balance > 0.005)
      .map((p) => ({ ...p, rem: p.balance }));
    const debtors = payerSummary
      .filter((p) => p.balance < -0.005)
      .map((p) => ({ ...p, rem: Math.abs(p.balance) }));
    const transfers = [];
    let ci = 0; let di = 0;
    while (ci < creditors.length && di < debtors.length) {
      const amount = Math.min(creditors[ci].rem, debtors[di].rem);
      transfers.push({ from: debtors[di].name, to: creditors[ci].name, amount });
      creditors[ci].rem -= amount;
      debtors[di].rem -= amount;
      if (creditors[ci].rem < 0.005) ci++;
      if (debtors[di].rem < 0.005) di++;
    }
    return transfers;
  }, [payerSummary, adultShare, childPrice]);

  const onEditClick = (row) => {
    setEditingId(row.id);
    setEditData({
      adults:   Number(row.adults   || 0),
      children: Number(row.children || 0),
      almuerzo: !!row.almuerzo,
      comida:   !!row.comida,
      cena:     !!row.cena,
    });
  };

  const onSaveEdit = async (id) => {
    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "fiestas_signups", id), {
        adults:   Number(editData.adults),
        children: Number(editData.children),
        almuerzo: !!editData.almuerzo,
        comida:   !!editData.comida,
        cena:     !!editData.cena,
      });
      setEditingId(null);
    } catch (err) { console.error(err); alert("No se pudo guardar."); }
    finally { setSavingEdit(false); }
  };

  const onDelete = async (id) => {
    const first = window.confirm(
      "\u00bfEstás seguro de borrar esta inscripción?\nSi hay cuentas guardadas para este día/evento/comida también se borrarán."
    );
    if (!first) return;
    const second = window.confirm(
      "⚠️ ¿Seguro? Esta acción no se puede deshacer. Se borrará la inscripción y las cuentas guardadas."
    );
    if (!second) return;
    try {
      await deleteDoc(doc(db, "fiestas_signups", id));
      if (cuentaDocId) {
        await deleteDoc(doc(db, "fiestas_cuentas", cuentaDocId));
      }
    } catch (err) { console.error(err); alert("No se pudo borrar."); }
  };

  const saveCuenta = async (nextData) => {
    if (!cuentaDocId) return;
    setSavingCuenta(true);
    try {
      await setDoc(doc(db, "fiestas_cuentas", cuentaDocId), {
        date: selDate,
        eventKey: selEvent,
        mealKey: selMeal,
        childPrice: Number(nextData.childPrice || 0),
        tickets: nextData.tickets,
      }, { merge: true });
    } catch (err) {
      console.error(err);
      alert("No se pudo guardar el ajuste de cuentas.");
    } finally {
      setSavingCuenta(false);
    }
  };

  const onChildPriceChange = async (value) => {
    const normalized = value.replace(",", ".");
    const nextData = { ...cuentaData, childPrice: normalized };
    setCuentaData(nextData);
    await saveCuenta(nextData);
  };

  const onAddTicket = async () => {
    if (!ticketForm.paidById || !ticketForm.amount) {
      alert("Selecciona quien ha pagado y el importe del ticket.");
      return;
    }
    const amount = Number(String(ticketForm.amount).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("El importe del ticket debe ser mayor que 0.");
      return;
    }
    const payer = ticketOptions.find((item) => item.id === ticketForm.paidById);
    if (!payer) {
      alert("Selecciona un usuario valido.");
      return;
    }
    const nextData = {
      ...cuentaData,
      tickets: [
        ...(cuentaData.tickets || []),
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          paidById: payer.id,
          paidByName: payer.name,
          amount,
        },
      ],
    };
    setCuentaData(nextData);
    setTicketForm({ paidById: "", amount: "" });
    await saveCuenta(nextData);
  };

  const onDeleteTicket = async (ticketId) => {
    const nextData = {
      ...cuentaData,
      tickets: (cuentaData.tickets || []).filter((ticket) => ticket.id !== ticketId),
    };
    setCuentaData(nextData);
    await saveCuenta(nextData);
  };

  const stepLabel = (n, text) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <span style={{
        width: 18, height: 18, borderRadius: "50%",
        background: "var(--accent)", color: "white",
        fontWeight: 800, fontSize: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{n}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 0.5 }}>{text}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px 12px 48px", boxSizing: "border-box" }}>

      <h2 style={{ textAlign: "center", margin: "0 0 16px", fontSize: 20, color: "var(--text)" }}>
        {getLabel(urlKey) || "Listado de Inscritos"}
      </h2>

      {loading ? (
        <div className="centered">Cargando...</div>
      ) : dates.length === 0 ? (
        <div style={{ textAlign: "center", color: "#999", padding: 40 }}>No hay inscripciones</div>
      ) : (
        <>
          {/* ─── PASO 1: Selector de DIA ─── */}
          <div style={{
            background: "white", borderRadius: 10, padding: "8px 10px",
            marginBottom: 8, border: "2px solid var(--accent)",
            boxShadow: "0 1px 6px rgba(106,143,58,0.1)",
          }}>
            {stepLabel(1, "Selecciona el día")}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {dates.map((date) => {
                const count = baseSignups.filter((s) => s.date === date).length;
                const active = selDate === date;
                return (
                  <button key={date}
                    onClick={() => { setSelDate(date); setEditingId(null); setSelMeal(null); }}
                    style={{
                      padding: "5px 10px", borderRadius: 14,
                      border: active ? "2px solid var(--accent)" : "1px solid #c8dda8",
                      background: active ? "var(--accent)" : "#f5faea",
                      color: active ? "white" : "#444",
                      fontWeight: 600, fontSize: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                      boxShadow: active ? "0 2px 6px rgba(106,143,58,0.3)" : "none",
                    }}>
                    {formatDateChip(date)}
                    <span style={{
                      background: active ? "rgba(255,255,255,0.3)" : "rgba(106,143,58,0.18)",
                      color: active ? "white" : "var(--accent)",
                      borderRadius: 8, padding: "0 5px", fontSize: 10, fontWeight: 800,
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── PASO 2: Sub-selector de EVENTO (solo si hay >1 en el dia) ─── */}
          {eventsOnDay.length > 1 && (
            <div style={{
              background: "white", borderRadius: 10, padding: "8px 10px",
              marginBottom: 8, border: "1px solid #b8d49a",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              {stepLabel(2, "Selecciona el evento")}
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {eventsOnDay.map((evKey) => {
                  const active = selEvent === evKey;
                  return (
                    <button key={evKey}
                      onClick={() => { setSelEvent(evKey); setEditingId(null); setSelMeal(null); }}
                      style={{
                        padding: "4px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: active ? "2px solid var(--accent)" : "1px solid #c8dda8",
                        background: active ? "var(--accent)" : "#f5faea",
                        color: active ? "white" : "#444",
                        boxShadow: active ? "0 1px 6px rgba(106,143,58,0.25)" : "none",
                      }}>
                      {getLabel(evKey)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── PASO 3: Selector de COMIDA ─── */}
          {mealsOnDay.length > 0 ? (
            <>
              <div style={{
                background: "white", borderRadius: 10, padding: "8px 10px",
                marginBottom: 10, border: "1px solid #b8d49a",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                {stepLabel(eventsOnDay.length > 1 ? 3 : 2, "Selecciona el tipo de comida")}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {mealsOnDay.map(({ key, label, color }) => {
                    const cnt = eventRows.filter((s) => !!s[key]).length;
                    const active = selMeal === key;
                    return (
                      <button key={key}
                        onClick={() => { setSelMeal(key); setEditingId(null); }}
                        style={{
                          padding: "5px 14px", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer",
                          border: `2px solid ${color}`,
                          background: active ? color : "white",
                          color: active ? "white" : color,
                          boxShadow: active ? `0 2px 8px ${color}44` : "none",
                          display: "flex", alignItems: "center", gap: 6,
                          transition: "all 0.12s",
                        }}>
                        {label}
                        <span style={{
                          background: active ? "rgba(255,255,255,0.3)" : color + "22",
                          borderRadius: 8, padding: "0 6px", fontSize: 11, fontWeight: 800,
                        }}>{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ─── TABLA ─── */}
              {mealRows.length === 0 ? (
                <div style={{ textAlign: "center", color: "#999", padding: 24 }}>Sin inscritos</div>
              ) : (
                <div style={{
                  background: "white", borderRadius: 14, overflow: "hidden",
                  boxShadow: "0 3px 16px rgba(0,0,0,0.09)",
                  border: `1px solid ${mealInfo?.color}44`,
                }}>
                  {/* Cabecera */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 58px 34px 34px 76px",
                    padding: "7px 10px",
                    background: mealInfo?.color || "#3a6ea5",
                    color: "white", fontSize: 11, fontWeight: 700,
                  }}>
                    <span>Usuario</span>
                    <span style={{ textAlign: "center" }}>Fecha</span>
                    <span style={{ textAlign: "center" }}>Ad.</span>
                    <span style={{ textAlign: "center" }}>Ni.</span>
                    <span style={{ textAlign: "center" }}>Acciones</span>
                  </div>

                  {/* Filas */}
                  {mealRows.map((s, idx) => {
                    const canEdit = isAdmin || (user && s.uid && user.uid === s.uid);
                    const isEditing = editingId === s.id;
                    return (
                      <div key={s.id} style={{ borderTop: "1px solid #f0f5e8", background: idx % 2 === 1 ? (mealInfo?.bg || "#fafafa") : "white" }}>
                        {isEditing ? (
                          <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", background: "#fffde7" }}>
                            <span style={{ fontWeight: 600, flex: "1 1 100%", fontSize: 14 }}>{userName(s)}</span>
                            {[["almuerzo","Alm."],["comida","Com."],["cena","Cena"]].map(([field, lbl]) => (
                              <label key={field} style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
                                <input type="checkbox" checked={!!editData[field]}
                                  onChange={(e) => setEditData((p) => ({ ...p, [field]: e.target.checked }))} />
                                {lbl}
                              </label>
                            ))}
                            <input type="number" min="0" value={editData.adults}
                              onChange={(e) => setEditData((p) => ({ ...p, adults: e.target.value }))}
                              style={{ width: 52, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} placeholder="Ad." />
                            <input type="number" min="0" value={editData.children}
                              onChange={(e) => setEditData((p) => ({ ...p, children: e.target.value }))}
                              style={{ width: 52, padding: "4px 6px", border: "1px solid #ddd", borderRadius: 6, fontSize: 13 }} placeholder="Ni." />
                            <button className="btn small" onClick={() => onSaveEdit(s.id)} disabled={savingEdit}>{savingEdit ? "..." : "Guardar"}</button>
                            <button className="btn outline small" onClick={() => setEditingId(null)}>Cancelar</button>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 58px 34px 34px 76px", padding: "6px 10px", alignItems: "center" }}>
                            <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName(s)}</span>
                            <span style={{ textAlign: "center", fontSize: 11, color: "#666" }}>{formatDateChip(s.date)}</span>
                            <span style={{ textAlign: "center", fontWeight: 700, color: "#3a6ea5", fontSize: 14 }}>{s.adults || 0}</span>
                            <span style={{ textAlign: "center", fontWeight: 700, color: "#d63a7a", fontSize: 14 }}>{s.children || 0}</span>
                            <div style={{ display: "flex", gap: 3, justifyContent: "center", alignItems: "center" }}>
                              {canEdit && (
                                <button className="btn small" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => onEditClick(s)}>Editar</button>
                              )}
                              <button className="btn outline small" style={{ padding: "2px 6px", fontSize: 10, color: "#b42318", borderColor: "#f0cccc" }} onClick={() => onDelete(s.id)}>Borrar</button>
                              <button
                                onClick={() => alert("🗑️ BORRAR INSCRIPCIÓN\n\nAl pulsar Borrar se te pedirá confirmación dos veces.\n\nSi confirmas, se borrará:\n• La inscripción de esta persona\n• Las cuentas guardadas para este día/evento/comida\n\n⚠️ Esta acción no se puede deshacer.")}
                                style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #aaa", background: "#f5f5f5", color: "#666", fontSize: 10, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 }}
                              >?</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Totales */}
                  <div style={{ display: "flex", gap: 6, padding: "8px 10px", background: "#f0f6e8", borderTop: "2px solid #c8dda8" }}>
                    <div style={{ flex: 1, textAlign: "center", background: "#6a50a0", borderRadius: 8, padding: "6px 4px", color: "white" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, letterSpacing: 0.5 }}>ADULTOS</div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{totAdults}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", background: "#d63a7a", borderRadius: 8, padding: "6px 4px", color: "white" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, letterSpacing: 0.5 }}>NINOS</div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{totChildren}</div>
                    </div>
                    <div style={{ flex: 1, textAlign: "center", background: "#3a9a5a", borderRadius: 8, padding: "6px 4px", color: "white" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, opacity: 0.85, letterSpacing: 0.5 }}>TOTAL</div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{totAdults + totChildren}</div>
                    </div>
                  </div>

                  <div style={{ padding: "10px", borderTop: "1px solid #e7eedb", background: "#fbfdf7" }}>
                    <button
                      className="btn"
                      style={{ width: "100%", fontSize: 13, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                      onClick={() => setShowSettlement((prev) => !prev)}
                    >
                      <span>{showSettlement ? "▲ Cerrar ajuste de cuentas" : "🧾 AJUSTE DE CUENTAS"}</span>
                      {!showSettlement && (cuentaData.tickets || []).length > 0 && (
                        <span style={{ background: "#2f6b1b", color: "white", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 800 }}>✓ Guardado</span>
                      )}
                    </button>

                    {showSettlement && (
                      <div style={{ marginTop: 10, border: "1px solid #d8e6c2", borderRadius: 12, background: "white", padding: 12 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>
                          Ajuste para {mealInfo?.label?.toLowerCase() || "la comida"}
                        </div>

                        <div style={{ display: "grid", gap: 10 }}>
                          <div style={{ border: "1px solid #edf2e4", borderRadius: 10, padding: 10, background: "#fcfef9" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 8 }}>TICKETS</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 92px auto", gap: 8 }}>
                              <select
                                value={ticketForm.paidById}
                                onChange={(e) => setTicketForm((prev) => ({ ...prev, paidById: e.target.value }))}
                                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #d6dfc6", fontSize: 13 }}
                              >
                                <option value="">Quien ha pagado</option>
                                {ticketOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.name} ({opt.adults}A/{opt.children}N)
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Precio"
                                value={ticketForm.amount}
                                onChange={(e) => setTicketForm((prev) => ({ ...prev, amount: e.target.value }))}
                                style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid #d6dfc6", fontSize: 13 }}
                              />
                              <button className="btn small" onClick={onAddTicket} disabled={savingCuenta}>Anadir ticket</button>
                            </div>

                            {(cuentaData.tickets || []).length > 0 ? (
                              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                                {(cuentaData.tickets || []).map((ticket, idx) => (
                                  <div key={ticket.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto", gap: 8, alignItems: "center", fontSize: 13, padding: "7px 8px", borderRadius: 8, background: idx % 2 ? "#fafcf5" : "#f4f9eb" }}>
                                    <span style={{ fontWeight: 700, color: "#78905a" }}>{idx + 1}</span>
                                    <span style={{ fontWeight: 600 }}>{ticket.paidByName}</span>
                                    <span style={{ fontWeight: 800, color: "#2f5a1e" }}>{money(ticket.amount)}</span>
                                    <button className="btn outline small" style={{ padding: "3px 8px", fontSize: 11 }} onClick={() => onDeleteTicket(ticket.id)}>Quitar</button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div style={{ marginTop: 10, color: "#888", fontSize: 12 }}>Todavia no hay tickets anadidos.</div>
                            )}
                          </div>

                          <div style={{ border: "1px solid #edf2e4", borderRadius: 10, padding: 10, background: "#fcfef9" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 8 }}>PRECIO POR NINO</div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={cuentaData.childPrice}
                                onChange={(e) => onChildPriceChange(e.target.value)}
                                placeholder="Cuanto paga cada nino"
                                style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #d6dfc6", fontSize: 13 }}
                              />
                              <div style={{ minWidth: 96, textAlign: "right", fontSize: 12, color: "#666" }}>
                                {totChildren} ninos
                              </div>
                            </div>
                          </div>

                          <div style={{ border: "1px solid #edf2e4", borderRadius: 10, padding: 10, background: "#f7fbf0" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 8 }}>RESUMEN</div>
                            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Total evento</span><strong>{money(ticketTotal)}</strong></div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Precio por nino establecido</span><strong>{money(childPrice)}</strong></div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Total ninos ({totChildren})</span><strong>{money(childTotal)}</strong></div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span>Resto a repartir entre adultos ({totAdults})</span><strong>{money(remainingTotal)}</strong></div>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 6, borderTop: "1px dashed #d6dfc6" }}><span>Sale por adulto</span><strong>{money(adultShare)}</strong></div>
                            </div>
                          </div>

                          <div style={{ border: "1px solid #edf2e4", borderRadius: 10, padding: 10, background: "#fcfef9" }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 8 }}>BALANCE POR PERSONA</div>
                            {payerSummary.length === 0 ? (
                              <div style={{ color: "#888", fontSize: 12 }}>Cuando anadas tickets y precio por nino, aqui saldra el balance de cada persona.</div>
                            ) : (
                              <div style={{ display: "grid", gap: 6 }}>
                                {payerSummary.map((payer) => {
                                  const isPayer = payer.paid > 0;
                                  const isZero = Math.abs(payer.balance) < 0.005;
                                  const isPos = payer.balance > 0.005;
                                  const bg = isZero ? "#f5f5f5" : isPos ? "#eef8e8" : "#fff2f2";
                                  const border = isZero ? "#ddd" : isPos ? "#cfe4be" : "#f0cccc";
                                  return (
                                    <div key={payer.id} style={{ borderRadius: 8, padding: "8px 9px", background: bg, border: `1px solid ${border}` }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, fontWeight: 700 }}>
                                        <span>{payer.name} {isPayer ? "🧾" : ""}</span>
                                        <span style={{ color: isZero ? "#888" : isPos ? "#2f6b1b" : "#b42318" }}>
                                          {isZero ? "En paz ✓" : isPos ? `↑ recibe ${money(payer.balance)}` : `↓ debe ${money(Math.abs(payer.balance))}`}
                                        </span>
                                      </div>
                                      <div style={{ marginTop: 3, fontSize: 11, color: "#666", display: "flex", gap: 10, flexWrap: "wrap" }}>
                                        {isPayer && <span>Pago: {money(payer.paid)}</span>}
                                        <span>Su parte: {money(payer.owes)}</span>
                                        <span style={{ fontSize: 10, color: "#999" }}>({payer.adults}A/{payer.children}N)</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {transferList.length > 0 && (
                            <div style={{ border: "2px solid #f59e0b", borderRadius: 10, padding: 10, background: "#fffbeb" }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>💸 QUIEN PAGA A QUIEN</div>
                              <div style={{ display: "grid", gap: 6 }}>
                                {transferList.map((t, i) => (
                                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, padding: "7px 10px", background: "white", borderRadius: 8, border: "1px solid #fde68a" }}>
                                    <span style={{ fontWeight: 700, color: "#b42318", flex: 1 }}>{t.from}</span>
                                    <span style={{ color: "#f59e0b", fontWeight: 800, fontSize: 18 }}>→</span>
                                    <span style={{ fontWeight: 700, color: "#2f6b1b", flex: 1, textAlign: "right" }}>{t.to}</span>
                                    <span style={{ background: "#f59e0b", color: "white", borderRadius: 8, padding: "3px 10px", fontWeight: 800, fontSize: 13, minWidth: 72, textAlign: "center" }}>{money(t.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}


                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", color: "#999", padding: 30 }}>
              No hay inscripciones para este dia
            </div>
          )}
        </>
      )}

      <div className="page-bottom-nav" style={{ marginTop: 16 }}>
        <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
        <button className="nav-bottom-btn accent" onClick={() => navigate("/fiestas/list")}>{"📋"} Eventos</button>
      </div>
    </div>
  );
}