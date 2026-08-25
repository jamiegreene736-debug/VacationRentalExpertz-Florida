"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  CONTACT_TOPICS,
  type ContactFieldErrors,
  type ContactFormValues,
} from "../../lib/contact-form";
import { RESERVATIONS_PHONE_DISPLAY, RESERVATIONS_PHONE_HREF } from "../../lib/contact";

type SubmissionState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

function ErrorMessage({ message }: { message?: string }) {
  return message ? <small className="contact-field-error">{message}</small> : null;
}

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now().toString());
  const [submission, setSubmission] = useState<SubmissionState>({ status: "idle" });
  const [errors, setErrors] = useState<ContactFieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmission({ status: "submitting" });
    setErrors({});

    const formData = new FormData(event.currentTarget);
    const values = Object.fromEntries(formData.entries()) as ContactFormValues;

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        errors?: ContactFieldErrors;
      };

      if (!response.ok || !result.ok) {
        setErrors(result.errors || {});
        setSubmission({
          status: "error",
          message: result.message || "We could not send your message. Please try again.",
        });
        return;
      }

      formRef.current?.reset();
      setStartedAt(Date.now().toString());
      setSubmission({ status: "success" });
    } catch {
      setSubmission({
        status: "error",
        message: "We could not reach the reservations team. Please try again or call us.",
      });
    }
  }

  return (
    <section className="contact-form-section" aria-labelledby="contact-form-heading">
      <div className="contact-form-copy">
        <p className="eyebrow dark">Send us a message</p>
        <h2 id="contact-form-heading">How can we help?</h2>
        <p>
          Share your dates and what you&apos;re looking for. Our reservations team
          will reply directly to the email address you provide.
        </p>
        <ul>
          <li>Rates and condo availability</li>
          <li>Two separate condos in the same complex</li>
          <li>Owner and property-manager partnerships</li>
        </ul>
      </div>

      <form ref={formRef} className="contact-form" onSubmit={handleSubmit} noValidate>
        <input type="hidden" name="startedAt" value={startedAt} />
        <label className="contact-honeypot" aria-hidden="true">
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>

        <label>
          <span>Name *</span>
          <input
            name="name"
            type="text"
            autoComplete="name"
            maxLength={100}
            aria-invalid={Boolean(errors.name)}
            required
          />
          <ErrorMessage message={errors.name} />
        </label>
        <label>
          <span>Email *</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            aria-invalid={Boolean(errors.email)}
            required
          />
          <ErrorMessage message={errors.email} />
        </label>
        <label>
          <span>Phone</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            aria-invalid={Boolean(errors.phone)}
          />
          <ErrorMessage message={errors.phone} />
        </label>
        <label>
          <span>What can we help with? *</span>
          <select name="topic" defaultValue="" aria-invalid={Boolean(errors.topic)} required>
            <option value="" disabled>Select one</option>
            {Object.entries(CONTACT_TOPICS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <ErrorMessage message={errors.topic} />
        </label>
        <label className="contact-form-wide">
          <span>Condo or property</span>
          <input
            name="property"
            type="text"
            maxLength={120}
            placeholder="If you have one in mind"
            aria-invalid={Boolean(errors.property)}
          />
          <ErrorMessage message={errors.property} />
        </label>
        <label>
          <span>Check-in</span>
          <input name="checkIn" type="date" aria-invalid={Boolean(errors.checkIn)} />
          <ErrorMessage message={errors.checkIn} />
        </label>
        <label>
          <span>Check-out</span>
          <input name="checkOut" type="date" aria-invalid={Boolean(errors.checkOut)} />
          <ErrorMessage message={errors.checkOut} />
        </label>
        <label className="contact-form-wide">
          <span>Guests</span>
          <input
            name="guests"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            aria-invalid={Boolean(errors.guests)}
          />
          <ErrorMessage message={errors.guests} />
        </label>
        <label className="contact-form-wide">
          <span>Message *</span>
          <textarea
            name="message"
            rows={7}
            minLength={20}
            maxLength={3_000}
            placeholder="Tell us about your stay or question."
            aria-invalid={Boolean(errors.message)}
            required
          />
          <ErrorMessage message={errors.message} />
        </label>

        <p className="contact-form-privacy">
          Please don&apos;t include payment card information. We&apos;ll use these details
          only to respond to your inquiry.
        </p>
        <button type="submit" disabled={submission.status === "submitting"}>
          {submission.status === "submitting" ? "Sending…" : "Send message"}
        </button>

        <div className="contact-form-status" aria-live="polite" role="status">
          {submission.status === "success" ? (
            <div className="contact-form-success">
              <strong>Your message was sent.</strong>
              <p>Our reservations team will reply as soon as possible.</p>
            </div>
          ) : null}
          {submission.status === "error" ? (
            <div className="contact-form-failure">
              <strong>We couldn&apos;t send that yet.</strong>
              <p>{submission.message}</p>
              <a href={RESERVATIONS_PHONE_HREF}>Call {RESERVATIONS_PHONE_DISPLAY}</a>
            </div>
          ) : null}
        </div>
      </form>
    </section>
  );
}
