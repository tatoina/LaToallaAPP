import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  serverTimestamp,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
  doc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const DAYS_ES = ["L", "M", "X", "J", "V", "S", "D"];
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const WEEKDAYS_ES = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

function isoDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function getDayName(iso) {
  const d = new Date(iso + "T12:00:00");
  return WEEKDAYS_ES[d.getDay() === 0 ? 6 : d.getDay() - 1];
}
function formatShort(iso) {
  const [, m, d] = iso.split("-");
  return `${parseInt(d)} ${MONTHS_ES[parseInt(m) - 1]}`;
}

function formatDateLargo(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  const wd = WEEKDAYS_ES[d.getDay() === 0 ? 6 : d.getDay() - 1];
  return `${wd}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function MultiDateCalendar({ selected, onChange, defaultMonth }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(defaultMonth ?? today.getMonth());

  const startDow = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(v => v - 1); setViewMonth(11); }
    else setViewMonth(v => v - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(v => v + 1); setViewMonth(0); }
    else setViewMonth(v => v + 1);
  };
  const toggle = (iso) => {
    const next = new Set(selected);
    if (next.has(iso)) next.delete(iso); else next.add(iso);
    onChange(next);
  };

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(isoDate(viewYear, viewMonth, d));

  const monthLabel = MONTHS_ES[viewMonth].charAt(0).toUpperCase() + MONTHS_ES[viewMonth].slice(1);

  return (
    <div className="mdc-wrap">
      <div className="mdc-nav">
        <button type="button" className="mdc-nav-btn" onClick={prevMonth}>‹</button>
        <span className="mdc-month-label">{monthLabel} de {viewYear}</span>
        <button type="button" className="mdc-nav-btn" onClick={nextMonth}>›</button>
      </div>
      <div className="mdc-grid">
        {DAYS_ES.map(d => <div key={d} className="mdc-dow">{d}</div>)}
        {cells.map((iso, i) =>
          iso ? (
            <button
              key={iso}
              type="button"
              className={`mdc-day${selected.has(iso) ? " mdc-day--sel" : ""}`}
              onClick={() => toggle(iso)}
            >
              {parseInt(iso.split("-")[2])}
            </button>
          ) : <div key={`e${i}`} />
        )}
      </div>
    </div>
  );
}

export default function EventSignupForm({ eventType, title, defaultMonth, singleDay, fixedDate, dateInfoText, configKey }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [editingDay, setEditingDay] = useState(!fixedDate);
  const [pendingDate, setPendingDate] = useState("");
  const [settingDate, setSettingDate] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const [selectedDates, setSelectedDates] = useState(() =>
    singleDay && fixedDate ? new Set([fixedDate]) : new Set()
  );
  const [almuerzo, setAlmuerzo] = useState(false);
  const [comida, setComida] = useState(false);
  const [cena, setCena] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const popupTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    };
  }, []);

  const resetForm = () => {
    setSelectedDates(singleDay && fixedDate ? new Set([fixedDate]) : new Set());
    setAlmuerzo(false);
    setComida(false);
    setCena(false);
    setAdults(1);
    setChildren(0);
    setError("");
    setMsg("");
  };

  async function getConflictsForDate(date) {
    try {
      const field = user?.uid ? "uid" : user?.email ? "email" : null;
      const val = user?.uid || user?.email || null;
      if (!field) return [];
      const q = query(
        collection(db, "fiestas_signups"),
        where(field, "==", val),
        where("date", "==", date),
        where("eventType", "==", eventType)
      );
      const snap = await getDocs(q);
      const conflicts = [];
      snap.forEach((d) => {
        const data = d.data();
        if (almuerzo && data.almuerzo) conflicts.push("Almuerzo");
        if (comida   && data.comida)   conflicts.push("Comida");
        if (cena     && data.cena)     conflicts.push("Cena");
      });
      return [...new Set(conflicts)];
    } catch {
      return [];
    }
  }

  const handleEstablecerFecha = async () => {
    if (!pendingDate) return;
    const formatted = formatDateLargo(pendingDate);
    const confirmed = window.confirm(
      `\u00bfEstablecer "${formatted}" como fecha del evento?\n\nSe borrar\u00e1n las inscripciones anteriores y se notificar\u00e1 a todos los usuarios por email.`
    );
    if (!confirmed) return;
    setSettingDate(true);
    try {
      const q = query(collection(db, "fiestas_signups"), where("eventType", "==", eventType));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "fiestas_signups", d.id))));
      await setDoc(doc(db, "config", configKey), { fixedDate: pendingDate, dateInfoText: formatted, notifyUsers: true }, { merge: true });
      setPendingDate("");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setSettingDate(false);
    }
  };
  const handleEliminarFecha = async () => {
    if (!window.confirm("¿Eliminar la fecha del evento?\n\nEl evento quedará sin fecha hasta que se establezca una nueva. No se borrarán las inscripciones existentes.")) return;
    try {
      await updateDoc(doc(db, "config", configKey), { fixedDate: deleteField(), dateInfoText: deleteField() });
      setEditingDay(true);
      setPendingDate("");
    } catch (err) {
      alert("Error: " + err.message);
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!singleDay && selectedDates.size === 0) return setError("Selecciona al menos una fecha.");
    if (!almuerzo && !comida && !cena)
      return setError("Marca al menos Almuerzo, Comida o Cena.");
    if (Number(adults) < 0 || Number(children) < 0)
      return setError("Los números no pueden ser negativos.");

    setSaving(true);
    try {
      const sortedDates = [...selectedDates].sort();
      const conflictDays = [];
      for (const date of sortedDates) {
        const c = await getConflictsForDate(date);
        if (c.length > 0) {
          conflictDays.push(`${formatShort(date)} (${c.join(", ")})`);
        }
      }
      if (conflictDays.length > 0) {
        setError(`Ya tienes inscripción en: ${conflictDays.join(" · ")}. Ve al Listado para editarla.`);
        setSaving(false);
        return;
      }

      let nameToSave = null;
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const d = userDoc.data();
            nameToSave = d.alias || d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim() || null;
          }
        } catch {}
      }

      for (const date of sortedDates) {
        await addDoc(collection(db, "fiestas_signups"), {
          uid: user?.uid || null,
          email: user?.email || null,
          name: nameToSave,
          date,
          adults: Number(adults),
          children: Number(children),
          almuerzo: !!almuerzo,
          comida: !!comida,
          cena: !!cena,
          eventType,
          createdAt: serverTimestamp(),
        });
      }

      setShowPopup(true);
      popupTimerRef.current = setTimeout(() => {
        setShowPopup(false);
        resetForm();
      }, 2500);
    } catch (err) {
      console.error("Error guardando inscripción:", err);
      setError("No se pudo guardar la inscripción. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const sortedSelected = [...selectedDates].sort();

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-header-title">{title}</h2>
      </div>
      <div className="card" style={{ padding: 16 }}>
        {showHelp && (
          <div
            onClick={() => setShowHelp(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
              zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#fff", borderRadius: 16, padding: "24px 20px",
                maxWidth: 360, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 14, color: "var(--accent)" }}>
                {"📅"} ¿Cómo funciona?
              </div>
              {singleDay ? (
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: "#333" }}>
                  <li>El <strong>primer usuario en entrar</strong> selecciona la fecha del evento y pulsa <em>"Establecer esta fecha"</em>.</li>
                  <li>Se envía un <strong>email automático</strong> a todos los usuarios de la app avisando de la fecha.</li>
                  <li>A partir de ese momento, el resto puede <strong>inscribirse</strong> con sus comidas y número de personas.</li>
                </ol>
              ) : (
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.8, color: "#333" }}>
                  <li>Pulsa en el <strong>calendario</strong> los días que quieras apuntarte — puedes marcar varios a la vez.</li>
                  <li>Selecciona tus <strong>comidas</strong> (Almuerzo, Comida, Cena) — se aplicarán a <em>todos los días</em> que hayas marcado.</li>
                  <li>Elige el <strong>número de adultos y niños</strong> y pulsa <em>"Apuntarme"</em>.</li>
                </ol>
              )}
              <div style={{ marginTop: 16, fontSize: 12, color: "#888", background: "#f5f5f5", borderRadius: 8, padding: "8px 12px" }}>
                {singleDay
                  ? <>{"⚠️"} Al cambiar la fecha se borran las inscripciones anteriores.</>
                  : <>{"💡"} Si quieres días con distintas comidas, envía una inscripción por cada grupo.</>}
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="btn accent"
                style={{ marginTop: 18, width: "100%" }}
              >
                Entendido
              </button>
            </div>
          </div>
        )}
        <form onSubmit={handleSubmit} className="form" style={{ marginTop: 8 }}>
          {singleDay ? (
            <div style={{
              background: "rgba(106,143,58,0.10)",
              border: "1.5px solid rgba(106,143,58,0.25)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 8,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#666" }}>{"📅"} Selecciona la fecha del evento</span>
                <button
                  type="button"
                  onClick={() => setShowHelp(true)}
                  title="¿Cómo funciona?"
                  style={{
                    width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #aaa",
                    background: "#fff", color: "#666", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", lineHeight: 1, padding: 0, flexShrink: 0,
                  }}
                >
                  ?
                </button>
              </div>
              {!editingDay ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: "var(--accent)" }}>
                    {dateInfoText || fixedDate}
                  </span>
                  <button type="button" onClick={() => setEditingDay(true)}
                    style={{ fontSize: 12, background: "none", border: "1px solid #ccc", color: "#666", cursor: "pointer", padding: "2px 8px", borderRadius: 6, lineHeight: 1.4 }}>
                    {"✏️"}
                  </button>
                  {isAdmin && (
                    <button type="button" onClick={handleEliminarFecha}
                      style={{ fontSize: 12, background: "none", border: "1px solid #f0cccc", color: "#b42318", cursor: "pointer", padding: "2px 8px", borderRadius: 6, lineHeight: 1.4 }}
                      title="Eliminar fecha">
                      🗑️
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="date"
                    value={pendingDate}
                    onChange={(e) => setPendingDate(e.target.value)}
                    style={{ display: "block", width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #ddd", fontSize: 15, boxSizing: "border-box", marginBottom: 8 }}
                  />
                  {pendingDate && (
                    <>
                      <div style={{ textAlign: "center", fontSize: 16, fontWeight: 700, color: "var(--accent)", marginBottom: 8 }}>
                        {formatDateLargo(pendingDate)}
                      </div>
                      <div style={{ fontSize: 12, color: "#8a5c00", background: "rgba(255,160,0,0.10)", border: "1px solid rgba(255,140,0,0.3)", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
                        {"⚠️"} {"Se borrar\u00e1n las inscripciones anteriores y se notificar\u00e1 a todos."}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="btn accent" onClick={handleEstablecerFecha} disabled={settingDate} style={{ flex: 1 }}>
                          {settingDate ? "Guardando..." : "✅ Establecer esta fecha"}
                        </button>
                        {fixedDate && (
                          <button type="button" className="btn outline" onClick={() => { setEditingDay(false); setPendingDate(""); }} style={{ flex: "none" }}>Cancelar</button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <label style={{ margin: 0 }}>Fechas</label>
                <button
                  type="button"
                  onClick={() => setShowHelp(true)}
                  title="¿Cómo funciona?"
                  style={{
                    width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #aaa",
                    background: "#fff", color: "#666", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", lineHeight: 1, padding: 0, flexShrink: 0,
                  }}
                >
                  ?
                </button>
              </div>
              <MultiDateCalendar selected={selectedDates} onChange={setSelectedDates} defaultMonth={defaultMonth} />
              {sortedSelected.length > 0 && (
                <div className="mdc-chips">
                  {sortedSelected.map(iso => (
                    <span key={iso} className="mdc-chip">
                      {formatShort(iso)} · {getDayName(iso)}
                      <button
                        type="button"
                        className="mdc-chip-remove"
                        onClick={() => {
                          const next = new Set(selectedDates);
                          next.delete(iso);
                          setSelectedDates(next);
                        }}
                      >✕</button>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center", justifyContent: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={almuerzo} onChange={(e) => setAlmuerzo(e.target.checked)} />
              Almuerzo
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={comida} onChange={(e) => setComida(e.target.checked)} />
              Comida
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={cena} onChange={(e) => setCena(e.target.checked)} />
              Cena
            </label>
          </div>
          {!singleDay && selectedDates.size > 1 && (
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--accent)", marginTop: 4 }}>
              {"✅"} Las comidas seleccionadas se aplicarán a los {selectedDates.size} días marcados
            </div>
          )}

          <div style={{ display: "flex", gap: 24, marginTop: 12, justifyContent: "center", alignItems: "center" }}>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 15 }}>
              Adultos
              <input
                type="number" min="0" value={adults} required
                inputMode="numeric" pattern="[0-9]*"
                onChange={(e) => setAdults(e.target.value)}
                style={{ width: 72, textAlign: "center", padding: "10px 8px", border: "1.5px solid #ddd", borderRadius: 10, fontSize: 22, fontWeight: 700 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 15 }}>
              Niños
              <input
                type="number" min="0" value={children}
                inputMode="numeric" pattern="[0-9]*"
                onChange={(e) => setChildren(e.target.value)}
                style={{ width: 72, textAlign: "center", padding: "10px 8px", border: "1.5px solid #ddd", borderRadius: 10, fontSize: 22, fontWeight: 700 }}
              />
            </label>
          </div>

          <div className="signup-btn-row">
            <button className="btn signup-submit-btn" type="submit" disabled={saving}>
              {saving ? "Guardando..." : selectedDates.size > 1 ? `Apuntarme (${selectedDates.size} días)` : "Apuntarme"}
            </button>
            <button type="button" className="signup-clear-btn" onClick={resetForm}>
              Limpiar
            </button>
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          {msg && <p className="info">{msg}</p>}

          <div className="page-bottom-nav" style={{ marginTop: 12 }}>
            <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
            <button className="nav-bottom-btn accent" onClick={() => navigate("/fiestas/list")}>📋 Ver listado</button>
          </div>
        </form>
      </div>

      {showPopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Inscripción realizada"
          style={{
            position: "fixed", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 99999, background: "rgba(0,0,0,0.35)", padding: 16,
          }}
          onClick={() => { setShowPopup(false); resetForm(); }}
        >
          <div
            style={{
              background: "#fff", borderRadius: 10, padding: "22px 28px",
              minWidth: 260, maxWidth: "90%", textAlign: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.6, marginBottom: 8 }}>
              ✅ INSCRIPCIÓN REALIZADA
            </div>
            <div style={{ color: "#444", marginBottom: 12 }}>
              Gracias — tu inscripción ha sido registrada.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              <button className="btn small" onClick={() => { setShowPopup(false); resetForm(); }}>Cerrar</button>
              <button className="btn outline small" onClick={() => { setShowPopup(false); navigate("/fiestas/list"); }}>Ir al listado</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
