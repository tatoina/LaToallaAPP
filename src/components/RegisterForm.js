import React, { useState } from "react";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function RegisterForm({ onRegistered = () => {}, onCancel = () => {} }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

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
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!username.trim()) {
      setError("Introduce un nombre de usuario.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
        createdAt: serverTimestamp()
      });

      try {
        await sendEmailVerification(userCredential.user);
        setMsg("Registro completado. Te hemos enviado un email de verificación.");
      } catch (verifErr) {
        console.warn("No se pudo enviar verificación:", verifErr);
        setMsg("Registro completado. (No se pudo enviar el email de verificación)");
      }

      onRegistered();
      setFirstName("");
      setLastName("");
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (err) {
      console.error("Register error:", err);
      setError(mapFirebaseError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister} className="form register-form" noValidate>
      <input
        type="text"
        placeholder="Nombre"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Apellido"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Usuario (username)"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <input
        type="password"
        placeholder="Contraseña (mín. 6 caracteres)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        autoComplete="new-password"
      />
      <div className="actions">
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Registrando..." : "Crear cuenta"}
        </button>
        {/* Botón Volver: vuelve a la pantalla de login */}
        <button
          type="button"
          className="btn outline"
          onClick={onCancel}
          style={{ marginLeft: 8 }}
        >
          Volver
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {msg && <p className="info">{msg}</p>}
    </form>
  );
}