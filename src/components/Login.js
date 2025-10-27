import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import RegisterForm from "./RegisterForm";
import ResetPassword from "./ResetPassword";
import { useNavigate } from "react-router-dom";
import loco from "../assets/loco.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showResetForm, setShowResetForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setInfo("Login correcto. Redirigiendo...");
      navigate("/");
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const handleShowRegister = () => {
    setShowRegisterForm(true);
    setShowResetForm(false);
    setError("");
    setInfo("");
  };

  const handleBackToLogin = () => {
    setShowRegisterForm(false);
    setShowResetForm(false);
    setError("");
    setInfo("");
    setEmail("");
    setPassword("");
  };

  const handleShowReset = () => {
    setShowResetForm(true);
    setShowRegisterForm(false);
    setError("");
    setInfo("");
  };

  return (
    <div className="login-wrapper">
      <main className="card">
        <div className="card-top">
          <img src={loco} alt="loco" className="card-logo" />
        </div>

        {!showRegisterForm && !showResetForm ? (
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

              <div style={{ marginTop: 10, textAlign: "center" }}>
                <button
                  type="button"
                  className="btn outline small"
                  onClick={handleShowReset}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>

            {error && <p className="error">{error}</p>}
            {info && <p className="info">{info}</p>}
          </>
        ) : showRegisterForm ? (
          <>
            <h2>Registro</h2>
            <RegisterForm
              onRegistered={() => {
                setShowRegisterForm(false);
              }}
              onCancel={handleBackToLogin}
            />
          </>
        ) : (
          <>
            <h2>Restablecer contraseña</h2>
            <ResetPassword onBack={handleBackToLogin} />
          </>
        )}
      </main>
    </div>
  );
}