export const CONTACT_TOPICS = {
  reservation: "Reservation help",
  availability: "Rates & availability",
  pairedStay: "Paired condo stay",
  owner: "Owner partnership",
  manager: "Property manager partnership",
  other: "Other question",
} as const;

export type ContactTopic = keyof typeof CONTACT_TOPICS;

export type ContactFormValues = {
  name: string;
  email: string;
  phone: string;
  topic: string;
  property: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  message: string;
  website: string;
  startedAt: string;
};

export type ValidContactInquiry = Omit<
  ContactFormValues,
  "topic" | "guests" | "website" | "startedAt"
> & {
  topic: ContactTopic;
  guests: number | null;
};

export type ContactFieldErrors = Partial<
  Record<keyof ContactFormValues | "form", string>
>;

export type ContactValidationResult =
  | { ok: true; inquiry: ValidContactInquiry; isSpam: boolean }
  | { ok: false; errors: ContactFieldErrors };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_FORM_FILL_MS = 1_200;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1_000;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasValidDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function validateContactForm(
  input: unknown,
  now = Date.now(),
): ContactValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: { form: "Please complete the contact form." } };
  }

  const raw = input as Record<string, unknown>;
  const values: ContactFormValues = {
    name: stringValue(raw.name),
    email: stringValue(raw.email).toLowerCase(),
    phone: stringValue(raw.phone),
    topic: stringValue(raw.topic),
    property: stringValue(raw.property),
    checkIn: stringValue(raw.checkIn),
    checkOut: stringValue(raw.checkOut),
    guests: stringValue(raw.guests),
    message: stringValue(raw.message),
    website: stringValue(raw.website),
    startedAt: stringValue(raw.startedAt),
  };
  const errors: ContactFieldErrors = {};

  if (
    values.name.length < 2 ||
    values.name.length > 100 ||
    /[\r\n]/.test(values.name)
  ) {
    errors.name = "Enter your name (2–100 characters).";
  }
  if (!EMAIL_PATTERN.test(values.email) || values.email.length > 254) {
    errors.email = "Enter a valid email address.";
  }
  if (values.phone.length > 40) {
    errors.phone = "Enter a phone number with 40 characters or fewer.";
  }
  if (!Object.hasOwn(CONTACT_TOPICS, values.topic)) {
    errors.topic = "Choose what we can help with.";
  }
  if (values.property.length > 120) {
    errors.property = "Keep the property name under 120 characters.";
  }
  if (values.message.length < 20 || values.message.length > 3_000) {
    errors.message = "Enter a message between 20 and 3,000 characters.";
  }

  const hasCheckIn = values.checkIn.length > 0;
  const hasCheckOut = values.checkOut.length > 0;
  if (hasCheckIn !== hasCheckOut) {
    errors.checkIn = "Add both check-in and check-out dates, or leave both blank.";
    errors.checkOut = "Add both check-in and check-out dates, or leave both blank.";
  } else if (hasCheckIn && hasCheckOut) {
    if (!hasValidDate(values.checkIn)) errors.checkIn = "Enter a valid check-in date.";
    if (!hasValidDate(values.checkOut)) errors.checkOut = "Enter a valid check-out date.";
    if (
      !errors.checkIn &&
      !errors.checkOut &&
      values.checkOut <= values.checkIn
    ) {
      errors.checkOut = "Check-out must be after check-in.";
    }
  }

  let guests: number | null = null;
  if (values.guests) {
    guests = Number(values.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > 30) {
      errors.guests = "Enter between 1 and 30 guests.";
    }
  }

  const startedAt = Number(values.startedAt);
  const formAge = now - startedAt;
  const hasPlausibleTiming =
    Number.isFinite(startedAt) &&
    formAge >= MIN_FORM_FILL_MS &&
    formAge <= MAX_FORM_AGE_MS;

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    isSpam: values.website.length > 0 || !hasPlausibleTiming,
    inquiry: {
      name: values.name,
      email: values.email,
      phone: values.phone,
      topic: values.topic as ContactTopic,
      property: values.property,
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests,
      message: values.message,
    },
  };
}

export function contactInquiryText(inquiry: ValidContactInquiry): string {
  const lines = [
    "New website contact inquiry",
    "",
    `Topic: ${CONTACT_TOPICS[inquiry.topic]}`,
    `Name: ${inquiry.name}`,
    `Email: ${inquiry.email}`,
    `Phone: ${inquiry.phone || "Not provided"}`,
    `Property: ${inquiry.property || "Not specified"}`,
    `Dates: ${
      inquiry.checkIn && inquiry.checkOut
        ? `${inquiry.checkIn} to ${inquiry.checkOut}`
        : "Not specified"
    }`,
    `Guests: ${inquiry.guests ?? "Not specified"}`,
    "",
    "Message:",
    inquiry.message,
  ];

  return lines.join("\n");
}
