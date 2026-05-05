import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import EventSignupForm from "../components/EventSignupForm";

export default function Ferias() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "ferias"), (snap) => {
      setConfig(snap.exists() ? snap.data() : {});
    });
    return () => unsub();
  }, []);

  if (config === null) return <div className="centered">Cargando...</div>;

  return (
    <EventSignupForm
      key={config.fixedDate || "no-date-ferias"}
      eventType="ferias"
      title="Inscripción — Ferias"
      singleDay
      fixedDate={config.fixedDate}
      dateInfoText={config.dateInfoText}
      configKey="ferias"
    />
  );
}