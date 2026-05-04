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

/**
 * Formulario de inscripción reutilizable.
 * Props:
 *   eventType  — identificador del evento (ej: "fiestas", "ferias", "juventud")
 *   title      — título que se muestra en la cabecera
 */
export default function EventSignupForm({ eventType, title }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
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
    setSelectedDate(new Date().toISOString().slice(0, 10));
    setAlmuerzo(false);
    setComida(false);
    setCena(false);
    setAdults(1);
    setChildren(0);
    setError("");
    setMsg("");
  };

  // Returns array of meal labels already signed up for that day+event
  async function getConflictingMeals() {
    try {
      const field = user?.uid ? "uid" : user?.email ? "email" : null;
      const val = user?.uid || user?.email || null;
      if (!field) return [];
      const q = query(
        collection(db, "fiestas_signups"),
        where(field, "==", val),
        where("date", "==", selectedDate),
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
      // Deduplicate
      return [...new Set(conflicts)];
    } catch {
      return [];
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!selectedDate) return setError("Selecciona una fecha.");
    if (!almuerzo && !comida && !cena)
      return setError("Marca al menos Almuerzo, Comida o Cena.");
    if (Number(adults) < 0 || Number(children) < 0)
      return setError("Los números no pueden ser negativos.");

    setSaving(true);
    try {
      const conflicts = await getConflictingMeals();
      if (conflicts.length > 0) {
        setError(
          `Ya tienes una inscripción para ${conflicts.join(" y ")} ese día. Ve al Listado para editarla.`
        );
        setSaving(false);
        return;
      }

      let nameToSave = null;
      if (user?.uid) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const d = userDoc.data();
            nameToSave =
              d.name ||
              `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
              null;
          }
        } catch {}
      }

      await addDoc(collection(db, "fiestas_signups"), {
        uid: user?.uid || null,
        email: user?.email || null,
        name: nameToSave,
        date: selectedDate,
        adults: Number(adults),
        children: Number(children),
        almuerzo: !!almuerzo,
        comida: !!comida,
        cena: !!cena,
        eventType,
        createdAt: serverTimestamp(),
      });

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

  return (
    <div className="page">
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <hr
          style={{
            margin: "14px 0",
            border: "none",
            borderTop: "1px solid rgba(0,0,0,0.06)",
          }}
        />
        <form onSubmit={handleSubmit} className="form" style={{ marginTop: 8 }}>
          <label>
            Fecha
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
            />
          </label>

          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={almuerzo}
                onChange={(e) => setAlmuerzo(e.target.checked)}
              />
              Almuerzo
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={comida}
                onChange={(e) => setComida(e.target.checked)}
              />
              Comida
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={cena}
                onChange={(e) => setCena(e.target.checked)}
              />
              Cena
            </label>
          </div>

          <label style={{ marginTop: 8 }}>
            Adultos
            <input
              type="number"
              min="0"
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
              required
            />
          </label>

          <label>
            Niños
            <input
              type="number"
              min="0"
              value={children}
              onChange={(e) => setChildren(e.target.value)}
            />
          </label>

          <div className="signup-btn-row">
            <button className="btn signup-submit-btn" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Apuntarme"}
            </button>
            <button
              type="button"
              className="signup-clear-btn"
              onClick={resetForm}
            >
              Limpiar
            </button>
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {msg && <p className="info">{msg}</p>}
        </form>
      </div>

      <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className="nav-bottom-btn"
          onClick={() => navigate("/")}
        >
          ← Inicio
        </button>
        <button
          className="nav-bottom-btn accent"
          onClick={() => navigate("/fiestas/list")}
        >
          📋 Ver listado
        </button>
      </div>

      {/* SUCCESS POPUP */}
      {showPopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Inscripción realizada"
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            background: "rgba(0,0,0,0.35)",
            padding: 16,
          }}
          onClick={() => {
            setShowPopup(false);
            resetForm();
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "22px 28px",
              minWidth: 260,
              maxWidth: "90%",
              textAlign: "center",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              INSCRIPCIÓN REALIZADA
            </div>
            <div style={{ color: "#444", marginBottom: 12 }}>
              Gracias — tu inscripción ha sido registrada.
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              <button
                className="btn small"
                onClick={() => {
                  setShowPopup(false);
                  resetForm();
                }}
              >
                Cerrar
              </button>
              <button
                className="btn outline small"
                onClick={() => {
                  setShowPopup(false);
                  navigate("/fiestas/list");
                }}
              >
                Ir al listado
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
