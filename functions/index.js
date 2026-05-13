const { auth, pubsub, firestore: firestoreFn, https } = require("firebase-functions/v1");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// ─── Nodemailer transporter con Gmail ─────────────────────────────────────────
// Credenciales en functions/.env (GMAIL_EMAIL, GMAIL_PASSWORD)

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.GMAIL_EMAIL, pass: process.env.GMAIL_PASSWORD },
  });
}

async function sendMail(to, subject, html) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"La Toalla App" <${process.env.GMAIL_EMAIL}>`,
    to,
    subject,
    html,
  });
  console.log(`✉️ Email enviado a ${to}: ${subject}`);
}

function mailFooter() {
  return `
    <hr style="border:none;border-top:1px solid #e0e0e0;margin:28px 0 16px">
    <p style="color:#aaa;font-size:11px;margin:0">La Toalla App · by INA SYSTEM</p>
  `;
}

// ─── Helper: comprobar preferencias de email del usuario ─────────────────────
async function userWantsEmail(uid, prefKey) {
  try {
    const prefDoc = await admin.firestore().collection("userPreferences").doc(uid).get();
    if (!prefDoc.exists) return true; // sin doc → por defecto activo
    const prefs = prefDoc.data();
    if (!prefs._initialized) return true; // doc viejo sin flag → activo
    return prefs[prefKey] !== false; // false explícito = desactivado
  } catch {
    return true; // si falla la lectura, enviamos igualmente
  }
}

// ─── 1. EMAIL DE BIENVENIDA ────────────────────────────────────────────────────
// Se dispara cuando Firebase Auth crea un nuevo usuario
exports.onUserCreated = auth.user().onCreate(async (user) => {
  if (!user.email) return null;

  // Intentar obtener el perfil de Firestore (puede que aún no exista)
  let name = user.displayName || user.email.split("@")[0];
  try {
    // Esperar un momento por si el doc de Firestore aún no se ha creado
    await new Promise((r) => setTimeout(r, 2000));
    const userDoc = await admin.firestore().collection("users").doc(user.uid).get();
    if (userDoc.exists) {
      const d = userDoc.data();
      name =
        d.alias ||
        d.name ||
        `${d.firstName || ""} ${d.lastName || ""}`.trim() ||
        name;
    }
  } catch (e) {
    console.log("No se pudo obtener perfil de Firestore:", e.message);
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
      <div style="background:#6A8F3A;border-radius:12px 12px 0 0;padding:24px;text-align:center">
        <h1 style="color:white;margin:0;font-size:22px">¡Bienvenido/a a La Toalla! 🎉</h1>
      </div>
      <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:24px">
        <p style="font-size:16px">Hola <strong>${name}</strong>,</p>
        <p>Ya formas parte de La Toalla App. Aquí podrás:</p>
        <ul>
          <li>📋 Apuntarte a Fiestas de Juventud, Santiago y Ferias</li>
          <li>📅 Ver y unirte a Eventos Temporales</li>
          <li>🏭 Consultar el stock del almacén</li>
        </ul>
        <a href="https://latoallaapp-daf6c.web.app"
           style="display:inline-block;background:#6A8F3A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
          Abrir La Toalla App
        </a>
        ${mailFooter()}
      </div>
    </div>
  `;

  try {
    await sendMail(user.email, "¡Bienvenido/a a La Toalla App! 🎉", html);
  } catch (err) {
    console.error("Error enviando bienvenida:", err.message);
  }
  return null;
});

