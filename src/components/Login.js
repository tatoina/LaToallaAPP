import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import RegisterForm from "./RegisterForm";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setInfo("Login correcto. Bienvenido.");
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleShowRegister = () => {
    setShowRegisterForm(true);
    setError("");
    setInfo("");
  };

  const handleBackToLogin = () => {
    setShowRegisterForm(false);
    setError("");
    setInfo("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="login-wrapper">
      <main className="card">
        {/* Imagen dentro del cajón (pon public/loco.png) */}
        <div className="card-top">
          <img src="/logo100.png" alt="loco" className="card-logo" />
        </div>

        {!showRegisterForm ? (
          <>
            <h2>Iniciar sesión</h2>
            <form onSubmit={handleLogin} className="form">
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
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <div className="actions">
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </button>
                <button
                  type="button"
                  className="btn outline"
                  onClick={handleShowRegister}
                >
                  Registrarse
                </button>
              </div>
            </form>

            {error && <p className="error">{error}</p>}
            {info && <p className="info">{info}</p>}
          </>
        ) : (
          <>
            <h2>Registro</h2>
            <RegisterForm
              onRegistered={() => {
                setShowRegisterForm(false);
              }}
              onCancel={handleBackToLogin}
            />
          </>
        )}
      </main>
    </div>
  );
}