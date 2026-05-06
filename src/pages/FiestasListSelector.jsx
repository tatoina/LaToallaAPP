import React, { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const FIXED_EVENTS = [
  { key: "juventud", emoji: "🎉", label: "Fiestas de la Juventud" },
  { key: "fiestas",  emoji: "🎊", label: "Fiestas de Santiago" },
  { key: "ferias",   emoji: "🎡", label: "Ferias" },
];

export default function FiestasListSelector() {
  const navigate = useNavigate();
  const [eventos, setEventos] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "eventos"), orderBy("fecha", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h2 className="page-header-title">📋 Inscripciones</h2>
      </div>
      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontSize: 14, color: "#666", marginBottom: 16, textAlign: "center" }}>
          Selecciona el evento para ver su listado
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FIXED_EVENTS.map(({ key, emoji, label }) => (
            <button
              key={key}
              className="btn accent"
              style={{ fontSize: 16, padding: "14px 16px", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
              onClick={() => navigate(`/fiestas/list/${key}`)}
            >
              <span style={{ fontSize: 22 }}>{emoji}</span>
              <span>{label}</span>
            </button>
          ))}

          {eventos.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: "#999", textAlign: "center", marginTop: 8 }}>
                Eventos temporales
              </div>
              {eventos.map((ev) => (
                <button
                  key={ev.id}
                  className="btn"
                  style={{ fontSize: 15, padding: "12px 16px", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: "#f5f5f5", border: "1.5px solid #ddd", color: "#333" }}
                  onClick={() => navigate(`/fiestas/list/evento_${ev.id}`)}
                >
                  <span style={{ fontSize: 20 }}>📅</span>
                  <span>{ev.nombre}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <button
          className="nav-bottom-btn"
          style={{ marginTop: 20, width: "100%" }}
          onClick={() => navigate("/")}
        >
          ← Inicio
        </button>
      </div>
    </div>
  );
}
