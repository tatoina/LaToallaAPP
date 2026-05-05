import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
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

export default function EventSignupForm({ eventType, title, defaultMonth }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedDates, setSelectedDates] = useState(new Set());
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
    setSelectedDates(new Set());
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (selectedDates.size === 0) return setError("Selecciona al menos una fecha.");
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
        <form onSubmit={handleSubmit} className="form" style={{ marginTop: 8 }}>
          <label>Fechas</label>
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

          <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
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

          <label style={{ marginTop: 8 }}>
            Adultos
            <input type="number" min="0" value={adults} onChange={(e) => setAdults(e.target.value)} required />
          </label>
          <label>
            Niños
            <input type="number" min="0" value={children} onChange={(e) => setChildren(e.target.value)} />
          </label>

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
        </form>
      </div>

      <div className="page-bottom-nav">
        <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
        <button className="nav-bottom-btn accent" onClick={() => navigate("/fiestas/list")}>📋 Ver listado</button>
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
