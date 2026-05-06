import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function RegisterForm({ onRegistered = () => {}, onCancel = () => {} }) {
  const [firstName, setFirstName]     = useState("");
  const [lastName, setLastName]       = useState("");
  const [alias, setAlias]             = useState("");
  const [telefono, setTelefono]       = useState("");
  const [fechaNac, setFechaNac]       = useState("");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [msg, setMsg]                 = useState("");
  const [error, setError]             = useState("");

  const mapFirebaseError = (code, message) => {
    if (!code) return message || "Error desconocido";
    if (code.includes("auth/email-already-in-use")) return "El email ya está en uso.";
    if (code.includes("auth/invalid-email")) return "El email no es válido.";
    if (code.includes("auth/weak-password")) return "La contraseña es demasiado débil (mínimo 6 caracteres).";
    return message || code;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg("");
    setError("");
    if (!alias.trim()) { setError("El alias es obligatorio."); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        firstName:   firstName.trim(),
        lastName:    lastName.trim(),
        name:        `${firstName.trim()} ${lastName.trim()}`.trim(),
        alias:       alias.trim(),
        telefono:    telefono.trim(),
        fechaNac:    fechaNac,
        email:       email.trim(),
        createdAt:   serverTimestamp(),
      });

      setMsg("Registro completado. ¡Bienvenido/a!");

      onRegistered();
      setFirstName(""); setLastName(""); setAlias(""); setTelefono("");
      setFechaNac(""); setEmail(""); setPassword("");
    } catch (err) {
      console.error("Register error:", err);
      setError(mapFirebaseError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister} className="form register-form" noValidate>
      <div className="register-row">
        <input type="text" placeholder="Nombre *" value={firstName}
          onChange={(e) => setFirstName(e.target.value)} required />
        <input type="text" placeholder="Apellidos *" value={lastName}
          onChange={(e) => setLastName(e.target.value)} required />
      </div>
      <input type="text" placeholder="Alias (aparece en listados) *" value={alias}
        onChange={(e) => setAlias(e.target.value)} required />
      <input type="tel" placeholder="Teléfono" value={telefono}
        onChange={(e) => setTelefono(e.target.value)} />
      <label className="register-date-label">
        <span>Fecha de nacimiento</span>
        <input type="date" value={fechaNac} onChange={(e) => setFechaNac(e.target.value)} />
      </label>
      <input type="email" placeholder="Email *" value={email}
        onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <input type="password" placeholder="Contraseña (mín. 6 caracteres) *" value={password}
        onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
      <div className="actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Registrando..." : "Crear cuenta"}
        </button>
        <button type="button" className="btn outline" onClick={onCancel} style={{ marginLeft: 8 }}>
          Volver
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p className="info">{msg}</p>}
    </form>
  );
}