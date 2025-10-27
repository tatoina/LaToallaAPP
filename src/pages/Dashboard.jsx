import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  return (
    <div className="dashboard card">
      <h2 style={{ textAlign: "center" }}>Bienvenido</h2>

      <div className="dashboard-buttons">
        <button className="btn large" onClick={() => navigate("/fiestas")}>
          FIESTAS DE SANTIAGO
        </button>

        <button className="btn large outline" onClick={() => navigate("/ferias")}>
          FERIAS
        </button>

        <button className="btn large" onClick={() => navigate("/gestion-stock")}>
          GESTIÓN DE STOCK
        </button>
      </div>

      <div style={{ marginTop: 12, textAlign: "center" }}>
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