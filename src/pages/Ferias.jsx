import React from "react";
import { useNavigate } from "react-router-dom";

export default function Ferias() {
  const navigate = useNavigate();
  return (
    <div className="card page">
      <h2>FERIAS</h2>
      <p>Página en construcción — aquí irá el contenido de FERIAS.</p>
      <button className="btn outline" onClick={() => navigate(-1)}>
        Volver
      </button>
    </div>
  );
}