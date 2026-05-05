import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  addDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { sendPasswordResetEmail } from "firebase/auth";
import { db, auth, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const EVENT_LABELS = {
  juventud: "🎉 Fiestas Juventud",
  fiestas:  "🎊 Fiestas Santiago",
  ferias:   "🎡 Ferias",
};

const TABS = ["Usuarios", "Inscripciones", "Noticias"];
const NOTICIA_CATEGORIES = ["General", "Fiestas Juventud", "Fiestas Santiago", "Ferias", "Eventos"];

export default function AdminPanel() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("Usuarios");

  // ── USUARIOS ──────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});
  const [savingUser, setSavingUser] = useState(false);
  const [resetMsg, setResetMsg] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingUsers(false);
    });
    return () => unsub();
  }, []);

  const onEditUser = (u) => {
    setEditingUser(u.id);
    setEditUserData({
      firstName: u.firstName || "",
      lastName:  u.lastName  || "",
      alias:     u.alias     || "",
      telefono:  u.telefono  || "",
      fechaNac:  u.fechaNac  || "",
      email:     u.email     || "",
    });
  };

  const onSaveUser = async (uid) => {
    setSavingUser(true);
    try {
      await updateDoc(doc(db, "users", uid), {
        firstName: editUserData.firstName.trim(),
        lastName:  editUserData.lastName.trim(),
        alias:     editUserData.alias.trim(),
        telefono:  editUserData.telefono.trim(),
        fechaNac:  editUserData.fechaNac,
        name:      `${editUserData.firstName.trim()} ${editUserData.lastName.trim()}`.trim(),
      });
      setEditingUser(null);
    } catch (e) { alert("Error al guardar: " + e.message); }
    finally { setSavingUser(false); }
  };

  const onDeleteUser = async (u) => {
    const nombre = userName(u);
    if (!window.confirm(
      `⚠️ ¿Borrar a "${nombre}" completamente?\n\n` +
      `Se eliminará su cuenta de acceso y su perfil.\n` +
      `Tendrá que registrarse de nuevo si quiere volver a entrar.`
    )) return;
    try {
      const deleteUserAccount = httpsCallable(functions, "deleteUserAccount");
      await deleteUserAccount({ uid: u.id });
    } catch (e) { alert("Error: " + e.message); }
  };

  const onResetPassword = async (u) => {
    const email = u.email;
    if (!email) return alert("Este usuario no tiene email registrado.");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMsg((p) => ({ ...p, [u.id]: "✅ Email enviado" }));
      setTimeout(() => setResetMsg((p) => { const n = {...p}; delete n[u.id]; return n; }), 4000);
    } catch (e) { alert("Error: " + e.message); }
  };

  const userName = (u) => u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || u.id;

  // ── NOTICIAS ──────────────────────────────────────────────
  const [noticias, setNoticias] = useState([]);
  const [noticiaForm, setNoticiaForm] = useState({
    category: "General", title: "", body: "", imageUrl: "",
  });
  const [savingNoticia, setSavingNoticia] = useState(false);
  const [noticiaMsg, setNoticiaMsg] = useState("");

  useEffect(() => {
    const q = query(collection(db, "noticias"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNoticias(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const onPublishNoticia = async () => {
    if (!noticiaForm.title.trim() || !noticiaForm.body.trim()) {
      setNoticiaMsg("❌ El título y el contenido son obligatorios.");
      return;
    }
    setSavingNoticia(true);
    setNoticiaMsg("");
    try {
      await addDoc(collection(db, "noticias"), {
        category: noticiaForm.category,
        title: noticiaForm.title.trim(),
        body: noticiaForm.body.trim(),
        imageUrl: noticiaForm.imageUrl.trim(),
        createdAt: serverTimestamp(),
      });
      setNoticiaForm({ category: "General", title: "", body: "", imageUrl: "" });
      setNoticiaMsg("✅ Noticia publicada y email enviado a todos los usuarios.");
      setTimeout(() => setNoticiaMsg(""), 5000);
    } catch (e) {
      setNoticiaMsg("❌ Error: " + e.message);
    }
    setSavingNoticia(false);
  };

  const onDeleteNoticia = async (id) => {
    if (!window.confirm("¿Borrar esta noticia?")) return;
    try { await deleteDoc(doc(db, "noticias", id)); }
    catch (e) { alert("Error: " + e.message); }
  };

  // ── INSCRIPCIONES ─────────────────────────────────────────
  const [signups, setSignups] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loadingSignups, setLoadingSignups] = useState(true);
  const [activeEvent, setActiveEvent] = useState("juventud");
  const [editingSignup, setEditingSignup] = useState(null);
  const [editSignupData, setEditSignupData] = useState({});
  const [savingSignup, setSavingSignup] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "fiestas_signups"), orderBy("date", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setSignups(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadingSignups(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "eventos"), orderBy("fecha", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setEventos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const allEventTabs = [
    { key: "juventud", label: "🎉 Juventud" },
    { key: "fiestas",  label: "🎊 Santiago" },
    { key: "ferias",   label: "🎡 Ferias" },
    ...eventos.map((ev) => ({ key: `evento_${ev.id}`, label: `📅 ${ev.nombre}` })),
  ];

  const filteredSignups = signups.filter((s) => s.eventType === activeEvent);

  const onEditSignup = (s) => {
    setEditingSignup(s.id);
    setEditSignupData({
      adults: s.adults || 0,
      children: s.children || 0,
      almuerzo: !!s.almuerzo,
      comida: !!s.comida,
      cena: !!s.cena,
      date: s.date || "",
    });
  };

  const onSaveSignup = async (id) => {
    setSavingSignup(true);
    try {
      await updateDoc(doc(db, "fiestas_signups", id), {
        adults: Number(editSignupData.adults),
        children: Number(editSignupData.children),
        almuerzo: !!editSignupData.almuerzo,
        comida: !!editSignupData.comida,
        cena: !!editSignupData.cena,
        date: editSignupData.date,
      });
      setEditingSignup(null);
    } catch (e) { alert("Error: " + e.message); }
    finally { setSavingSignup(false); }
  };

  const onDeleteSignup = async (id) => {
    if (!window.confirm("¿Borrar esta inscripción?")) return;
    try { await deleteDoc(doc(db, "fiestas_signups", id)); }
    catch (e) { alert("Error: " + e.message); }
  };

  const onDeleteAllByEvent = async () => {
    const label = allEventTabs.find((t) => t.key === activeEvent)?.label || activeEvent;
    if (!window.confirm(`¿Borrar TODAS las inscripciones de "${label}"? Esta acción no se puede deshacer.`)) return;
    try {
      const q = query(collection(db, "fiestas_signups"), where("eventType", "==", activeEvent));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (e) { alert("Error: " + e.message); }
  };

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p>⛔ Acceso restringido</p>
          <button className="btn" onClick={() => navigate("/")}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2 className="page-header-title">⚙️ Panel Admin</h2>
      </div>

      {/* Tabs principales */}
      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`admin-tab${activeTab === t ? " active" : ""}`}
            onClick={() => setActiveTab(t)}
          >
            {t === "Usuarios" ? "👥 Usuarios" : t === "Inscripciones" ? "📋 Inscripciones" : "📢 Noticias"}
          </button>
        ))}
      </div>

      {/* ── PESTAÑA USUARIOS ── */}
      {activeTab === "Usuarios" && (
        <div className="admin-section">
          {loadingUsers ? (
            <div className="centered">Cargando...</div>
          ) : users.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center" }}>No hay usuarios registrados.</p>
          ) : (
            users.map((u) => (
              <div key={u.id} className="admin-user-card">
                {editingUser === u.id ? (
                  <div className="admin-user-edit">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                      <label style={{ display:"flex", flexDirection:"column", fontSize:11, fontWeight:700, color:"#666", gap:3 }}>
                        Nombre
                        <input className="admin-input" value={editUserData.firstName}
                          onChange={e => setEditUserData(p => ({ ...p, firstName: e.target.value }))} placeholder="Nombre" />
                      </label>
                      <label style={{ display:"flex", flexDirection:"column", fontSize:11, fontWeight:700, color:"#666", gap:3 }}>
                        Apellidos
                        <input className="admin-input" value={editUserData.lastName}
                          onChange={e => setEditUserData(p => ({ ...p, lastName: e.target.value }))} placeholder="Apellidos" />
                      </label>
                      <label style={{ display:"flex", flexDirection:"column", fontSize:11, fontWeight:700, color:"#666", gap:3 }}>
                        Alias (listados)
                        <input className="admin-input" value={editUserData.alias}
                          onChange={e => setEditUserData(p => ({ ...p, alias: e.target.value }))} placeholder="Alias" />
                      </label>
                      <label style={{ display:"flex", flexDirection:"column", fontSize:11, fontWeight:700, color:"#666", gap:3 }}>
                        Teléfono
                        <input className="admin-input" value={editUserData.telefono}
                          onChange={e => setEditUserData(p => ({ ...p, telefono: e.target.value }))} placeholder="Teléfono" />
                      </label>
                      <label style={{ display:"flex", flexDirection:"column", fontSize:11, fontWeight:700, color:"#666", gap:3 }}>
                        Fecha nacimiento
                        <input className="admin-input" type="date" value={editUserData.fechaNac}
                          onChange={e => setEditUserData(p => ({ ...p, fechaNac: e.target.value }))} />
                      </label>
                      <label style={{ display:"flex", flexDirection:"column", fontSize:11, fontWeight:700, color:"#666", gap:3 }}>
                        Email (solo lectura)
                        <input className="admin-input" value={editUserData.email} disabled style={{ opacity:0.5 }} />
                      </label>
                    </div>
                    <div className="admin-user-actions">
                      <button className="btn small" onClick={() => onSaveUser(u.id)} disabled={savingUser}>
                        {savingUser ? "..." : "Guardar"}
                      </button>
                      <button className="btn outline small" onClick={() => setEditingUser(null)}>✕</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-user-info">
                      <span className="admin-user-name">{userName(u)}</span>
                      <span className="admin-user-email">{u.email || u.id}</span>
                    </div>
                    <div className="admin-user-actions">
                      <button className="btn small" onClick={() => onEditUser(u)}>✏️ Editar</button>
                      <button
                        className="btn outline small"
                        onClick={() => onResetPassword(u)}
                      >
                        🔑 Reset
                      </button>
                      <button className="btn danger small" onClick={() => onDeleteUser(u)}>🗑️</button>
                    </div>
                  </>
                )}
                {resetMsg[u.id] && (
                  <div style={{ fontSize: 12, color: "green", marginTop: 4 }}>{resetMsg[u.id]}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── PESTAÑA INSCRIPCIONES ── */}
      {activeTab === "Inscripciones" && (
        <div className="admin-section">
          {/* Tabs de evento */}
          <div className="list-event-tabs" style={{ marginBottom: 12 }}>
            {allEventTabs.map(({ key, label }) => (
              <button
                key={key}
                className={`list-tab${activeEvent === key ? " active" : ""}`}
                onClick={() => { setActiveEvent(key); setEditingSignup(null); }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Botón borrar todas */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="btn danger small" onClick={onDeleteAllByEvent}>
              🗑️ Borrar todas las inscripciones de este evento
            </button>
          </div>

          {loadingSignups ? (
            <div className="centered">Cargando...</div>
          ) : filteredSignups.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center" }}>No hay inscripciones para este evento.</p>
          ) : (
            filteredSignups.map((s) => {
              const isEditing = editingSignup === s.id;
              const meals = [s.almuerzo && "Alm.", s.comida && "Com.", s.cena && "Cena"].filter(Boolean).join(" · ") || "—";
              return (
                <div key={s.id} className="admin-signup-card">
                  {isEditing ? (
                    <div className="admin-signup-edit">
                      <input type="date" className="admin-input" value={editSignupData.date}
                        onChange={(e) => setEditSignupData((p) => ({ ...p, date: e.target.value }))} />
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        {[["almuerzo","Alm."],["comida","Com."],["cena","Cena"]].map(([f,l]) => (
                          <label key={f} style={{ fontSize: 13, display: "flex", gap: 4, alignItems: "center" }}>
                            <input type="checkbox" checked={!!editSignupData[f]}
                              onChange={(e) => setEditSignupData((p) => ({ ...p, [f]: e.target.checked }))} />
                            {l}
                          </label>
                        ))}
                        <input type="number" min="0" className="admin-input-sm" value={editSignupData.adults}
                          onChange={(e) => setEditSignupData((p) => ({ ...p, adults: e.target.value }))}
                          placeholder="Ad." />
                        <input type="number" min="0" className="admin-input-sm" value={editSignupData.children}
                          onChange={(e) => setEditSignupData((p) => ({ ...p, children: e.target.value }))}
                          placeholder="Ni." />
                      </div>
                      <div className="admin-user-actions" style={{ marginTop: 6 }}>
                        <button className="btn small" onClick={() => onSaveSignup(s.id)} disabled={savingSignup}>
                          {savingSignup ? "..." : "Guardar"}
                        </button>
                        <button className="btn outline small" onClick={() => setEditingSignup(null)}>✕</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="admin-signup-info">
                        <span className="admin-user-name">{s.name || s.email || "anónimo"}</span>
                        <span className="admin-user-email">{s.date} · {meals} · 🧑{s.adults || 0} 🧒{s.children || 0}</span>
                      </div>
                      <div className="admin-user-actions">
                        <button className="btn small" onClick={() => onEditSignup(s)}>✏️</button>
                        <button className="btn danger small" onClick={() => onDeleteSignup(s.id)}>🗑️</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── PESTAÑA NOTICIAS ── */}
      {activeTab === "Noticias" && (
        <div className="admin-section">
          {/* Formulario publicar */}
          <div className="noticia-form-card">
            <h3 className="noticia-form-title">📢 Publicar noticia</h3>

            <select
              className="admin-input"
              value={noticiaForm.category}
              onChange={(e) => setNoticiaForm((p) => ({ ...p, category: e.target.value }))}
            >
              {NOTICIA_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <input
              className="admin-input"
              placeholder="Título"
              value={noticiaForm.title}
              onChange={(e) => setNoticiaForm((p) => ({ ...p, title: e.target.value }))}
            />

            <textarea
              className="admin-textarea"
              placeholder="Escribe la noticia o aviso..."
              value={noticiaForm.body}
              onChange={(e) => setNoticiaForm((p) => ({ ...p, body: e.target.value }))}
              rows={5}
            />

            <div className="noticia-image-section">
              <label className="noticia-img-label">🖼️ Imagen (opcional)</label>
              <input
                className="admin-input"
                placeholder="Pega una URL de imagen..."
                value={noticiaForm.imageUrl}
                onChange={(e) => setNoticiaForm((p) => ({ ...p, imageUrl: e.target.value }))}
              />
              {noticiaForm.imageUrl && (
                <img
                  src={noticiaForm.imageUrl}
                  alt="preview"
                  className="noticia-img-preview"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              )}
            </div>

            {noticiaMsg && (
              <p className={`noticia-msg${noticiaMsg.startsWith("✅") ? " ok" : " err"}`}>
                {noticiaMsg}
              </p>
            )}

            <button
              className="btn large"
              onClick={onPublishNoticia}
              disabled={savingNoticia}
              style={{ marginTop: 4 }}
            >
              {savingNoticia ? "Publicando..." : "📤 Publicar y enviar email a todos"}
            </button>
          </div>

          {/* Lista de noticias publicadas */}
          <h3 style={{ fontSize: 15, margin: "20px 0 8px", color: "var(--text)" }}>Noticias publicadas</h3>
          {noticias.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center" }}>No hay noticias publicadas aún.</p>
          ) : (
            noticias.map((n) => (
              <div key={n.id} className="noticia-published-card">
                <div className="noticia-published-body">
                  <span className="noticia-category-badge">{n.category}</span>
                  <p className="noticia-published-title">{n.title}</p>
                  <p className="noticia-published-preview">
                    {n.body.length > 90 ? n.body.slice(0, 90) + "..." : n.body}
                  </p>
                  {n.imageUrl && (
                    <img
                      src={n.imageUrl}
                      alt="noticia"
                      className="noticia-published-img"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  )}
                </div>
                <button
                  className="btn danger small"
                  onClick={() => onDeleteNoticia(n.id)}
                  style={{ flexShrink: 0, alignSelf: "flex-start" }}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div className="page-bottom-nav">
        <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
      </div>
    </div>
  );
}
