import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp, doc, getDoc, setDoc } from "firebase/firestore";
import logo from "../assets/logo.png";
import inaLogo from "../assets/INASYSTEM.png";

const MAIN_SECTIONS = [
  { label: "Fiestas de\nla Juventud", path: "/fiestas-juventud", emoji: "🎉" },
  { label: "Fiestas de\nSantiago",    path: "/fiestas",           emoji: "🎊" },
  { label: "Ferias",                  path: "/ferias",             emoji: "🎡" },
  { label: "Eventos\nTemporales",     path: "/eventos-temporales", emoji: "📅" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout, isAdmin, user } = useAuth();

  const [now, setNow] = useState(new Date());
  const [logoExpanded, setLogoExpanded] = useState(false);
  const audioRef = React.useRef(null);
  const [inaExpanded, setInaExpanded] = useState(false);
  const [latestNoticia, setLatestNoticia] = useState(null);
  const [noticiaVisible, setNoticiaVisible] = useState(false);
  const [showSugerencia, setShowSugerencia] = useState(false);
  const [sugerenciaText, setSugerenciaText] = useState("");
  const [sugerenciaMsg, setSugerenciaMsg] = useState("");

  const [showEmailPrefs, setShowEmailPrefs] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({
    fiestasJuventud: true,
    fiestasSantiago: true,
    ferias: true,
    eventosTemporales: true,
    cohete: true,
    tienda: true,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "noticias"), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const noticia = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setLatestNoticia(noticia);
        const read = JSON.parse(localStorage.getItem("readNoticias") || "[]");
        setNoticiaVisible(!read.includes(noticia.id));
      } else {
        setLatestNoticia(null);
        setNoticiaVisible(false);
      }
    });
    return () => unsub();
  }, []);

  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" });

  useEffect(() => {
    if (!user?.uid) return;
    const prefRef = doc(db, "userPreferences", user.uid);
    const DEFAULTS = {
      fiestasJuventud: true,
      fiestasSantiago: true,
      ferias: true,
      eventosTemporales: true,
      cohete: true,
      tienda: true,
    };
    getDoc(prefRef).then((snap) => {
      if (snap.exists() && snap.data()._initialized) {
        const data = snap.data();
        setEmailPrefs({
          fiestasJuventud: data.fiestasJuventud ?? true,
          fiestasSantiago: data.fiestasSantiago ?? true,
          ferias: data.ferias ?? true,
          eventosTemporales: data.eventosTemporales ?? true,
          cohete: data.cohete ?? true,
          tienda: data.tienda ?? true,
        });
      } else {
        // Primera vez o documento viejo sin flag: resetear a todo activado
        setDoc(prefRef, { ...DEFAULTS, _initialized: true }, { merge: true });
        setEmailPrefs(DEFAULTS);
      }
    });
  }, [user]);

  const toggleEmailPref = async (key) => {
    const newPrefs = { ...emailPrefs, [key]: !emailPrefs[key] };
    setEmailPrefs(newPrefs);
    if (user?.uid) {
      await setDoc(doc(db, "userPreferences", user.uid), { ...newPrefs, _initialized: true }, { merge: true });
    }
  };

  const onSendSugerencia = async () => {
    if (!sugerenciaText.trim()) return;
    try {
      await addDoc(collection(db, "sugerencias"), {
        texto: sugerenciaText.trim(),
        email: user?.email || "",
        createdAt: serverTimestamp(),
      });
      setSugerenciaMsg("✅ ¡Sugerencia enviada! Gracias.");
      setSugerenciaText("");
      setTimeout(() => { setSugerenciaMsg(""); setShowSugerencia(false); }, 2500);
    } catch {
      setSugerenciaMsg("❌ Error al enviar. Inténtalo de nuevo.");
    }
  };

  return (
    <div className="dash-page">
      {/* Cabecera */}
      <div className="dash-header">
        <img
          src={logo}
          alt="La Toalla"
          className={`dash-header-logo${logoExpanded ? " dash-header-logo--big" : ""}`}
          onClick={() => {
            const expanding = !logoExpanded;
            setLogoExpanded(expanding);
            if (audioRef.current) {
              if (expanding) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
              } else {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
            }
          }}
          style={{ cursor: "pointer" }}
        />
        <div>
          <div className="dash-header-title">LA TOALLA</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div>
              <div className="dash-header-sub dash-header-date">{dateStr}</div>
              {user?.email && (
                <div className="dash-header-email">{user.email}</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button
                className="dash-suggest-btn"
                onClick={() => { setShowSugerencia(true); setSugerenciaMsg(""); }}
                title="Enviar sugerencia"
                aria-label="Enviar sugerencia"
              >
                ✉️
              </button>
              <button
                className="dash-suggest-btn"
                onClick={() => setShowEmailPrefs(true)}
                title="Configurar notificaciones por email"
                aria-label="Configurar notificaciones"
              >
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Grid principal 2×2 — solo usuarios normales */}
      {!isAdmin && (
        <>
          {/* Banner última noticia */}
          {latestNoticia && noticiaVisible && (
            <div className="dash-noticia-banner">
              <div className="dash-noticia-inner">
                <span className="dash-noticia-cat">{latestNoticia.category}</span>
                <p className="dash-noticia-title">{latestNoticia.title}</p>
                <p className="dash-noticia-body">
                  {latestNoticia.body.length > 100
                    ? latestNoticia.body.slice(0, 100) + "..."
                    : latestNoticia.body}
                </p>
                {latestNoticia.imageUrl && (
                  <img
                    src={latestNoticia.imageUrl}
                    alt="noticia"
                    className="dash-noticia-img"
                    onError={(e) => { e.target.style.display = "none"; }}
                  />
                )}
              </div>
              <button
                className="dash-noticia-close"
                onClick={() => {
                  if (latestNoticia) {
                    const read = JSON.parse(localStorage.getItem("readNoticias") || "[]");
                    if (!read.includes(latestNoticia.id)) {
                      localStorage.setItem("readNoticias", JSON.stringify([...read, latestNoticia.id]));
                    }
                  }
                  setNoticiaVisible(false);
                }}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
          )}
          <div className="dash-grid">
            {MAIN_SECTIONS.map(({ label, path, emoji }) => (
              <button key={path} className="dash-tile" onClick={() => navigate(path)}>
                <span className="dash-tile-icon">{emoji}</span>
                <span className="dash-tile-label">
                  {label.split("\n").map((l, i) => <span key={i}>{l}{i === 0 && <br />}</span>)}
                </span>
              </button>
            ))}
          </div>

          {/* Botones secundarios */}
          <div className="dash-secondary">
            <button className="dash-secondary-btn" onClick={() => navigate("/fiestas/list")}>
              <span className="dash-sec-icon">📋</span>
              <span>Listado de Inscripciones</span>
            </button>
            <button className="dash-secondary-btn" onClick={() => navigate("/gestion-stock")}>
              <span className="dash-sec-icon">📦</span>
              <span>Gestión de Stock</span>
            </button>
            <button className="dash-secondary-btn dash-secondary-btn--tienda" onClick={() => navigate("/tienda")}>
              <span className="dash-sec-icon">🛒</span>
              <span>Tienda</span>
            </button>
            <button className="dash-secondary-btn dash-secondary-btn--cohete" onClick={() => navigate("/votacion-cohete")}>
              <span className="dash-sec-icon">🚀</span>
              <span>Votación: ¿Quién tirará el cohete en {new Date().getFullYear()}?</span>
            </button>
          </div>
        </>
      )}

      {/* Vista admin — solo panel de administración */}
      {isAdmin && (
        <div className="dash-admin-only">
          <p className="dash-admin-only-label">Acceso de administrador</p>
          <button className="dash-admin-only-btn" onClick={() => navigate("/admin")}>
            ⚙️ Panel de Administración
          </button>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button className="dash-logout-btn" onClick={() => { logout(); navigate("/login"); }}>
          Cerrar sesión
        </button>
      </div>

      {/* Footer */}
      <div className="dash-footer">
        <span className="dash-footer-version">v0.1.0</span>
        <span className="dash-footer-sep">·</span>
        <span className="dash-footer-by">by</span>
        <img
          src={inaLogo}
          alt="INA System"
          className={`dash-footer-inalogo${inaExpanded ? " dash-footer-inalogo--big" : ""}`}
          onClick={() => setInaExpanded(v => !v)}
          style={{ cursor: "pointer" }}
        />
      </div>
      <audio ref={audioRef} src="/sonmisamigas.m4a" preload="auto" />

      {/* Modal sugerencias */}
      {showSugerencia && (
        <div
          className="suggest-overlay"
          onClick={() => setShowSugerencia(false)}
        >
          <div
            className="suggest-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="suggest-modal-header">
              <span>✉️ Enviar sugerencia</span>
              <button className="suggest-close" onClick={() => setShowSugerencia(false)}>×</button>
            </div>
            <p className="suggest-hint">¿Tienes alguna idea o mejora para la app? ¡Cuéntanosla!</p>
            <textarea
              className="suggest-textarea"
              placeholder="Escribe tu sugerencia aquí..."
              value={sugerenciaText}
              onChange={(e) => setSugerenciaText(e.target.value)}
              rows={4}
              autoFocus
            />
            {sugerenciaMsg && (
              <p style={{ fontSize: 13, color: sugerenciaMsg.startsWith("✅") ? "green" : "red", margin: "4px 0 0" }}>
                {sugerenciaMsg}
              </p>
            )}
            <button
              className="btn"
              style={{ marginTop: 12, width: "100%" }}
              onClick={onSendSugerencia}
              disabled={!sugerenciaText.trim()}
            >
              Enviar
            </button>
          </div>
        </div>
      )}
      {/* Modal configuración notificaciones email */}
      {showEmailPrefs && (
        <div
          className="suggest-overlay"
          onClick={() => setShowEmailPrefs(false)}
        >
          <div
            className="suggest-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="suggest-modal-header">
              <span>⚙️ Notificaciones por email</span>
              <button className="suggest-close" onClick={() => setShowEmailPrefs(false)}>×</button>
            </div>
            <p className="suggest-hint">Activa o desactiva los avisos por email para cada sección:</p>
            <div className="emailpref-list">
              {[
                { key: "fiestasJuventud",   label: "🎉 Fiestas de la Juventud" },
                { key: "fiestasSantiago",   label: "🎊 Fiestas de Santiago" },
                { key: "ferias",            label: "🎡 Ferias" },
                { key: "eventosTemporales", label: "📅 Eventos Temporales" },
                { key: "cohete",            label: "🚀 Votación del Cohete" },
                { key: "tienda",            label: "🛒 Nuevos productos en la Tienda" },
              ].map(({ key, label }) => (
                <div key={key} className="emailpref-row">
                  <span className="emailpref-label">{label}</span>
                  <label className="emailpref-toggle">
                    <input
                      type="checkbox"
                      checked={emailPrefs[key]}
                      onChange={() => toggleEmailPref(key)}
                    />
                    <span className="emailpref-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}