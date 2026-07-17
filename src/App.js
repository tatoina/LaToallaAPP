import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./components/Login";
import RegisterForm from "./components/RegisterForm";
import Dashboard from "./pages/Dashboard";
import FiestasJuventud from "./pages/FiestasJuventud";
import FiestasDeSantiago from "./pages/FiestasDeSantiago";
import FiestasList from "./pages/FiestasList";
import FiestasListSelector from "./pages/FiestasListSelector";
import Ferias from "./pages/Ferias";
import GestionStock from "./pages/GestionStock";
import EventosTemporales from "./pages/EventosTemporales";
import AdminPanel from "./pages/AdminPanel";
import VotacionCohete from "./pages/VotacionCohete";
import Tienda from "./pages/Tienda";
import { useAuth } from "./contexts/AuthContext";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="centered">Cargando...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return children;
}

function RequireAdmin({ children }) {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="centered">Cargando...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

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
          path="/fiestas-juventud"
          element={
            <RequireAuth>
              <FiestasJuventud />
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
              <FiestasListSelector />
            </RequireAuth>
          }
        />
        <Route
          path="/fiestas/list/:eventKey"
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
        <Route
          path="/eventos-temporales"
          element={
            <RequireAuth>
              <EventosTemporales />
            </RequireAuth>
          }
        />
        <Route
          path="/votacion-cohete"
          element={
            <RequireAuth>
              <VotacionCohete />
            </RequireAuth>
          }
        />
        <Route
          path="/tienda"
          element={
            <RequireAuth>
              <Tienda />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminPanel />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}