// ─── 2. NOTIFICACIÓN NUEVO EVENTO TEMPORAL ────────────────────────────────────
// Se dispara cuando se crea un doc en la colección "eventos"
exports.onNewEvento = firestoreFn
  .document("eventos/{eventoId}")
  .onCreate(async (snap) => {
    const evento = snap.data();
    if (!evento) return null;

    // Formatear fecha
    let dateStr = evento.fecha || "";
    try {
      const d = new Date(evento.fecha + "T12:00:00");
      dateStr = d.toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      // Capitalizar primera letra
      dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    } catch {}

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <div style="background:#6A8F3A;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">📅 Nuevo Evento</h1>
        </div>
        <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:24px">
          <h2 style="color:#243123;margin:0 0 8px">${evento.nombre}</h2>
          <p style="color:#6A8F3A;font-weight:bold;margin:0 0 12px">📆 ${dateStr}</p>
          ${evento.createdByName ? `<p style="color:#555;margin:0 0 12px">👤 Creado por: <strong>${evento.createdByName}</strong></p>` : ""}
          ${evento.descripcion ? `<p style="color:#555">${evento.descripcion}</p>` : ""}
          <p>¡Entra en la app para apuntarte!</p>
          <a href="https://latoallaapp-daf6c.web.app"
             style="display:inline-block;background:#6A8F3A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
            Apuntarme al evento
          </a>
          ${mailFooter()}
        </div>
      </div>
    `;

    const usersSnap = await admin.firestore().collection("users").get();
    let sent = 0;
    for (const userDoc of usersSnap.docs) {
      const email = userDoc.data().email;
      if (!email) continue;
      if (!(await userWantsEmail(userDoc.id, "eventosTemporales"))) continue;
      try {
        await sendMail(email, `📅 Nuevo evento: ${evento.nombre}`, html);
        sent++;
      } catch (err) {
        console.error(`Error enviando a ${email}:`, err.message);
      }
    }
    console.log(`Notificación de evento enviada a ${sent} usuarios.`);
    return null;
  });

// ─── 3. NOTICIA / AVISO A TODOS LOS USUARIOS ─────────────────────────────────
// Se dispara cuando se crea un doc en la colección "noticias"
exports.onNewNoticia = firestoreFn
  .document("noticias/{noticiaId}")
  .onCreate(async (snap) => {
    const noticia = snap.data();
    if (!noticia) return null;

    const categoryEmoji = {
      "General":          "📣",
      "Fiestas Juventud": "🎉",
      "Fiestas Santiago": "🎊",
      "Ferias":           "🎡",
      "Eventos":          "📅",
    }[noticia.category] || "📢";

    const imageBlock = noticia.imageUrl
      ? `<img src="${noticia.imageUrl}" alt="" style="max-width:100%;width:480px;border-radius:8px;margin:16px 0 0;display:block">`
      : "";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <div style="background:#6A8F3A;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px">
            ${categoryEmoji} ${noticia.category}
          </p>
          <h1 style="color:white;margin:0;font-size:20px">${noticia.title}</h1>
        </div>
        <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:24px">
          <p style="font-size:15px;color:#333;white-space:pre-wrap;line-height:1.6">${noticia.body}</p>
          ${imageBlock}
          <a href="https://latoallaapp-daf6c.web.app"
             style="display:inline-block;background:#6A8F3A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px">
            Abrir La Toalla App
          </a>
          ${mailFooter()}
        </div>
      </div>
    `;

    const usersSnap = await admin.firestore().collection("users").get();
    const emails = usersSnap.docs.map((d) => d.data().email).filter(Boolean);

    if (emails.length === 0) {
      console.log("No hay usuarios con email para notificar.");
      return null;
    }

    for (const email of emails) {
      try {
        await sendMail(email, `${categoryEmoji} ${noticia.title}`, html);
      } catch (err) {
        console.error(`Error enviando noticia a ${email}:`, err.message);
      }
    }

    console.log(`Noticia enviada a ${emails.length} usuarios.`);
    return null;
  });

