"use client";

import { useState, type FormEvent } from "react";

interface InquiryResponse {
  ok?: boolean;
  reservationId?: string;
  error?: string;
}

export function BookingInquiryForm({ grant }: { grant: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string>();
  const [reservationId, setReservationId] = useState<string>();

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setStatus("sending");
    setError(undefined);

    try {
      const response = await fetch("/api/booking/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant,
          guest: {
            firstName: formData.get("firstName"),
            lastName: formData.get("lastName"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            acceptedTerms: formData.get("acceptedTerms") === "yes",
          },
        }),
      });
      const result = await response.json() as InquiryResponse;
      if (!response.ok || !result.ok || !result.reservationId) {
        setStatus("error");
        setError(result.error || "We couldn’t send this request. Please try again.");
        return;
      }
      setReservationId(result.reservationId);
      setStatus("sent");
    } catch {
      setStatus("error");
      setError("We couldn’t send this request. No booking was created; please try again.");
    }
  }

  if (status === "sent") {
    return (
      <div className="booking-inquiry-success" role="status">
        <strong>Your stay request is in our system.</strong>
        <p>
          We placed it in Guesty for review and collected no payment. It is not a
          confirmed reservation until our team contacts you and approves it.
        </p>
        <small>Inquiry reference: {reservationId}</small>
      </div>
    );
  }

  return (
    <form className="booking-inquiry-form" onSubmit={submitInquiry}>
      <div className="booking-inquiry-intro">
        <strong>Request this stay</strong>
        <p>No payment is due now. Send your details and our team will review the request.</p>
      </div>
      <div className="booking-inquiry-name-grid">
        <label>
          <span>First name</span>
          <input name="firstName" autoComplete="given-name" required maxLength={80} />
        </label>
        <label>
          <span>Last name</span>
          <input name="lastName" autoComplete="family-name" required maxLength={80} />
        </label>
      </div>
      <label>
        <span>Email</span>
        <input type="email" name="email" autoComplete="email" required maxLength={254} />
      </label>
      <label>
        <span>Phone <em>optional</em></span>
        <input type="tel" name="phone" autoComplete="tel" maxLength={40} />
      </label>
      <label className="booking-inquiry-consent">
        <input type="checkbox" name="acceptedTerms" value="yes" required />
        <span>
          I understand this sends a booking request without payment. The reservation
          is not confirmed until Vacation Rental Expertz Florida approves it.
        </span>
      </label>
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending request…" : "Request to book — no payment"}
      </button>
      {error && <p className="booking-inquiry-error" role="alert">{error}</p>}
      <small>No card details are requested or stored on this website.</small>
    </form>
  );
}
