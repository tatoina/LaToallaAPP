import React from "react";
import { useNavigate } from "react-router-dom";

export default function FiestasDeSantiago() {
  const navigate = useNavigate();
  return (
    <div className="card page">
      <h2>FIESTAS DE SANTIAGO</h2>
      <p>Página en construcción — aquí irá el contenido de FIESTAS DE SANTIAGO.</p>
      <button className="btn outline" onClick={() => navigate(-1)}>
        Volver
      </button>
    </div>
  );
}