// ─── 4. FECHA FIESTAS DE LA JUVENTUD ─────────────────────────────────────────
// Se dispara cuando se guarda/actualiza config/juventud con notifyUsers=true
exports.onJuventudFechaFijada = firestoreFn
  .document("config/juventud")
  .onWrite(async (change) => {
    const data = change.after.exists ? change.after.data() : null;
    if (!data || !data.notifyUsers) return null;

    const fechaTexto = data.dateInfoText || data.fixedDate || "próximamente";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <div style="background:#6A8F3A;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">🎉 Fiestas de la Juventud</h1>
        </div>
        <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:24px">
          <p style="font-size:16px;color:#333">Ya está fijada la fecha de las <strong>Fiestas de la Juventud</strong>:</p>
          <div style="background:rgba(106,143,58,0.10);border:1.5px solid rgba(106,143,58,0.25);border-radius:12px;padding:16px;text-align:center;margin:16px 0">
            <div style="font-size:13px;color:#666;margin-bottom:4px">📅 Fecha del evento</div>
            <div style="font-size:20px;font-weight:700;color:#4a7a1e">${fechaTexto}</div>
          </div>
          <p style="color:#555">¡Ya puedes apuntarte desde la app!</p>
          <a href="https://latoallaapp-daf6c.web.app"
             style="display:inline-block;background:#6A8F3A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
            Apuntarme a las Fiestas
          </a>
          ${mailFooter()}
        </div>
      </div>
    `;

    const usersSnap = await admin.firestore().collection("users").get();
    let sent = 0;
    for (const userDoc of usersSnap.docs) {
      const email = userDoc.data().email;
      if (!email) continue;
      if (!(await userWantsEmail(userDoc.id, "fiestasJuventud"))) continue;
      try {
        await sendMail(email, `🎉 Fiestas de la Juventud — ${fechaTexto}`, html);
        sent++;
      } catch (err) {
        console.error(`Error enviando a ${email}:`, err.message);
      }
    }
    console.log(`Notificación Juventud enviada a ${sent} usuarios.`);

    // Limpiar la bandera para no reenviar en el siguiente save
    try {
      await change.after.ref.update({ notifyUsers: false });
    } catch (e) {
      console.error("Error limpiando notifyUsers:", e.message);
    }

    return null;
  });

// ─── 5. FECHA FERIAS ──────────────────────────────────────────────────────────
// Se dispara cuando se guarda/actualiza config/ferias con notifyUsers=true
exports.onFeriasFechaFijada = firestoreFn
  .document("config/ferias")
  .onWrite(async (change) => {
    const data = change.after.exists ? change.after.data() : null;
    if (!data || !data.notifyUsers) return null;

    const fechaTexto = data.dateInfoText || data.fixedDate || "próximamente";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <div style="background:#6A8F3A;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">🎡 Ferias</h1>
        </div>
        <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:24px">
          <p style="font-size:16px;color:#333">Ya está fijada la fecha de las <strong>Ferias</strong>:</p>
          <div style="background:rgba(106,143,58,0.10);border:1.5px solid rgba(106,143,58,0.25);border-radius:12px;padding:16px;text-align:center;margin:16px 0">
            <div style="font-size:13px;color:#666;margin-bottom:4px">📅 Fecha del evento</div>
            <div style="font-size:20px;font-weight:700;color:#4a7a1e">${fechaTexto}</div>
          </div>
          <p style="color:#555">¡Ya puedes apuntarte desde la app!</p>
          <a href="https://latoallaapp-daf6c.web.app"
             style="display:inline-block;background:#6A8F3A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
            Apuntarme a las Ferias
          </a>
          ${mailFooter()}
        </div>
      </div>
    `;

    const usersSnap = await admin.firestore().collection("users").get();
    let sent = 0;
    for (const userDoc of usersSnap.docs) {
      const email = userDoc.data().email;
      if (!email) continue;
      if (!(await userWantsEmail(userDoc.id, "ferias"))) continue;
      try {
        await sendMail(email, `🎡 Ferias — ${fechaTexto}`, html);
        sent++;
      } catch (err) {
        console.error(`Error enviando a ${email}:`, err.message);
      }
    }
    console.log(`Notificación Ferias enviada a ${sent} usuarios.`);

    try {
      await change.after.ref.update({ notifyUsers: false });
    } catch (e) {
      console.error("Error limpiando notifyUsers (ferias):", e.message);
    }

    return null;
  });

