import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
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
  const [inaExpanded, setInaExpanded] = useState(false);
  const [latestNoticia, setLatestNoticia] = useState(null);
  const [noticiaVisible, setNoticiaVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query(collection(db, "noticias"), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setLatestNoticia({ id: snap.docs[0].id, ...snap.docs[0].data() });
        setNoticiaVisible(true);
      } else {
        setLatestNoticia(null);
      }
    });
    return () => unsub();
  }, []);

  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="dash-page">
      {/* Cabecera */}
      <div className="dash-header">
        <img
          src={logo}
          alt="La Toalla"
          className={`dash-header-logo${logoExpanded ? " dash-header-logo--big" : ""}`}
          onClick={() => setLogoExpanded(v => !v)}
          style={{ cursor: "pointer" }}
        />
        <div>
          <div className="dash-header-title">LA TOALLA</div>
          <div className="dash-header-sub dash-header-date">{dateStr}</div>
          {user?.email && (
            <div className="dash-header-email">{user.email}</div>
          )}
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
                onClick={() => setNoticiaVisible(false)}
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
            <button className="dash-secondary-btn dash-secondary-btn--cohete" onClick={() => navigate("/votacion-cohete")}>
              <span className="dash-sec-icon">🚀</span>
              <span>Votación: ¿Quién tira el cohete? {new Date().getFullYear()}</span>
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
    </div>
  );
}