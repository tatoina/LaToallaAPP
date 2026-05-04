import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
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
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <div className="dash-page">
      {/* Cabecera */}
      <div className="dash-header">
        <img src={logo} alt="La Toalla" className="dash-header-logo" />
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
        <img src={inaLogo} alt="INA System" className="dash-footer-inalogo" />
      </div>
    </div>
  );
}