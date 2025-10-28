import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="dashboard card">
      <h2 style={{ textAlign: "center" }}>Bienvenido a la App de LA TOALLA</h2>

      <div className="dashboard-buttons" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button className="btn large" onClick={() => navigate("/fiestas")}>
          FORMULARIO DE INSCRIPCION
        </button>

        <button className="btn large" onClick={() => navigate("/fiestas/list")}>
          LISTADO DE INSCRIPCIONES
        </button>

        <button className="btn large" onClick={() => navigate("/gestion-stock")}>
          GESTIÓN DE STOCK
        </button>
      </div>

      <div style={{ marginTop: 16, textAlign: "center" }}>
        <button
          className="btn outline small"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}