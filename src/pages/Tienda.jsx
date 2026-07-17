import React, { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Tienda() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cantidades, setCantidades] = useState({}); // { productoId: number }
  const [vista, setVista] = useState("catalogo"); // "catalogo" | "resumen"
  const [pedidos, setPedidos] = useState([]); // historial de pedidos del usuario
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [pedidoMsg, setPedidoMsg] = useState("");
  const [activeTab, setActiveTab] = useState("catalogo"); // "catalogo" | "mispedidos"

  // Cargar productos
  useEffect(() => {
    const q = query(collection(db, "tienda_productos"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setProductos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Cargar pedidos del usuario
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "tienda_pedidos"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPedidos(todos.filter((p) => p.userId === user.uid));
      setLoadingPedidos(false);
    });
    return () => unsub();
  }, [user]);

  const setCantidad = (id, val) => {
    const n = Math.max(0, Number(val) || 0);
    setCantidades((prev) => ({ ...prev, [id]: n }));
  };

  const itemsCarrito = productos
    .filter((p) => (cantidades[p.id] || 0) > 0)
    .map((p) => ({ ...p, cantidad: cantidades[p.id] }));

  const totalCarrito = itemsCarrito.reduce(
    (acc, p) => acc + p.precio * p.cantidad,
    0
  );

  const onRealizarPedido = async () => {
    if (itemsCarrito.length === 0) return;
    setEnviando(true);
    setPedidoMsg("");
    try {
      await addDoc(collection(db, "tienda_pedidos"), {
        userId: user.uid,
        userEmail: user.email || "",
        userName:
          user.displayName ||
          user.email ||
          user.uid,
        items: itemsCarrito.map((p) => ({
          productoId: p.id,
          nombre: p.nombre,
          precio: p.precio,
          cantidad: p.cantidad,
        })),
        total: totalCarrito,
        estado: "pendiente",
        createdAt: serverTimestamp(),
      });
      setCantidades({});
      setVista("resumen");
      setPedidoMsg("¡Pedido realizado con éxito!");
      setActiveTab("mispedidos");
    } catch (e) {
      setPedidoMsg("❌ Error al realizar el pedido: " + e.message);
    } finally {
      setEnviando(false);
    }
  };

  const formatPrecio = (p) =>
    Number(p).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

  return (
    <div className="page" style={{ maxWidth: 600, margin: "0 auto", padding: "12px 8px 40px" }}>
      {/* Cabecera */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className="btn outline small"
          onClick={() => navigate("/")}
          style={{ padding: "6px 10px" }}
        >
          ← Volver
        </button>
        <h2 className="page-header-title" style={{ margin: 0 }}>🛒 Tienda</h2>
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ marginTop: 12 }}>
        <button
          className={`admin-tab${activeTab === "catalogo" ? " active" : ""}`}
          onClick={() => setActiveTab("catalogo")}
        >
          🛍️ Catálogo
        </button>
        <button
          className={`admin-tab${activeTab === "mispedidos" ? " active" : ""}`}
          onClick={() => setActiveTab("mispedidos")}
        >
          📦 Mis pedidos
        </button>
      </div>

      {/* ── CATÁLOGO ── */}
      {activeTab === "catalogo" && (
        <div>
          {loading ? (
            <div className="centered" style={{ padding: 40 }}>Cargando productos...</div>
          ) : productos.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
              <p style={{ fontSize: 40 }}>🏪</p>
              <p>Aún no hay productos disponibles.<br />El administrador los añadirá pronto.</p>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
                {productos.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      background: "#fff",
                      borderRadius: 12,
                      boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 14px",
                      overflow: "hidden",
                    }}
                  >
                    {/* Foto */}
                    {p.fotoUrl ? (
                      <img
                        src={p.fotoUrl}
                        alt={p.nombre}
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 10,
                          objectFit: "cover",
                          flexShrink: 0,
                          background: "#f0f4ff",
                        }}
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 72,
                          height: 72,
                          borderRadius: 10,
                          background: "#f0f4ff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 30,
                          flexShrink: 0,
                        }}
                      >
                        🛍️
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.nombre}
                      </div>
                      <div style={{ color: "#2563eb", fontWeight: 700, fontSize: 16 }}>
                        {formatPrecio(p.precio)}
                      </div>
                    </div>

                    {/* Selector cantidad */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => setCantidad(p.id, (cantidades[p.id] || 0) - 1)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          border: "1.5px solid #e0e7ff", background: "#f0f4ff",
                          fontSize: 18, cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center", fontWeight: 700,
                        }}
                      >−</button>
                      <span style={{ minWidth: 24, textAlign: "center", fontWeight: 700, fontSize: 15 }}>
                        {cantidades[p.id] || 0}
                      </span>
                      <button
                        onClick={() => setCantidad(p.id, (cantidades[p.id] || 0) + 1)}
                        style={{
                          width: 32, height: 32, borderRadius: 8,
                          border: "1.5px solid #e0e7ff", background: "#2563eb",
                          color: "#fff", fontSize: 18, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
                        }}
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Carrito flotante */}
              {itemsCarrito.length > 0 && (
                <div
                  style={{
                    position: "sticky",
                    bottom: 16,
                    marginTop: 20,
                    background: "#1e40af",
                    borderRadius: 14,
                    padding: "14px 18px",
                    boxShadow: "0 4px 20px rgba(30,64,175,0.35)",
                    color: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
                    🛒 Carrito — {itemsCarrito.length} producto{itemsCarrito.length !== 1 ? "s" : ""}
                  </div>
                  {itemsCarrito.map((item) => (
                    <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                      <span>{item.nombre} × {item.cantidad}</span>
                      <span>{formatPrecio(item.precio * item.cantidad)}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      borderTop: "1px solid rgba(255,255,255,0.25)",
                      marginTop: 8, paddingTop: 8,
                      display: "flex", justifyContent: "space-between",
                      fontWeight: 700, fontSize: 16,
                    }}
                  >
                    <span>Total</span>
                    <span>{formatPrecio(totalCarrito)}</span>
                  </div>
                  {pedidoMsg && (
                    <p style={{ fontSize: 12, marginTop: 6, color: pedidoMsg.startsWith("❌") ? "#fca5a5" : "#bbf7d0" }}>
                      {pedidoMsg}
                    </p>
                  )}
                  <button
                    onClick={onRealizarPedido}
                    disabled={enviando}
                    style={{
                      marginTop: 12, width: "100%", padding: "12px 0",
                      background: "#fff", color: "#1e40af",
                      borderRadius: 10, border: "none",
                      fontWeight: 700, fontSize: 15, cursor: "pointer",
                    }}
                  >
                    {enviando ? "Enviando..." : "✅ Realizar pedido"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── MIS PEDIDOS ── */}
      {activeTab === "mispedidos" && (
        <div style={{ marginTop: 16 }}>
          {pedidoMsg && (
            <div
              style={{
                background: "#d1fae5",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 12,
                color: "#065f46",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {pedidoMsg}
            </div>
          )}
          {loadingPedidos ? (
            <div className="centered" style={{ padding: 40 }}>Cargando...</div>
          ) : pedidos.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
              <p style={{ fontSize: 40 }}>📦</p>
              <p>Aún no has realizado ningún pedido.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {pedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: "#888" }}>
                      {pedido.createdAt?.toDate
                        ? pedido.createdAt.toDate().toLocaleString("es-ES")
                        : "—"}
                    </span>
                    <span
                      style={{
                        fontSize: 12, fontWeight: 700,
                        color: pedido.estado === "pagado" ? "#059669" : "#d97706",
                        background: pedido.estado === "pagado" ? "#d1fae5" : "#fef3c7",
                        borderRadius: 6, padding: "2px 8px",
                      }}
                    >
                      {pedido.estado === "pagado" ? "✅ Pagado" : "⏳ Pendiente"}
                    </span>
                  </div>

                  {(pedido.items || []).map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 3 }}>
                      <span>{item.nombre} × {item.cantidad}</span>
                      <span>{formatPrecio(item.precio * item.cantidad)}</span>
                    </div>
                  ))}

                  <div
                    style={{
                      borderTop: "1px solid #f0f4ff",
                      marginTop: 8, paddingTop: 8,
                      display: "flex", justifyContent: "space-between",
                      fontWeight: 700, fontSize: 15,
                    }}
                  >
                    <span>Total a pagar</span>
                    <span style={{ color: "#2563eb" }}>{formatPrecio(pedido.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
