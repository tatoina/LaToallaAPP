import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

export default function ResetPassword({ onBack = () => {} }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const mapFirebaseError = (code, message) => {
    if (!code) return message || "Error desconocido";
    if (code.includes("auth/user-not-found")) return "No existe ninguna cuenta con ese email.";
    if (code.includes("auth/invalid-email")) return "El email no es válido.";
    return message || code;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");

    if (!email || !email.includes("@")) {
      setError("Introduce un email válido.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMsg("Email enviado. Revisa tu bandeja (y la carpeta de spam).");
      setEmail("");
    } catch (err) {
      console.error("Reset password error:", err);
      setError(mapFirebaseError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form reset-form" noValidate>
      <input
        type="email"
        placeholder="Email de la cuenta"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />

      <div className="actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Enviar email de restablecimiento"}
        </button>
        <button
          type="button"
          className="btn outline"
          onClick={onBack}
        >
          Volver
        </button>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p className="info">{msg}</p>}
    </form>
  );
}