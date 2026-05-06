import React, { useEffect } from "react";
import EventSignupForm from "../components/EventSignupForm";

export default function FiestasDeSantiago() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <EventSignupForm
      eventType="fiestas"
      title="Inscripción — Fiestas de Santiago"
      defaultMonth={6}
    />
  );
}
