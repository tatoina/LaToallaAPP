import React from "react";
import EventSignupForm from "../components/EventSignupForm";

export default function FiestasDeSantiago() {
  return (
    <EventSignupForm
      eventType="fiestas"
      title="Inscripción — Fiestas de Santiago"
      defaultMonth={6}
    />
  );
}
