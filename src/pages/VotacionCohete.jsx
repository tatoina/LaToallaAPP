import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, deleteDoc, doc, setDoc, arrayUnion, arrayRemove, serverTimestamp,
} from "firebase/firestore";

// Histórico fijo — se fusiona con los datos de Firestore (Firestore tiene prioridad)
const HISTORICO_FIJO = [
  { year: 2025, winners: [{ nombre: "Iosu", motivo: "Por cantar tan bien en la coral y en la vida", votes: null }], isTie: false, _fijo: true },
];

// El cohete es el 25 de julio → votación cierra 7 días antes (18 de julio)
function getDeadline() {
  const year = new Date().getFullYear();
  return new Date(year, 6, 18, 23, 59, 59); // mes 6 = julio (0-indexed)
}

function getCoheteDate() {
  const year = new Date().getFullYear();
  return new Date(year, 6, 25); // 25 de julio
}

function useCountdown(target) {
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining(Math.max(0, target - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, [target]);

  const totalSecs = Math.floor(remaining / 1000);
  const days    = Math.floor(totalSecs / 86400);
  const hours   = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  return { days, hours, minutes, seconds, expired: remaining === 0 };
}

function pad(n) { return String(n).padStart(2, "0"); }

export default function VotacionCohete() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [candidatos, setCandidatos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ usuarioUid: "", motivo: "" });
  const [saving, setSaving] = useState(false);
  const [voting, setVoting] = useState(null);
  const [commentInputs, setCommentInputs] = useState({}); // { [candidatoId]: texto }
  const [openComment, setOpenComment] = useState(null);   // candidatoId con input abierto
  const [sendingComment, setSendingComment] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  const deadline = getDeadline().getTime();
  const coheteDate = getCoheteDate();
  const year = coheteDate.getFullYear();
  const { days, hours, minutes, seconds, expired: votingClosed } = useCountdown(deadline);

  useEffect(() => {
    const q = query(collection(db, "cohete_candidatos"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setCandidatos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "cohete_historico"), orderBy("year", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const firestoreData = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Fusionar: Firestore sobreescribe entradas con el mismo año
      const firestoreYears = new Set(firestoreData.map((h) => h.year));
      const merged = [
        ...firestoreData,
        ...HISTORICO_FIJO.filter((h) => !firestoreYears.has(h.year)),
      ].sort((a, b) => b.year - a.year);
      setHistorico(merged);
    });
    return () => unsub();
  }, []);

  const getAlias = (u) =>
    u.alias ||
    u.name ||
    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
    u.email ||
    u.id;

  // Candidato al que ha votado este usuario (solo 1)
  const myVotedId = candidatos.find((c) => (c.votes || []).includes(user.uid))?.id || null;

  // UIDs que ya son candidatos (para no repetir)
  const candidateUids = new Set(candidatos.map((c) => c.candidateUid).filter(Boolean));
  const usuariosDisponibles = usuarios.filter((u) => !candidateUids.has(u.id));

  const onPropose = async () => {
    if (!form.usuarioUid || !form.motivo.trim()) return;
    const selectedUser = usuarios.find((u) => u.id === form.usuarioUid);
    if (!selectedUser) return;
    setSaving(true);
    try {
      const proposerName = getAlias(
        usuarios.find((u) => u.id === user.uid) || { email: user.email }
      );
      await addDoc(collection(db, "cohete_candidatos"), {
        candidateUid: selectedUser.id,
        nombre: getAlias(selectedUser),
        motivo: form.motivo.trim(),
        proposedByUid: user.uid,
        proposedByName: proposerName,
        votes: [],
        year,
        createdAt: serverTimestamp(),
      });
      setForm({ usuarioUid: "", motivo: "" });
      setShowForm(false);
    } catch (e) {
      alert("Error al proponer: " + e.message);
    }
    setSaving(false);
  };

  const onDeleteCandidatura = async (candidato) => {
    if ((candidato.votes?.length || 0) > 0) return;
    if (!window.confirm("¿Seguro que quieres retirar tu candidatura?")) return;
    try {
      await deleteDoc(doc(db, "cohete_candidatos", candidato.id));
    } catch (e) {
      alert("Error al borrar: " + e.message);
    }
  };

  const onAddComment = async (candidato) => {
    const texto = (commentInputs[candidato.id] || "").trim();
    if (!texto) return;
    setSendingComment(candidato.id);
    try {
      const autorNombre = getAlias(
        usuarios.find((u) => u.id === user.uid) || { email: user.email }
      );
      const nuevoComentario = {
        texto,
        autorUid: user.uid,
        autorNombre,
        ts: Date.now(),
      };
      await updateDoc(doc(db, "cohete_candidatos", candidato.id), {
        comentarios: arrayUnion(nuevoComentario),
      });
      setCommentInputs((p) => ({ ...p, [candidato.id]: "" }));
      setOpenComment(null);
    } catch (e) {
      alert("Error al comentar: " + e.message);
    }
    setSendingComment(null);
  };

  const onVote = async (candidato) => {
    if (votingClosed) return;
    setVoting(candidato.id);
    try {
      const alreadyVotingThis = myVotedId === candidato.id;

      // Quitar voto del candidato anterior si existe y es distinto
      if (myVotedId && myVotedId !== candidato.id) {
        await updateDoc(doc(db, "cohete_candidatos", myVotedId), {
          votes: arrayRemove(user.uid),
        });
      }

      // Añadir o quitar en el candidato pulsado
      await updateDoc(doc(db, "cohete_candidatos", candidato.id), {
        votes: alreadyVotingThis ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (e) {
      alert("Error al votar: " + e.message);
    }
    setVoting(null);
  };

  // Ordenar por votos descendente
  const sorted = [...candidatos].sort(
    (a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)
  );
  const maxVotes = sorted[0]?.votes?.length || 0;
  const winners = votingClosed && maxVotes > 0
    ? sorted.filter((c) => (c.votes?.length || 0) === maxVotes)
    : [];
  const isTie = winners.length > 1;

  // Auto-guardar ganador en Firestore al cerrar la votación
  useEffect(() => {
    if (!votingClosed || candidatos.length === 0) return;
    const maxV = Math.max(...candidatos.map((c) => c.votes?.length || 0), 0);
    if (maxV === 0) return;
    // Solo guardar si aún no hay entrada de Firestore para este año
    const alreadySaved = historico.some((h) => h.year === year && !h._fijo);
    if (alreadySaved) return;
    const win = candidatos.filter((c) => (c.votes?.length || 0) === maxV);
    const tie = win.length > 1;
    setDoc(doc(db, "cohete_historico", String(year)), {
      year,
      isTie: tie,
      winners: win.map((w) => ({
        nombre: w.nombre,
        motivo: w.motivo || "",
        votes: maxV,
      })),
      savedAt: serverTimestamp(),
    }).catch(console.error);
  }, [votingClosed, candidatos, historico, year]);

  return (
    <div className="cohete-page">
      {/* Cabecera */}
      <div className="page-header">
        <h2 className="page-header-title">🚀 ¿Quién tirará el cohete?</h2>
        <p className="page-header-subtitle">Fiestas de Santiago {year}</p>
      </div>

      {/* Countdown / Banner ganador */}
      {!votingClosed ? (
        <div className="cohete-countdown-card">
          <p className="cohete-countdown-label">⏳ Cierra en</p>
          <div className="cohete-countdown-digits">
            <div className="cohete-digit-block">
              <span className="cohete-digit">{days}</span>
              <span className="cohete-digit-unit">d</span>
            </div>
            <span className="cohete-digit-sep">:</span>
            <div className="cohete-digit-block">
              <span className="cohete-digit">{pad(hours)}</span>
              <span className="cohete-digit-unit">h</span>
            </div>
            <span className="cohete-digit-sep">:</span>
            <div className="cohete-digit-block">
              <span className="cohete-digit">{pad(minutes)}</span>
              <span className="cohete-digit-unit">m</span>
            </div>
            <span className="cohete-digit-sep">:</span>
            <div className="cohete-digit-block">
              <span className="cohete-digit">{pad(seconds)}</span>
              <span className="cohete-digit-unit">s</span>
            </div>
          </div>
          <p className="cohete-countdown-sub">🎆 25 jul {year}</p>
        </div>
      ) : (
        <div className="cohete-winner-card">
          <div className="cohete-winner-fireworks">🎆🚀🎆</div>
          <p className="cohete-winner-label">
            {isTie ? `¡EMPATE! LANZAN EL COHETE ${year}` : `LANZADOR DEL COHETE ${year}`}
          </p>
          {winners.length === 0 ? (
            <p className="cohete-winner-name">—</p>
          ) : isTie ? (
            winners.map((w) => (
              <p key={w.id} className="cohete-winner-name" style={{ fontSize: 24, margin: "4px 0" }}>
                🚀 {w.nombre}
              </p>
            ))
          ) : (
            <p className="cohete-winner-name">{winners[0].nombre}</p>
          )}
          <p className="cohete-winner-sub">
            con {maxVotes} voto{maxVotes !== 1 ? "s" : ""} · 25 de julio de {year}
          </p>
        </div>
      )}

      {/* Acciones: proponer + estado de mi voto */}
      {!votingClosed && (
        <div className="cohete-stats-bar">
          <div className="cohete-votes-used">
            <span className={`cohete-dot${myVotedId ? " used" : ""}`} />
            <span className="cohete-votes-label">
              {myVotedId ? "Tu voto: puedes cambiarlo" : "Sin votar aún"}
            </span>
          </div>
          <div className="cohete-propose-area">
            <button
              className={`cohete-propose-btn${showForm ? " active" : ""}`}
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "✕ Cancelar" : "+ Proponer Candidato"}
            </button>
            <div className="cohete-info-wrap">
              <button
                className="cohete-info-btn"
                onClick={() => setShowInfo((v) => !v)}
                title="Información"
              >
                ?
              </button>
              {showInfo && (
                <div className="cohete-info-tooltip">
                  Solo se pueden votar y proponer como candidatos los usuarios dados de alta en la app.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Formulario proponer candidato */}
      {!votingClosed && showForm && (
        <div className="cohete-form-card">
          <h3 className="cohete-form-title">Proponer candidato</h3>
          {usuariosDisponibles.length === 0 ? (
            <p style={{ fontSize: 13, color: "#888", margin: 0 }}>
              Todos los usuarios ya son candidatos.
            </p>
          ) : (
            <>
              <select
                className="cohete-select"
                value={form.usuarioUid}
                onChange={(e) => setForm((p) => ({ ...p, usuarioUid: e.target.value }))}
              >
                <option value="">— Selecciona un usuario —</option>
                {usuariosDisponibles.map((u) => (
                  <option key={u.id} value={u.id}>{getAlias(u)}</option>
                ))}
              </select>
              <textarea
                className="cohete-textarea"
                placeholder="¿Por qué merece tirar el cohete?"
                value={form.motivo}
                onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))}
                rows={3}
              />
              <button
                className="btn"
                onClick={onPropose}
                disabled={saving || !form.usuarioUid || !form.motivo.trim()}
              >
                {saving ? "Proponiendo..." : "🎯 Proponer candidato"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Lista de candidatos */}
      {sorted.length === 0 ? (
        <div className="cohete-empty">
          <p>🎆 Aún no hay candidatos.</p>
          {!votingClosed && <p>¡Sé el primero en proponer uno!</p>}
        </div>
      ) : (
        <div className="cohete-list">
          {sorted.map((c, i) => {
            const hasVoted = (c.votes || []).includes(user.uid);
            const voteCount = c.votes?.length || 0;
            const pct = maxVotes > 0 ? Math.round((voteCount / maxVotes) * 100) : 0;
            const isLeader = i === 0 && voteCount > 0;
            const isWinner = votingClosed && winners.some((w) => w.id === c.id);

            return (
              <div
                key={c.id}
                className={`cohete-card${isLeader ? " cohete-card--leader" : ""}${isWinner ? " cohete-card--winner" : ""}`}
              >
                <div className="cohete-card-top">
                  <div className="cohete-rank">
                    {isWinner ? "🏆" : isLeader ? "👑" : `#${i + 1}`}
                  </div>
                  <div className="cohete-card-info">
                    <span className="cohete-nombre">{c.nombre}</span>
                    <span className="cohete-propuesto">
                      Propuesto por {c.proposedByName}
                    </span>
                    <span className="cohete-motivo">"{c.motivo}"</span>
                  </div>
                  {/* Botón borrar candidatura: solo quien la propuso, sin votos, votación abierta */}
                  {!votingClosed && c.proposedByUid === user.uid && (c.votes?.length || 0) === 0 && (
                    <button
                      className="cohete-delete-btn"
                      onClick={() => onDeleteCandidatura(c)}
                      title="Retirar mi candidatura"
                    >
                      🗑️
                    </button>
                  )}
                  {/* Botón de voto: solo visible si votación abierta */}
                  {!votingClosed && (
                    <button
                      className={`cohete-vote-btn${hasVoted ? " voted" : ""}${
                        myVotedId && myVotedId !== c.id && !hasVoted ? " switch" : ""
                      }`}
                      onClick={() => onVote(c)}
                      disabled={voting === c.id}
                      title={hasVoted ? "Quitar voto" : myVotedId ? "Cambiar mi voto a este" : "Votar"}
                    >
                      <span className="cohete-vote-icon">
                        {voting === c.id ? "⏳" : hasVoted ? "✓" : "▲"}
                      </span>
                      <span className="cohete-vote-count">{voteCount}</span>
                    </button>
                  )}
                  {/* Solo número de votos si votación cerrada */}
                  {votingClosed && (
                    <div className="cohete-vote-count-closed">{voteCount} 🗳️</div>
                  )}
                </div>
                <div className="cohete-bar-bg">
                  <div className="cohete-bar-fill" style={{ width: `${pct}%` }} />
                </div>

                {/* Comentarios */}
                {(c.comentarios || []).length > 0 && (
                  <div className="cohete-comentarios">
                    {[...(c.comentarios || [])]
                      .sort((a, b) => a.ts - b.ts)
                      .map((cm, ci) => (
                        <div key={ci} className="cohete-comentario">
                          <span className="cohete-comentario-autor">{cm.autorNombre}</span>
                          <span className="cohete-comentario-texto">{cm.texto}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Input nuevo comentario */}
                {openComment === c.id ? (
                  <div className="cohete-comment-form">
                    <textarea
                      className="cohete-comment-input"
                      placeholder="¿Por qué merece tirarlo?"
                      rows={2}
                      value={commentInputs[c.id] || ""}
                      onChange={(e) =>
                        setCommentInputs((p) => ({ ...p, [c.id]: e.target.value }))
                      }
                      autoFocus
                    />
                    <div className="cohete-comment-actions">
                      <button
                        className="cohete-comment-send"
                        onClick={() => onAddComment(c)}
                        disabled={sendingComment === c.id || !(commentInputs[c.id] || "").trim()}
                      >
                        {sendingComment === c.id ? "⏳" : "📨 Enviar"}
                      </button>
                      <button
                        className="cohete-comment-cancel"
                        onClick={() => setOpenComment(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="cohete-comment-toggle"
                    onClick={() => setOpenComment(c.id)}
                  >
                    💬 Comentar
                    {(c.comentarios || []).length > 0 &&
                      ` · ${c.comentarios.length}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Histórico de cohetes */}
      {historico.length > 0 && (

        <div className="cohete-historico">
          <h3 className="cohete-historico-title">🏅 Histórico de lanzadores</h3>
          {historico.map((h) => (
            <div key={h.id} className="cohete-historico-card">
              <span className="cohete-historico-year">{h.year}</span>
              <div className="cohete-historico-winners">
                {(h.winners || []).length === 0 ? (
                  <span className="cohete-historico-winner">Sin datos</span>
                ) : (
                  (h.winners || []).map((w, i) => (
                    <div key={i} className="cohete-historico-winner-row">
                      <span className="cohete-historico-winner">
                        {h.isTie ? "🚀" : "🏆"} {w.nombre}
                      </span>
                      {w.motivo ? (
                        <span className="cohete-historico-motivo">"{w.motivo}"</span>
                      ) : null}
                    </div>
                  ))
                )}
                {(h.winners || []).length > 0 && h.winners[0].votes !== null && (
                  <span className="cohete-historico-votes">
                    {h.winners[0].votes} voto{h.winners[0].votes !== 1 ? "s" : ""}
                    {h.isTie ? " (empate)" : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="page-bottom-nav">
        <button className="nav-bottom-btn" onClick={() => navigate("/")}>← Inicio</button>
      </div>
    </div>
  );
}