// ─── 6. CANDIDATO AL COHETE ───────────────────────────────────────────────────
// Se dispara cuando alguien es propuesto como candidato en "cohete_candidatos"
exports.onNewCandidatoCohete = firestoreFn
  .document("cohete_candidatos/{candidatoId}")
  .onCreate(async (snap) => {
    const candidato = snap.data();
    if (!candidato || !candidato.candidateUid) return null;

    const year = new Date().getFullYear();

    // Obtener los datos del candidato desde Firestore
    const userDoc = await admin.firestore().collection("users").doc(candidato.candidateUid).get();
    if (!userDoc.exists) {
      console.log("Usuario candidato no encontrado en Firestore.");
      return null;
    }

    const userData = userDoc.data();
    if (!userData.email) {
      console.log("El candidato no tiene email registrado.");
      return null;
    }

    const nombre =
      userData.alias ||
      userData.name ||
      `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
      "amigo/a";

    const proposedBy = candidato.proposedByName || "alguien del grupo";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <div style="background:#1a1a2e;border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
          <div style="font-size:56px;margin-bottom:12px">🚀</div>
          <h1 style="color:white;margin:0;font-size:22px;letter-spacing:1px;text-transform:uppercase">
            ¡Has sido elegido candidato!
          </h1>
          <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;letter-spacing:0.5px">
            Fiestas de Santiago ${year}
          </p>
        </div>
        <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:28px;text-align:center">
          <p style="font-size:17px;color:#243123;margin:0 0 12px">
            Hola <strong>${nombre}</strong>,
          </p>
          <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 12px">
            <strong>${proposedBy}</strong> te ha propuesto como candidato para
            <strong>tirar el cohete en las Fiestas de Santiago ${year}</strong>. 🎆
          </p>
          <p style="font-size:14px;color:#888;font-style:italic;margin:0 0 8px">
            Motivo: "${candidato.motivo}"
          </p>
          <p style="font-size:15px;color:#555;margin:16px 0">
            El resto de los socios están votando. ¿Ganarás tú?
          </p>
          <a href="https://latoallaapp-daf6c.web.app"
             style="display:inline-block;background:#1a1a2e;color:white;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:4px;font-size:15px">
            Ver votación 🚀
          </a>
          ${mailFooter()}
        </div>
      </div>
    `;

    if (!(await userWantsEmail(candidato.candidateUid, "cohete"))) {
      console.log(`El candidato ${candidato.candidateUid} tiene desactivado el email de cohete.`);
      return null;
    }

    try {
      await sendMail(
        userData.email,
        `🚀 ¡Eres candidato para tirar el cohete! Fiestas ${year}`,
        html
      );
      console.log(`Email de candidato enviado a ${userData.email}`);
    } catch (err) {
      console.error(`Error enviando email de candidato: ${err.message}`);
    }

    return null;
  });

