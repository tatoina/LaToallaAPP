import React from "react";
import { useNavigate } from "react-router-dom";

export default function GestionStock() {
  const navigate = useNavigate();
  return (
    <div className="card page">
      <h2>GESTIÓN DE STOCK</h2>
      <p>Página en construcción — aquí irá el contenido de GESTIÓN DE STOCK.</p>
      <button className="btn outline" onClick={() => navigate(-1)}>
        Volver
      </button>
    </div>
  );
}