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

const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const WEEKDAYS_FULL = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    const wd = WEEKDAYS_FULL[d.getDay()] ?? "";
    return `${wd.charAt(0).toUpperCase() + wd.slice(1)}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
  } catch { return iso; }
}

function isPast(iso) {
  if (!iso) return false;
  return new Date(iso + "T23:59:59") < new Date();
}

const EMPTY_SIGNUP = { adults: 1, children: 0, almuerzo: false, comida: false, cena: false };

export default function EventosTemporales() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [eventos, setEventos] = useState([]);
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEvento, setNewEvento] = useState({ nombre: "", fecha: "", descripcion: "" });
  const [creating, setCreating] = useState(false);
  const [signupEventId, setSignupEventId] = useState(null);
  const [signupData, setSignupData] = useState(EMPTY_SIGNUP);
  const [savingSignup, setSavingSignup] = useState(false);
  const [signupError, setSignupError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "eventos"), orderBy("fecha", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "fiestas_signups"),
      where("eventType", ">=", "evento_"),
      where("eventType", "<=", "evento_\uf8ff")
    );
    const unsub = onSnapshot(q, (snap) => {
      setSignups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const getEventSignups = (id) => signups.filter((s) => s.eventType === `evento_${id}`);

  const getTotals = (id) => {
    const ev = getEventSignups(id);
    return {
      count: ev.length,
      adults: ev.reduce((a, s) => a + Number(s.adults || 0), 0),
      children: ev.reduce((a, s) => a + Number(s.children || 0), 0),
    };
  };

  const userAlreadySignedUp = (id) =>
    signups.some((s) => {
      if (s.eventType !== `evento_${id}`) return false;
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
    } catch { alert("Error al crear el evento."); }
    finally { setCreating(false); }
  };

  const handleDeleteEvento = async (id) => {
    if (!window.confirm("¿Eliminar este evento y todas sus inscripciones?")) return;
    try {
      await Promise.all(getEventSignups(id).map((s) => deleteDoc(doc(db, "fiestas_signups", s.id))));
      await deleteDoc(doc(db, "eventos", id));
    } catch { alert("Error al eliminar el evento."); }
  };

  const handleSignup = async (evento) => {
    setSignupError("");
    if (!signupData.almuerzo && !signupData.comida && !signupData.cena)
      return setSignupError("Marca al menos una comida.");
    if (userAlreadySignedUp(evento.id))
      return setSignupError("Ya estás apuntado a este evento.");
    setSavingSignup(true);
    try {
      let nameToSave = null;
      if (user?.uid) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const d = userDoc.data();
          nameToSave = d.alias || d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim() || null;
        }
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
    } catch { setSignupError("No se pudo guardar. Intenta de nuevo."); }
    finally { setSavingSignup(false); }
  };

  const upcoming = eventos.filter((e) => !isPast(e.fecha));
  const past = eventos.filter((e) => isPast(e.fecha));

  const EventCard = ({ ev }) => {
    const totals = getTotals(ev.id);
    const alreadyIn = userAlreadySignedUp(ev.id);
    const isSigningUp = signupEventId === ev.id;
    const evSignups = getEventSignups(ev.id);
    const evPast = isPast(ev.fecha);

    return (
      <div className={`ev2-card${evPast ? " ev2-card--past" : ""}`}>
        <div className="ev2-card-header">
          <div className="ev2-card-meta">
            <div className="ev2-card-date">{formatDate(ev.fecha)}</div>
            <div className="ev2-card-name">{ev.nombre}</div>
            {ev.descripcion && <div className="ev2-card-desc">{ev.descripcion}</div>}
          </div>
          <div className="ev2-card-badges">
            {alreadyIn && <span className="ev2-badge ev2-badge--in">✓ Apuntado</span>}
            {evPast && <span className="ev2-badge ev2-badge--past">Finalizado</span>}
          </div>
        </div>

        <div className="ev2-stats">
          <div className="ev2-stat">
            <span className="ev2-stat-val">{totals.count}</span>
            <span className="ev2-stat-lbl">Inscritos</span>
          </div>
          <div className="ev2-stat">
            <span className="ev2-stat-val">{totals.adults}</span>
            <span className="ev2-stat-lbl">Adultos</span>
          </div>
          <div className="ev2-stat">
            <span className="ev2-stat-val">{totals.children}</span>
            <span className="ev2-stat-lbl">Niños</span>
          </div>
        </div>

        {!evPast && (
          <div className="ev2-actions">
            {!alreadyIn && !isSigningUp && (
              <button className="btn ev2-signup-btn" onClick={() => { setSignupEventId(ev.id); setSignupData(EMPTY_SIGNUP); setSignupError(""); }}>
                + Apuntarme
              </button>
            )}
            {isSigningUp && (
              <button className="btn outline small" onClick={() => setSignupEventId(null)}>Cancelar</button>
            )}
            <button className="ev2-delete-btn" onClick={() => handleDeleteEvento(ev.id)}>🗑️</button>
          </div>
        )}
        {evPast && (
          <div className="ev2-actions">
            <button className="ev2-delete-btn" onClick={() => handleDeleteEvento(ev.id)}>🗑️</button>
          </div>
        )}

        {isSigningUp && (
          <div className="ev2-signup-panel">
            <div className="ev2-meal-row">
              {[["almuerzo","🥐 Almuerzo"],["comida","🍽️ Comida"],["cena","🌙 Cena"]].map(([key, label]) => (
                <label key={key} className="ev2-meal-label">
                  <input type="checkbox" checked={signupData[key]} onChange={(e) => setSignupData((p) => ({ ...p, [key]: e.target.checked }))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="ev2-count-row">
              <label className="ev2-count-label">
                Adultos
                <input type="number" min="0" className="ev2-count-input" value={signupData.adults} onChange={(e) => setSignupData((p) => ({ ...p, adults: e.target.value }))} />
              </label>
              <label className="ev2-count-label">
                Niños
                <input type="number" min="0" className="ev2-count-input" value={signupData.children} onChange={(e) => setSignupData((p) => ({ ...p, children: e.target.value }))} />
              </label>
              <button className="btn" onClick={() => handleSignup(ev)} disabled={savingSignup}>
                {savingSignup ? "Guardando..." : "Confirmar"}
              </button>
            </div>
            {signupError && <p className="error" style={{ marginTop: 6 }}>{signupError}</p>}
          </div>
        )}

        {evSignups.length > 0 && (
          <details className="ev2-details">
            <summary className="ev2-details-summary">Ver inscritos ({evSignups.length})</summary>
            <div className="ev2-inscritos">
              {evSignups.map((s) => {
                const name = s.name || (s.email ? s.email.split("@")[0] : "Anónimo");
                const meals = [s.almuerzo && "Alm.", s.comida && "Com.", s.cena && "Cena"].filter(Boolean).join(" - ");
                return (
                  <div key={s.id} className="ev2-inscrito-row">
                    <span className="ev2-inscrito-name">{name}</span>
                    <span className="ev2-inscrito-meals">{meals || "—"}</span>
                    <span className="ev2-inscrito-counts">{s.adults || 0}A · {s.children || 0}N</span>
                  </div>
                );
              })}
            </div>
          </details>
        )}
      </div>
    );
  };

  return (
    <div className="ev2-page">
      <div className="page-header">
        <h2 className="page-header-title">📅 Eventos Temporales</h2>
      </div>

      {!showCreateForm ? (
        <button className="ev2-create-btn" onClick={() => setShowCreateForm(true)}>
          + Crear nuevo evento
        </button>
      ) : (
        <div className="ev2-form-card">
          <h3 className="ev2-form-title">Nuevo evento</h3>
          <form onSubmit={handleCreateEvento} className="ev2-form">
            <label className="ev2-form-label">
              Nombre del evento *
              <input className="ev2-form-input" required value={newEvento.nombre}
                onChange={(e) => setNewEvento((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej: Barbacoa de verano" />
            </label>
            <label className="ev2-form-label">
              Fecha *
              <input className="ev2-form-input" required type="date" value={newEvento.fecha}
                onChange={(e) => setNewEvento((p) => ({ ...p, fecha: e.target.value }))} />
            </label>
            <label className="ev2-form-label">
              Descripción
              <input className="ev2-form-input" value={newEvento.descripcion}
                onChange={(e) => setNewEvento((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Opcional..." />
            </label>
            <div className="ev2-form-btns">
              <button className="btn" type="submit" disabled={creating}>
                {creating ? "Creando..." : "✓ Crear evento"}
              </button>
              <button type="button" className="ev2-cancel-btn" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="ev2-empty">
          <p className="ev2-empty-text">Cargando eventos...</p>
        </div>
      ) : eventos.length === 0 ? (
        <div className="ev2-empty">
          <p className="ev2-empty-title">No hay eventos aún</p>
          <p className="ev2-empty-sub">Crea el primero usando el botón de arriba</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="ev2-section">
              <div className="ev2-section-title">Próximos eventos</div>
              {upcoming.map((ev) => <EventCard key={ev.id} ev={ev} />)}
            </div>
          )}
          {past.length > 0 && (
            <details className="ev2-past-section">
              <summary className="ev2-past-summary">Eventos pasados ({past.length})</summary>
              <div className="ev2-section">
                {past.map((ev) => <EventCard key={ev.id} ev={ev} />)}
              </div>
            </details>
          )}
        </>
      )}

      <div className="page-bottom-nav">
        <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
        <button className="nav-bottom-btn accent" onClick={() => navigate("/fiestas/list")}>📋 Ver listado</button>
      </div>
    </div>
  );
}