// ─── 4. FELICITACIÓN DE CUMPLEAÑOS ────────────────────────────────────────────
exports.checkBirthdays = pubsub
  .schedule("0 9 * * *")
  .timeZone("Europe/Madrid")
  .onRun(async () => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayMMDD = `${month}-${day}`;

    const usersSnap = await admin.firestore().collection("users").get();
    let sent = 0;

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      if (!data.email || !data.fechaNac) continue;

      // fechaNac guardado como YYYY-MM-DD → extraer MM-DD
      const birthMMDD = data.fechaNac.slice(5);
      if (birthMMDD !== todayMMDD) continue;

      const name =
        data.alias ||
        data.name ||
        `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
        "amigo/a";

      const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
          <div style="background:#6A8F3A;border-radius:12px 12px 0 0;padding:24px;text-align:center">
            <h1 style="color:white;margin:0;font-size:26px">🎂 ¡Feliz Cumpleaños!</h1>
          </div>
          <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:24px;text-align:center">
            <p style="font-size:18px">Hola <strong>${name}</strong> 🎉</p>
            <p style="font-size:15px;color:#555">
              Todo el equipo de La Toalla te desea un día increíble.<br>
              ¡Que lo pases genial! 🥳🎊
            </p>
            <a href="https://latoallaapp-daf6c.web.app"
               style="display:inline-block;background:#6A8F3A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
              Abrir La Toalla App
            </a>
            ${mailFooter()}
          </div>
        </div>
      `;

      try {
        await sendMail(data.email, `🎂 ¡Feliz Cumpleaños, ${name}!`, html);
        sent++;
      } catch (err) {
        console.error(`Error enviando cumpleaños a ${data.email}:`, err.message);
      }
    }

    console.log(`Cumpleaños: ${sent} emails enviados para ${todayMMDD}.`);
    return null;
  });

