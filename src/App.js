import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./components/Login";
import RegisterForm from "./components/RegisterForm";
import Dashboard from "./pages/Dashboard";
import FiestasDeSantiago from "./pages/FiestasDeSantiago";
import FiestasList from "./pages/FiestasList";
import Ferias from "./pages/Ferias";
import GestionStock from "./pages/GestionStock";
import { useAuth } from "./contexts/AuthContext";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="centered">Cargando...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
}

export default function App() {
  return (
    <>
      {/* PWA install prompt se renderiza en la raíz para que pueda mostrarse cuando proceda */}
      <PWAInstallPrompt />

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<RegisterForm onRegistered={() => {}} onCancel={() => {}} />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/fiestas"
          element={
            <RequireAuth>
              <FiestasDeSantiago />
            </RequireAuth>
          }
        />
        <Route
          path="/fiestas/list"
          element={
            <RequireAuth>
              <FiestasList />
            </RequireAuth>
          }
        />
        <Route
          path="/ferias"
          element={
            <RequireAuth>
              <Ferias />
            </RequireAuth>
          }
        />
        <Route
          path="/gestion-stock"
          element={
            <RequireAuth>
              <GestionStock />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}