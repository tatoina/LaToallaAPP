import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  where,
  getDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const EMPTY_SIGNUP = {
  adults: 1,
  children: 0,
  almuerzo: false,
  comida: false,
  cena: false,
};

export default function EventosTemporales() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [eventos, setEventos] = useState([]);
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create event form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvento, setNewEvento] = useState({
    nombre: "",
    fecha: "",
    descripcion: "",
  });
  const [creating, setCreating] = useState(false);

  // Signup state per event
  const [signupEventId, setSignupEventId] = useState(null);
  const [signupData, setSignupData] = useState(EMPTY_SIGNUP);
  const [savingSignup, setSavingSignup] = useState(false);
  const [signupError, setSignupError] = useState("");

  // Load events
  useEffect(() => {
    const q = query(collection(db, "eventos"), orderBy("fecha", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando eventos:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Load all temporal signups (those whose eventType starts with "evento_")
  useEffect(() => {
    const q = query(
      collection(db, "fiestas_signups"),
      where("eventType", ">=", "evento_"),
      where("eventType", "<=", "evento_\uf8ff")
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSignups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("Error cargando inscripciones de eventos:", err)
    );
    return () => unsub();
  }, []);

  const getEventSignups = (eventoId) =>
    signups.filter((s) => s.eventType === `evento_${eventoId}`);

  const getTotals = (eventoId) => {
    const evSignups = getEventSignups(eventoId);
    return {
      count: evSignups.length,
      adults: evSignups.reduce((a, s) => a + Number(s.adults || 0), 0),
      children: evSignups.reduce((a, s) => a + Number(s.children || 0), 0),
    };
  };

  const userAlreadySignedUp = (eventoId) =>
    signups.some((s) => {
      if (s.eventType !== `evento_${eventoId}`) return false;
      if (user?.uid && s.uid === user.uid) return true;
      if (user?.email && s.email === user.email) return true;
      return false;
    });

  const handleCreateEvento = async (e) => {
    e.preventDefault();
    if (!newEvento.nombre.trim() || !newEvento.fecha) return;
    setCreating(true);
    try {
      await addDoc(collection(db, "eventos"), {
        nombre: newEvento.nombre.trim(),
        fecha: newEvento.fecha,
        descripcion: newEvento.descripcion.trim(),
        createdBy: user?.uid || null,
        createdAt: serverTimestamp(),
      });
      setNewEvento({ nombre: "", fecha: "", descripcion: "" });
      setShowCreateForm(false);
    } catch (err) {
      console.error(err);
      alert("Error al crear el evento. Intenta de nuevo.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvento = async (eventoId) => {
    if (
      !window.confirm(
        "¿Eliminar este evento y todas sus inscripciones? Esta acción no se puede deshacer."
      )
    )
      return;
    try {
      const evSignups = getEventSignups(eventoId);
      await Promise.all(
        evSignups.map((s) => deleteDoc(doc(db, "fiestas_signups", s.id)))
      );
      await deleteDoc(doc(db, "eventos", eventoId));
    } catch (err) {
      console.error(err);
      alert("Error al eliminar el evento.");
    }
  };

  const openSignupForm = (eventoId) => {
    setSignupEventId(eventoId);
    setSignupData(EMPTY_SIGNUP);
    setSignupError("");
  };

  const handleSignup = async (evento) => {
    setSignupError("");
    if (!signupData.almuerzo && !signupData.comida && !signupData.cena) {
      setSignupError("Marca al menos una comida.");
      return;
    }
    if (userAlreadySignedUp(evento.id)) {
      setSignupError("Ya estás apuntado a este evento.");
      return;
    }
    setSavingSignup(true);
    try {
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
        date: evento.fecha,
        adults: Number(signupData.adults),
        children: Number(signupData.children),
        almuerzo: !!signupData.almuerzo,
        comida: !!signupData.comida,
        cena: !!signupData.cena,
        eventType: `evento_${evento.id}`,
        eventoNombre: evento.nombre,
        createdAt: serverTimestamp(),
      });
      setSignupEventId(null);
    } catch (err) {
      console.error(err);
      setSignupError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSavingSignup(false);
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
        <style>{`
          .ev-card {
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 10px;
            padding: 14px;
            background: rgba(0,0,0,0.01);
          }
          .ev-signup-panel {
            margin-top: 12px;
            padding: 12px;
            background: rgba(0,0,0,0.03);
            border-radius: 8px;
          }
          .ev-totals { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
          .ev-total-box { padding: 5px 10px; border-radius: 6px; font-size: 13px; }
          .ev-signups-list { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
          .ev-signup-row { font-size: 13px; display: flex; gap: 8px; flex-wrap: wrap; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.04); }
        `}</style>

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 4 }}>
          <h2 style={{ margin: 0 }}>EVENTOS TEMPORALES</h2>
          <button
            className="btn small"
            onClick={() => setShowCreateForm((f) => !f)}
          >
            {showCreateForm ? "Cancelar" : "+ Crear Evento"}
          </button>
        </div>

        {/* Create event form */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateEvento}
            style={{
              marginTop: 16,
              padding: 14,
              background: "rgba(0,0,0,0.02)",
              borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <h3 style={{ margin: "0 0 12px" }}>Nuevo Evento</h3>
            <label className="form" style={{ display: "block", margin: 0 }}>
              Nombre del evento *
              <input
                required
                value={newEvento.nombre}
                onChange={(e) =>
                  setNewEvento((p) => ({ ...p, nombre: e.target.value }))
                }
                placeholder="Ej: Barbacoa de verano"
              />
            </label>
            <label
              className="form"
              style={{ display: "block", margin: "10px 0 0" }}
            >
              Fecha *
              <input
                required
                type="date"
                value={newEvento.fecha}
                onChange={(e) =>
                  setNewEvento((p) => ({ ...p, fecha: e.target.value }))
                }
              />
            </label>
            <label
              className="form"
              style={{ display: "block", margin: "10px 0 0" }}
            >
              Descripción
              <input
                value={newEvento.descripcion}
                onChange={(e) =>
                  setNewEvento((p) => ({ ...p, descripcion: e.target.value }))
                }
                placeholder="Opcional..."
              />
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="btn" type="submit" disabled={creating}>
                {creating ? "Creando..." : "Crear Evento"}
              </button>
              <button
                type="button"
                className="btn outline small"
                onClick={() => setShowCreateForm(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {/* Events list */}
        {loading ? (
          <div className="centered" style={{ marginTop: 24 }}>
            Cargando...
          </div>
        ) : eventos.length === 0 ? (
          <p className="info" style={{ marginTop: 16 }}>
            No hay eventos. Pulsa "+ Crear Evento" para añadir el primero.
          </p>
        ) : (
          <div
            style={{
              marginTop: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {eventos.map((ev) => {
              const totals = getTotals(ev.id);
              const alreadyIn = userAlreadySignedUp(ev.id);
              const isSigningUp = signupEventId === ev.id;
              const evSignups = getEventSignups(ev.id);

              return (
                <div key={ev.id} className="ev-card">
                  {/* Event header */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>
                        {ev.nombre}
                      </div>
                      <div style={{ color: "#666", fontSize: 14, marginTop: 2 }}>
                        {formatDate(ev.fecha)}
                      </div>
                      {ev.descripcion && (
                        <div
                          style={{
                            color: "#888",
                            fontSize: 13,
                            marginTop: 4,
                          }}
                        >
                          {ev.descripcion}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {!alreadyIn && !isSigningUp && (
                        <button
                          className="btn small"
                          onClick={() => openSignupForm(ev.id)}
                        >
                          Apuntarme
                        </button>
                      )}
                      {isSigningUp && (
                        <button
                          className="btn outline small"
                          onClick={() => setSignupEventId(null)}
                        >
                          Cancelar
                        </button>
                      )}
                      <button
                        className="btn outline small"
                        style={{ color: "#e05c5c", borderColor: "#e05c5c" }}
                        onClick={() => handleDeleteEvento(ev.id)}
                      >
                        Borrar
                      </button>
                    </div>
                  </div>

                  {/* Already signed up badge */}
                  {alreadyIn && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 13,
                        color: "#5a9e5a",
                        fontWeight: 600,
                      }}
                    >
                      ✓ Ya estás apuntado
                    </div>
                  )}

                  {/* Inline signup form */}
                  {isSigningUp && (
                    <div className="ev-signup-panel">
                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          flexWrap: "wrap",
                          alignItems: "center",
                          marginBottom: 10,
                        }}
                      >
                        <label
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          <input
                            type="checkbox"
                            checked={signupData.almuerzo}
                            onChange={(e) =>
                              setSignupData((p) => ({
                                ...p,
                                almuerzo: e.target.checked,
                              }))
                            }
                          />
                          Almuerzo
                        </label>
                        <label
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          <input
                            type="checkbox"
                            checked={signupData.comida}
                            onChange={(e) =>
                              setSignupData((p) => ({
                                ...p,
                                comida: e.target.checked,
                              }))
                            }
                          />
                          Comida
                        </label>
                        <label
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          <input
                            type="checkbox"
                            checked={signupData.cena}
                            onChange={(e) =>
                              setSignupData((p) => ({
                                ...p,
                                cena: e.target.checked,
                              }))
                            }
                          />
                          Cena
                        </label>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <label
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          Adultos:
                          <input
                            type="number"
                            min="0"
                            value={signupData.adults}
                            onChange={(e) =>
                              setSignupData((p) => ({
                                ...p,
                                adults: e.target.value,
                              }))
                            }
                            style={{
                              width: 70,
                              padding: "6px 8px",
                              border: "1px solid rgba(0,0,0,0.15)",
                              borderRadius: 4,
                            }}
                          />
                        </label>
                        <label
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          Niños:
                          <input
                            type="number"
                            min="0"
                            value={signupData.children}
                            onChange={(e) =>
                              setSignupData((p) => ({
                                ...p,
                                children: e.target.value,
                              }))
                            }
                            style={{
                              width: 70,
                              padding: "6px 8px",
                              border: "1px solid rgba(0,0,0,0.15)",
                              borderRadius: 4,
                            }}
                          />
                        </label>
                        <button
                          className="btn"
                          onClick={() => handleSignup(ev)}
                          disabled={savingSignup}
                        >
                          {savingSignup ? "Guardando..." : "Confirmar"}
                        </button>
                      </div>
                      {signupError && (
                        <p
                          className="error"
                          role="alert"
                          style={{ marginTop: 6 }}
                        >
                          {signupError}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Totals */}
                  <div className="ev-totals">
                    <div
                      className="ev-total-box"
                      style={{ background: "rgba(0,0,0,0.04)" }}
                    >
                      Inscripciones: <strong>{totals.count}</strong>
                    </div>
                    <div
                      className="ev-total-box"
                      style={{ background: "rgba(106,143,58,0.1)" }}
                    >
                      Adultos: <strong>{totals.adults}</strong>
                    </div>
                    <div
                      className="ev-total-box"
                      style={{ background: "rgba(127,186,217,0.1)" }}
                    >
                      Niños: <strong>{totals.children}</strong>
                    </div>
                  </div>

                  {/* Signup list (collapsible) */}
                  {evSignups.length > 0 && (
                    <details style={{ marginTop: 10 }}>
                      <summary
                        style={{ cursor: "pointer", fontSize: 13, color: "#666" }}
                      >
                        Ver inscritos ({evSignups.length})
                      </summary>
                      <div className="ev-signups-list">
                        {evSignups.map((s) => {
                          const name =
                            s.name ||
                            (s.email ? s.email.split("@")[0] : "anónimo");
                          const meals = [
                            s.almuerzo && "Alm.",
                            s.comida && "Com.",
                            s.cena && "Cena",
                          ]
                            .filter(Boolean)
                            .join(" · ");
                          return (
                            <div key={s.id} className="ev-signup-row">
                              <span style={{ fontWeight: 600, minWidth: 100 }}>
                                {name}
                              </span>
                              <span style={{ color: "#666" }}>{meals || "—"}</span>
                              <span>Adultos: {s.adults || 0}</span>
                              <span>Niños: {s.children || 0}</span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
          <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
          <button className="nav-bottom-btn accent" onClick={() => navigate("/fiestas/list")}>📋 Ver listado</button>
        </div>
      </div>
    </div>
  );
}