// ─── 6. FELICES FIESTAS DE SANTIAGO — 25 de julio a las 12:00 ────────────────
exports.felicesFiestasSantiago = pubsub
  .schedule("0 10 25 7 *")   // 10:00 UTC = 12:00 hora España (CEST verano)
  .timeZone("UTC")
  .onRun(async () => {
    const year = new Date().getFullYear();

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <div style="background:linear-gradient(135deg,#8B0000,#C0392B);border-radius:12px 12px 0 0;padding:32px 24px;text-align:center">
          <div style="font-size:52px;margin-bottom:10px">🎆🎇🎆</div>
          <h1 style="color:white;margin:0;font-size:24px;letter-spacing:1px">
            ¡FELICES FIESTAS!
          </h1>
          <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:15px;font-weight:700;letter-spacing:0.5px">
            Santiago ${year}
          </p>
        </div>
        <div style="background:#fffaf5;border:1px solid #f0d8cc;border-radius:0 0 12px 12px;padding:32px 28px;text-align:center">
          <p style="font-size:22px;font-weight:900;color:#8B0000;margin:0 0 12px;letter-spacing:1px;line-height:1.4">
            🏔️ VÍA SANTIAGO<br>
            🙏 VÍA SOTORRAÑA<br>
            🎉 GORA GARES!!<br>
            🎊 ¡¡VIVA PUENTE!!
          </p>
          <p style="font-size:14px;color:#888;margin:20px 0 0">
            Con todo el cariño de La Toalla · ${year}
          </p>
          <a href="https://latoallaapp-daf6c.web.app"
             style="display:inline-block;background:#8B0000;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;font-size:15px">
            Abrir La Toalla App 🚀
          </a>
          ${mailFooter()}
        </div>
      </div>
    `;

    const usersSnap = await admin.firestore().collection("users").get();
    let sent = 0;
    for (const userDoc of usersSnap.docs) {
      const email = userDoc.data().email;
      if (!email) continue;
      if (!(await userWantsEmail(userDoc.id, "fiestasSantiago"))) continue;
      try {
        await sendMail(email, `🎆 ¡Felices Fiestas de Santiago ${year}! · VÍA SANTIAGO · GORA GARES!!`, html);
        sent++;
      } catch (err) {
        console.error(`Error enviando felicitación a ${email}:`, err.message);
      }
    }
    console.log(`Felicitación Fiestas Santiago ${year} enviada a ${sent} usuarios.`);
    return null;
  });

// 7. archivarCoheteAnual — 1 de enero 00:00 UTC: guarda ganadores en histórico y limpia candidatos
exports.archivarCoheteAnual = pubsub
  .schedule("0 0 1 1 *")
  .timeZone("UTC")
  .onRun(async () => {
    const prevYear = new Date().getFullYear() - 1;

    const snap = await admin.firestore().collection("cohete_candidatos").get();
    if (snap.empty) {
      console.log(`No hay candidatos para archivar (año ${prevYear}).`);
      return null;
    }

    const candidatos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const maxVotes = Math.max(...candidatos.map((c) => (c.votes || []).length));
    const winners = maxVotes > 0
      ? candidatos.filter((c) => (c.votes || []).length === maxVotes)
      : [];

    await admin.firestore().collection("cohete_historico").doc(String(prevYear)).set({
      year: prevYear,
      winners: winners.map((w) => ({
        nombre: w.nombre,
        candidateUid: w.candidateUid || null,
        votes: (w.votes || []).length,
      })),
      isTie: winners.length > 1,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Borrar todos los candidatos del año anterior
    const batch = admin.firestore().batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    console.log(`Cohete ${prevYear} archivado. Ganadores: ${winners.map((w) => w.nombre).join(", ") || "ninguno"}`);
    return null;
  });

// ─── 8. BORRAR USUARIO (Auth + Firestore) ────────────────────────────────────
// Callable function — solo admins pueden llamarla (verificado por Firestore admins/{uid})
exports.deleteUserAccount = https.onCall(async (data, context) => {
  // Verificar que quien llama está autenticado
  if (!context.auth) {
    throw new https.HttpsError("unauthenticated", "Debes estar autenticado.");
  }

  // Verificar que es admin consultando Firestore
  const callerAdminDoc = await admin.firestore().collection("admins").doc(context.auth.uid).get();
  if (!callerAdminDoc.exists) {
    throw new https.HttpsError("permission-denied", "Solo los administradores pueden borrar usuarios.");
  }

  const { uid } = data;
  if (!uid || typeof uid !== "string") {
    throw new https.HttpsError("invalid-argument", "Se requiere un UID válido.");
  }

  // Borrar de Firebase Auth (si ya no existe, ignorar)
  try {
    await admin.auth().deleteUser(uid);
  } catch (e) {
    if (e.code !== "auth/user-not-found") throw e;
    console.log(`Usuario ${uid} ya no existía en Auth, borrando solo Firestore.`);
  }

  // Borrar documento de Firestore
  await admin.firestore().collection("users").doc(uid).delete();

  console.log(`Usuario ${uid} eliminado por admin ${context.auth.uid}`);
  return { success: true };
});

// ─── 9. NOTIFICACIÓN DE SUGERENCIA AL ADMIN ───────────────────────────────────
exports.onNewSugerencia = firestoreFn
  .document("sugerencias/{sugerenciaId}")
  .onCreate(async (snap) => {
    const data = snap.data();
    if (!data) return null;

    const texto = data.texto || "";
    const email = data.email || "Anónimo";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <div style="background:#6A8F3A;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:20px">✉️ Nueva sugerencia</h1>
        </div>
        <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:24px">
          <p style="font-size:14px;color:#555;margin:0 0 8px">
            <strong>De:</strong> ${email}
          </p>
          <div style="background:#fff;border:1.5px solid #e0edcc;border-radius:8px;padding:14px;font-size:15px;color:#243123;line-height:1.6;white-space:pre-wrap">
            ${texto}
          </div>
          ${mailFooter()}
        </div>
      </div>
    `;

    try {
      await sendMail("inaviciba@gmail.com", `✉️ Nueva sugerencia de ${email}`, html);
      console.log(`Sugerencia de ${email} enviada al admin.`);
    } catch (err) {
      console.error("Error enviando sugerencia al admin:", err.message);
    }

    return null;
  });

