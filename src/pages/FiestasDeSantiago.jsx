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

export default function FiestasDeSantiago() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form state: default selected date = today
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  });

  // Exclusive event selection (radio)
  const [eventType, setEventType] = useState("fiestas"); // 'fiestas' | 'ferias'

  const [almuerzo, setAlmuerzo] = useState(false);
  const [comida, setComida] = useState(false);
  const [cena, setCena] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Popup state
  const [showPopup, setShowPopup] = useState(false);
  const popupTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (popupTimerRef.current) {
        clearTimeout(popupTimerRef.current);
        popupTimerRef.current = null;
      }
    };
  }, []);

  const resetForm = () => {
    const d = new Date();
    setSelectedDate(d.toISOString().slice(0, 10)); // volver a hoy
    setEventType("fiestas");
    setAlmuerzo(false);
    setComida(false);
    setCena(false);
    setAdults(1);
    setChildren(0);
    setError("");
    setMsg("");
  };

  const showSuccessPopup = (text = "INSCRIPCION REALIZADA") => {
    setShowPopup(true);
    // auto close after 2.5s
    if (popupTimerRef.current) clearTimeout(popupTimerRef.current);
    popupTimerRef.current = setTimeout(() => {
      setShowPopup(false);
      popupTimerRef.current = null;
    }, 2500);
  };

  // Check duplicate: user already signed for same date & eventType
  async function hasExistingSignup() {
    try {
      // Prefer uid if available
      if (user?.uid) {
        const q = query(
          collection(db, "fiestas_signups"),
          where("uid", "==", user.uid),
          where("date", "==", selectedDate),
          where("eventType", "==", eventType)
        );
        const snap = await getDocs(q);
        return !snap.empty;
      }

      // Fallback to email if available
      if (user?.email) {
        const q = query(
          collection(db, "fiestas_signups"),
          where("email", "==", user.email),
          where("date", "==", selectedDate),
          where("eventType", "==", eventType)
        );
        const snap = await getDocs(q);
        return !snap.empty;
      }

      // If no identifier, don't block (or you may choose to block anonymous)
      return false;
    } catch (err) {
      console.warn("Error comprobando duplicados:", err);
      // On error, be conservative: don't block creation
      return false;
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!selectedDate) {
      setError("Selecciona una fecha.");
      return;
    }
    if (!eventType) {
      setError("Selecciona Fiestas de Santiago o Ferias.");
      return;
    }
    if (!almuerzo && !comida && !cena) {
      setError("Marca al menos Almuerzo, Comida o Cena.");
      return;
    }
    if (adults < 0 || children < 0) {
      setError("Los números no pueden ser negativos.");
      return;
    }

    setSaving(true);
    try {
      // prevent duplicate signups for same user + date + eventType
      const exists = await hasExistingSignup();
      if (exists) {
        setError("Ya tienes una inscripción para ese día y evento. Ve al Listado para editarla.");
        setSaving(false);
        return;
      }

      // intentar resolver nombre del usuario para guardarlo con la inscripción
      let nameToSave = null;
      if (user && user.uid) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            nameToSave = data.name || `${data.firstName || ""} ${data.lastName || ""}`.trim() || null;
          }
        } catch (err) {
          console.warn("No se pudo leer users/{uid}:", err);
        }
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
        eventType, // nuevo campo (string)
        createdAt: serverTimestamp(),
      });

      setMsg("Inscripción registrada. Gracias.");
      // show popup success then reset form
      showSuccessPopup("INSCRIPCION REALIZADA");
      resetForm();
    } catch (err) {
      console.error("Error guardando inscripción:", err);
      setError("No se pudo guardar la inscripción. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // Small helper to format title text on popup (keeps accessible)
  const Popup = ({ open, onClose }) => {
    if (!open) return null;
    return (
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
        onClick={onClose}
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
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.6, marginBottom: 8 }}>
            INSCRIPCION REALIZADA
          </div>
          <div style={{ color: "#444", marginBottom: 12 }}>Gracias — tu inscripción ha sido registrada.</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <button
              className="btn small"
              onClick={() => {
                onClose();
                if (popupTimerRef.current) {
                  clearTimeout(popupTimerRef.current);
                  popupTimerRef.current = null;
                }
              }}
            >
              Cerrar
            </button>
            <button
              className="btn outline small"
              onClick={() => {
                onClose();
                if (popupTimerRef.current) {
                  clearTimeout(popupTimerRef.current);
                  popupTimerRef.current = null;
                }
                navigate("/fiestas/list");
              }}
            >
              Ir al listado
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0 }}>Inscripción — Eventos</h2>

        {/* Event selector EXCLUSIVO: radio buttons */}
        <div style={{ display: "flex", gap: 16, marginTop: 12, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="radio"
              name="eventType"
              value="fiestas"
              checked={eventType === "fiestas"}
              onChange={() => setEventType("fiestas")}
            />
            Fiestas de Santiago
          </label>

          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="radio"
              name="eventType"
              value="ferias"
              checked={eventType === "ferias"}
              onChange={() => setEventType("ferias")}
            />
            Ferias
          </label>
        </div>

        <hr style={{ margin: "14px 0", border: "none", borderTop: "1px solid rgba(0,0,0,0.06)" }} />

        {/* Form */}
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

          <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center" }}>
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

          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn large" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Apuntarme"}
            </button>
            <button type="button" className="btn outline small" onClick={resetForm}>
              Limpiar
            </button>
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          {msg && <p className="info">{msg}</p>}
        </form>
      </div>

      {/* Volver al dashboard in the page bottom */}
      <div style={{ marginTop: 18, display: "flex", justifyContent: "center" }}>
        <button className="btn outline small" onClick={() => navigate("/")}>
          Volver al Dashboard
        </button>
      </div>

      {/* SUCCESS POPUP */}
      <Popup open={showPopup} onClose={() => setShowPopup(false)} />
    </div>
  );
}