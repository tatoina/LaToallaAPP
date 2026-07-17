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
import { db, auth, functions, storage } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const EVENT_LABELS = {
  juventud: "🎉 Fiestas Juventud",
  fiestas:  "🎊 Fiestas Santiago",
  ferias:   "🎡 Ferias",
};

const TABS = ["Usuarios", "Inscripciones", "Noticias", "Sugerencias", "Tienda"];
const NOTICIA_CATEGORIES = ["General", "Fiestas Juventud", "Fiestas Santiago", "Ferias", "Eventos"];

export default function AdminPanel() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState("Usuarios");

  // ── USUARIOS ──────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [editUserData, setEditUserData] = useState({});
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
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
    setDeletingUser(u.id);
    try {
      const deleteUserAccount = httpsCallable(functions, "deleteUserAccount");
      await deleteUserAccount({ uid: u.id });
    } catch (e) { alert("Error: " + e.message); }
    finally { setDeletingUser(null); }
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

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return (
      userName(u).toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.alias || "").toLowerCase().includes(q)
    );
  });

  // ── NOTICIAS ──────────────────────────────────────────────
  const [noticias, setNoticias] = useState([]);
  const [noticiaForm, setNoticiaForm] = useState({
    category: "General", title: "", body: "", imageUrl: "",
  });
  const [savingNoticia, setSavingNoticia] = useState(false);
  const [noticiaMsg, setNoticiaMsg] = useState("");
  const [uploadProgress, setUploadProgress] = useState(null); // null | 0-100
  const noticiaFileRef = React.useRef(null);

  const onNoticiaFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const storageRef = ref(storage, `noticias/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    setUploadProgress(0);
    task.on(
      "state_changed",
      (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { setNoticiaMsg("❌ Error al subir imagen: " + err.message); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setNoticiaForm((p) => ({ ...p, imageUrl: url }));
        setUploadProgress(null);
      }
    );
  };

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
  // ── SUGERENCIAS ───────────────────────────────────────────────────────────────────
  const [sugerencias, setSugerencias] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "sugerencias"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setSugerencias(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const onDeleteSugerencia = async (id) => {
    if (!window.confirm("¿Borrar esta sugerencia?")) return;
    try { await deleteDoc(doc(db, "sugerencias", id)); }
    catch (e) { alert("Error: " + e.message); }
  };
  // ── TIENDA ────────────────────────────────────────────────────────────────────
  const [tiendaProductos, setTiendaProductos] = useState([]);
  const [tiendaPedidos, setTiendaPedidos] = useState([]);
  const [tiendaForm, setTiendaForm] = useState({ nombre: "", precio: "" });
  const [tiendaFotoUrl, setTiendaFotoUrl] = useState("");
  const [tiendaUploadPct, setTiendaUploadPct] = useState(null);
  const [tiendaMsg, setTiendaMsg] = useState("");
  const [savingProducto, setSavingProducto] = useState(false);
  const [tiendaSubTab, setTiendaSubTab] = useState("productos"); // "productos" | "pedidos"
  const tiendaFileRef = React.useRef(null);
  const [editingProducto, setEditingProducto] = useState(null); // id del producto en edición
  const [editProductoData, setEditProductoData] = useState({ nombre: "", precio: "" });
  const [editProductoFotoUrl, setEditProductoFotoUrl] = useState("");
  const [editProductoUploadPct, setEditProductoUploadPct] = useState(null);
  const [savingEditProducto, setSavingEditProducto] = useState(false);
  const editProductoFileRef = React.useRef(null);

  useEffect(() => {
    const q = query(collection(db, "tienda_productos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTiendaProductos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "tienda_pedidos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTiendaPedidos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const onTiendaFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const storageRef = ref(storage, `tienda/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    setTiendaUploadPct(0);
    task.on(
      "state_changed",
      (snap) => setTiendaUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { setTiendaMsg("❌ Error al subir imagen: " + err.message); setTiendaUploadPct(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setTiendaFotoUrl(url);
        setTiendaUploadPct(null);
      }
    );
  };

  const onCrearProducto = async () => {
    if (!tiendaForm.nombre.trim()) { setTiendaMsg("❌ El nombre es obligatorio."); return; }
    const precio = parseFloat(tiendaForm.precio);
    if (isNaN(precio) || precio < 0) { setTiendaMsg("❌ El precio debe ser un número válido."); return; }
    setSavingProducto(true);
    setTiendaMsg("");
    try {
      await addDoc(collection(db, "tienda_productos"), {
        nombre: tiendaForm.nombre.trim(),
        precio,
        fotoUrl: tiendaFotoUrl,
        createdAt: serverTimestamp(),
      });
      setTiendaForm({ nombre: "", precio: "" });
      setTiendaFotoUrl("");
      if (tiendaFileRef.current) tiendaFileRef.current.value = "";
      setTiendaMsg("✅ Producto creado correctamente.");
      setTimeout(() => setTiendaMsg(""), 4000);
    } catch (e) { setTiendaMsg("❌ Error: " + e.message); }
    finally { setSavingProducto(false); }
  };

  const onDeleteProducto = async (id) => {
    if (!window.confirm("¿Borrar este producto?")) return;
    try { await deleteDoc(doc(db, "tienda_productos", id)); }
    catch (e) { alert("Error: " + e.message); }
  };

  const onStartEditProducto = (prod) => {
    setEditingProducto(prod.id);
    setEditProductoData({ nombre: prod.nombre, precio: String(prod.precio) });
    setEditProductoFotoUrl(prod.fotoUrl || "");
    setEditProductoUploadPct(null);
  };

  const onEditProductoFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const storageRef = ref(storage, `tienda/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    setEditProductoUploadPct(0);
    task.on(
      "state_changed",
      (snap) => setEditProductoUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { alert("❌ Error al subir imagen: " + err.message); setEditProductoUploadPct(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setEditProductoFotoUrl(url);
        setEditProductoUploadPct(null);
      }
    );
  };

  const onSaveEditProducto = async (id) => {
    if (!editProductoData.nombre.trim()) { alert("❌ El nombre es obligatorio."); return; }
    const precio = parseFloat(editProductoData.precio);
    if (isNaN(precio) || precio < 0) { alert("❌ El precio debe ser un número válido."); return; }
    setSavingEditProducto(true);
    try {
      await updateDoc(doc(db, "tienda_productos", id), {
        nombre: editProductoData.nombre.trim(),
        precio,
        fotoUrl: editProductoFotoUrl,
      });
      setEditingProducto(null);
    } catch (e) { alert("Error: " + e.message); }
    finally { setSavingEditProducto(false); }
  };

  const onTogglePedidoEstado = async (pedido) => {
    const nuevoEstado = pedido.estado === "pagado" ? "pendiente" : "pagado";
    try { await updateDoc(doc(db, "tienda_pedidos", pedido.id), { estado: nuevoEstado }); }
    catch (e) { alert("Error: " + e.message); }
  };

  const onDeletePedido = async (id) => {
    if (!window.confirm("¿Borrar este pedido?")) return;
    try { await deleteDoc(doc(db, "tienda_pedidos", id)); }
    catch (e) { alert("Error: " + e.message); }
  };

  const formatPrecio = (p) =>
    Number(p).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
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
            {t === "Usuarios" ? "👥 Usuarios" : t === "Inscripciones" ? "📋 Inscripciones" : t === "Noticias" ? "📢 Noticias" : t === "Tienda" ? "🛒 Tienda" : "✉️ Sugerencias"}
          </button>
        ))}
      </div>

      {/* ── PESTAÑA USUARIOS ── */}
      {activeTab === "Usuarios" && (
        <div className="admin-section">
          {/* Barra de búsqueda + contador */}
          <div className="admin-users-toolbar">
            <input
              className="admin-input"
              placeholder="🔍 Buscar por nombre, email o alias..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={{ flex: 1, margin: 0 }}
            />
            <span className="admin-users-count">
              {filteredUsers.length} / {users.length} usuarios
            </span>
          </div>

          {loadingUsers ? (
            <div className="centered">Cargando...</div>
          ) : filteredUsers.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center" }}>
              {users.length === 0 ? "No hay usuarios registrados." : "No hay resultados para esa búsqueda."}
            </p>
          ) : (
            filteredUsers.map((u) => (
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
                      <button className="btn danger small" onClick={() => onDeleteUser(u)} disabled={deletingUser === u.id}>🗑️</button>
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
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn outline small"
                  onClick={() => noticiaFileRef.current?.click()}
                  disabled={uploadProgress !== null}
                >
                  📁 Elegir foto
                </button>
                {uploadProgress !== null && (
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 3 }}>Subiendo… {uploadProgress}%</div>
                    <div style={{ background: "#e5e7eb", borderRadius: 6, height: 6 }}>
                      <div style={{ background: "var(--accent)", width: `${uploadProgress}%`, height: 6, borderRadius: 6, transition: "width 0.2s" }} />
                    </div>
                  </div>
                )}
                {noticiaForm.imageUrl && uploadProgress === null && (
                  <button
                    type="button"
                    className="btn outline small"
                    style={{ color: "#b91c1c", borderColor: "#b91c1c" }}
                    onClick={() => { setNoticiaForm((p) => ({ ...p, imageUrl: "" })); if (noticiaFileRef.current) noticiaFileRef.current.value = ""; }}
                  >
                    ✕ Quitar
                  </button>
                )}
              </div>
              <input
                ref={noticiaFileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onNoticiaFileChange}
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

      {/* ── PESTAÑA SUGERENCIAS ── */}
      {activeTab === "Sugerencias" && (
        <div className="admin-section">
          {sugerencias.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center" }}>No hay sugerencias todavía.</p>
          ) : (
            sugerencias.map((s) => {
              const fecha = s.createdAt?.toDate
                ? s.createdAt.toDate().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })
                : "";
              return (
                <div key={s.id} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{s.texto}</div>
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{s.email || "Anónimo"}{fecha ? ` · ${fecha}` : ""}</div>
                  </div>
                  <button className="btn danger small" onClick={() => onDeleteSugerencia(s.id)} style={{ flexShrink: 0 }}>🗑️</button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── PESTAÑA TIENDA ── */}
      {activeTab === "Tienda" && (
        <div className="admin-section">
          {/* Sub-tabs */}
          <div className="admin-tabs" style={{ marginBottom: 16 }}>
            <button
              className={`admin-tab${tiendaSubTab === "productos" ? " active" : ""}`}
              onClick={() => setTiendaSubTab("productos")}
            >🛍️ Productos</button>
            <button
              className={`admin-tab${tiendaSubTab === "pedidos" ? " active" : ""}`}
              onClick={() => setTiendaSubTab("pedidos")}
            >📦 Pedidos</button>
          </div>

          {/* ── Gestión de productos ── */}
          {tiendaSubTab === "productos" && (
            <div>
              <div className="noticia-form-card">
                <h3 className="noticia-form-title">➕ Nuevo producto</h3>
                <input
                  className="admin-input"
                  placeholder="Nombre del producto"
                  value={tiendaForm.nombre}
                  onChange={(e) => setTiendaForm((p) => ({ ...p, nombre: e.target.value }))}
                />
                <input
                  className="admin-input"
                  placeholder="Precio (ej: 2.50)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tiendaForm.precio}
                  onChange={(e) => setTiendaForm((p) => ({ ...p, precio: e.target.value }))}
                />
                <div className="noticia-image-section">
                  <label className="noticia-img-label">🖼️ Foto del producto (opcional)</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn outline small"
                      onClick={() => tiendaFileRef.current?.click()}
                      disabled={tiendaUploadPct !== null}
                    >📁 Elegir foto</button>
                    {tiendaUploadPct !== null && (
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: 3 }}>Subiendo… {tiendaUploadPct}%</div>
                        <div style={{ background: "#e5e7eb", borderRadius: 6, height: 6 }}>
                          <div style={{ background: "var(--accent)", width: `${tiendaUploadPct}%`, height: 6, borderRadius: 6, transition: "width 0.2s" }} />
                        </div>
                      </div>
                    )}
                    {tiendaFotoUrl && tiendaUploadPct === null && (
                      <button
                        type="button"
                        className="btn outline small"
                        style={{ color: "#b91c1c", borderColor: "#b91c1c" }}
                        onClick={() => { setTiendaFotoUrl(""); if (tiendaFileRef.current) tiendaFileRef.current.value = ""; }}
                      >✕ Quitar</button>
                    )}
                  </div>
                  <input
                    ref={tiendaFileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={onTiendaFileChange}
                  />
                  {tiendaFotoUrl && (
                    <img
                      src={tiendaFotoUrl}
                      alt="preview"
                      className="noticia-img-preview"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  )}
                </div>
                {tiendaMsg && (
                  <p className={`noticia-msg${tiendaMsg.startsWith("✅") ? " ok" : " err"}`}>{tiendaMsg}</p>
                )}
                <button
                  className="btn large"
                  onClick={onCrearProducto}
                  disabled={savingProducto || tiendaUploadPct !== null}
                  style={{ marginTop: 4 }}
                >
                  {savingProducto ? "Guardando..." : "💾 Crear producto"}
                </button>
              </div>

              <h3 style={{ fontSize: 15, margin: "20px 0 8px", color: "var(--text)" }}>Productos en la tienda</h3>
              {tiendaProductos.length === 0 ? (
                <p style={{ color: "#999", textAlign: "center" }}>No hay productos todavía.</p>
              ) : (
                tiendaProductos.map((prod) => (
                  <div
                    key={prod.id}
                    style={{
                      background: "#fff", borderRadius: 10, padding: "10px 14px",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 10,
                    }}
                  >
                    {editingProducto === prod.id ? (
                      /* ── MODO EDICIÓN ── */
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          className="admin-input"
                          placeholder="Nombre del producto"
                          value={editProductoData.nombre}
                          onChange={(e) => setEditProductoData((p) => ({ ...p, nombre: e.target.value }))}
                        />
                        <input
                          className="admin-input"
                          placeholder="Precio (ej: 2.50)"
                          type="number"
                          min="0"
                          step="0.01"
                          value={editProductoData.precio}
                          onChange={(e) => setEditProductoData((p) => ({ ...p, precio: e.target.value }))}
                        />
                        {/* Foto */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {editProductoFotoUrl && (
                            <img
                              src={editProductoFotoUrl} alt="preview"
                              style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover" }}
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                          )}
                          <button
                            type="button"
                            className="btn outline small"
                            onClick={() => editProductoFileRef.current?.click()}
                            disabled={editProductoUploadPct !== null}
                          >🖼️ {editProductoFotoUrl ? "Cambiar foto" : "Añadir foto"}</button>
                          {editProductoFotoUrl && (
                            <button
                              type="button"
                              className="btn outline small"
                              style={{ color: "#b91c1c", borderColor: "#b91c1c" }}
                              onClick={() => { setEditProductoFotoUrl(""); if (editProductoFileRef.current) editProductoFileRef.current.value = ""; }}
                            >✕ Quitar</button>
                          )}
                          {editProductoUploadPct !== null && (
                            <span style={{ fontSize: 12, color: "#666" }}>Subiendo… {editProductoUploadPct}%</span>
                          )}
                        </div>
                        <input
                          ref={editProductoFileRef}
                          type="file" accept="image/*"
                          style={{ display: "none" }}
                          onChange={onEditProductoFileChange}
                        />
                        <div className="admin-user-actions" style={{ marginTop: 4 }}>
                          <button
                            className="btn small"
                            onClick={() => onSaveEditProducto(prod.id)}
                            disabled={savingEditProducto || editProductoUploadPct !== null}
                          >{savingEditProducto ? "..." : "Guardar"}</button>
                          <button className="btn outline small" onClick={() => setEditingProducto(null)}>✕</button>
                        </div>
                      </div>
                    ) : (
                      /* ── MODO NORMAL ── */
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {prod.fotoUrl ? (
                          <img
                            src={prod.fotoUrl} alt={prod.nombre}
                            style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        ) : (
                          <div style={{ width: 54, height: 54, borderRadius: 8, background: "#f0f4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🛍️</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{prod.nombre}</div>
                          <div style={{ color: "#2563eb", fontWeight: 700, fontSize: 13 }}>{formatPrecio(prod.precio)}</div>
                        </div>
                        <button className="btn small" onClick={() => onStartEditProducto(prod)}>✏️</button>
                        <button className="btn danger small" onClick={() => onDeleteProducto(prod.id)}>🗑️</button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Pedidos de clientes ── */}
          {tiendaSubTab === "pedidos" && (
            <div>
              {tiendaPedidos.length === 0 ? (
                <p style={{ color: "#999", textAlign: "center" }}>No hay pedidos todavía.</p>
              ) : (
                tiendaPedidos.map((pedido) => (
                  <div
                    key={pedido.id}
                    style={{
                      background: "#fff", borderRadius: 12, padding: "12px 14px",
                      boxShadow: "0 1px 5px rgba(0,0,0,0.08)", marginBottom: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>
                          {(() => {
                            const u = users.find((u) => u.id === pedido.userId);
                            return u ? userName(u) : (pedido.userName || pedido.userEmail || "Desconocido");
                          })()}
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {pedido.userEmail || ""}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>
                          {pedido.createdAt?.toDate
                            ? pedido.createdAt.toDate().toLocaleString("es-ES")
                            : "—"}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 12, fontWeight: 700,
                          color: pedido.estado === "pagado" ? "#059669" : "#d97706",
                          background: pedido.estado === "pagado" ? "#d1fae5" : "#fef3c7",
                          borderRadius: 6, padding: "2px 8px", height: "fit-content",
                        }}
                      >
                        {pedido.estado === "pagado" ? "✅ Pagado" : "⏳ Pendiente"}
                      </span>
                    </div>
                    {(pedido.items || []).map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 2 }}>
                        <span>{item.nombre} × {item.cantidad}</span>
                        <span>{formatPrecio(item.precio * item.cantidad)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid #f0f4ff", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
                      <span>Total</span>
                      <span style={{ color: "#2563eb" }}>{formatPrecio(pedido.total)}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button
                        className="btn small"
                        onClick={() => onTogglePedidoEstado(pedido)}
                      >
                        {pedido.estado === "pagado" ? "↩️ Marcar pendiente" : "✅ Marcar pagado"}
                      </button>
                      <button className="btn danger small" onClick={() => onDeletePedido(pedido.id)}>🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="page-bottom-nav">
        <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
      </div>
    </div>
  );
}