// ─── 10. NOTIFICACIÓN DE NUEVA INSCRIPCIÓN ────────────────────────────────────
// Se dispara cuando alguien se apunta a cualquier evento (fiestas_signups)
exports.onNewSignup = firestoreFn
  .document("fiestas_signups/{signupId}")
  .onCreate(async (snap) => {
    const signup = snap.data();
    if (!signup) return null;

    // Nombre de quien se apunta
    const personName = signup.name || signup.email || "Alguien";

    // Determinar el nombre legible del evento
    const eventTypeMap = {
      juventud: "Fiestas de la Juventud 🎉",
      santiago: "Fiestas de Santiago 🎊",
      ferias:   "Ferias 🎡",
    };

    let eventLabel = eventTypeMap[signup.eventType] || null;

    // Si es un evento temporal (evento_<id>), buscarlo en Firestore
    if (!eventLabel && signup.eventType && signup.eventType.startsWith("evento_")) {
      const eventoId = signup.eventType.replace("evento_", "");
      try {
        const eventoDoc = await admin.firestore().collection("eventos").doc(eventoId).get();
        if (eventoDoc.exists) {
          const ev = eventoDoc.data();
          eventLabel = `${ev.nombre || "Evento temporal"} 📅`;
        }
      } catch {}
    }
    if (!eventLabel) eventLabel = signup.eventType || "Evento";

    // Formatear fecha
    let dateStr = signup.date || "";
    try {
      const d = new Date(signup.date + "T12:00:00");
      dateStr = d.toLocaleDateString("es-ES", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      });
      dateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    } catch {}

    // Construir detalle de comidas
    const comidas = [
      signup.almuerzo && "Almuerzo",
      signup.comida   && "Comida",
      signup.cena     && "Cena",
    ].filter(Boolean);
    const comidasStr = comidas.length > 0 ? comidas.join(", ") : "—";

    // Personas
    const adults   = Number(signup.adults   || 0);
    const children = Number(signup.children || 0);
    const personasStr = [
      adults   > 0 && `${adults} adulto${adults   !== 1 ? "s" : ""}`,
      children > 0 && `${children} niño${children !== 1 ? "s" : ""}`,
    ].filter(Boolean).join(" + ") || "1 persona";

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <div style="background:#6A8F3A;border-radius:12px 12px 0 0;padding:24px;text-align:center">
          <h1 style="color:white;margin:0;font-size:22px">📋 Nueva inscripción</h1>
        </div>
        <div style="background:#f9fdf5;border:1px solid #e0edcc;border-radius:0 0 12px 12px;padding:24px">
          <p style="font-size:16px;color:#333;margin:0 0 16px">
            <strong>${personName}</strong> se ha apuntado a:
          </p>
          <div style="background:rgba(106,143,58,0.10);border:1.5px solid rgba(106,143,58,0.25);border-radius:12px;padding:16px;margin:0 0 16px">
            <div style="font-size:18px;font-weight:700;color:#4a7a1e;margin-bottom:8px">${eventLabel}</div>
            <div style="font-size:14px;color:#555">📆 ${dateStr}</div>
            <div style="font-size:14px;color:#555;margin-top:4px">🍽️ ${comidasStr}</div>
            <div style="font-size:14px;color:#555;margin-top:4px">👥 ${personasStr}</div>
          </div>
          <a href="https://latoallaapp-daf6c.web.app"
             style="display:inline-block;background:#6A8F3A;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:4px">
            Ver en La Toalla App
          </a>
          ${mailFooter()}
        </div>
      </div>
    `;

    const subject = `📋 ${personName} se ha apuntado a ${eventLabel}`;

    // Obtener todos los usuarios con email
    const usersSnap = await admin.firestore().collection("users").get();
    const emails = usersSnap.docs.map((d) => d.data().email).filter(Boolean);

    if (emails.length === 0) {
      console.log("No hay usuarios con email para notificar (nueva inscripción).");
      return null;
    }

    for (const email of emails) {
      try {
        await sendMail(email, subject, html);
      } catch (err) {
        console.error(`Error enviando notificación de inscripción a ${email}:`, err.message);
      }
    }

    console.log(`Inscripción de ${personName} en "${eventLabel}" notificada a ${emails.length} usuarios.`);
    return null;
  });
