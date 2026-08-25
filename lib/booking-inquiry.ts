import { createHmac, timingSafeEqual } from "node:crypto";

export interface BookingInquiryGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface InquiryGrantPayload {
  version: 1;
  listingId: string;
  quoteId: string;
  ratePlanId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  expiresAt: number;
}

const LISTING_ID = /^[a-f0-9]{24}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_GRANT_LIFETIME_MS = 25 * 60 * 60 * 1000;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function signingKey(): string {
  const key = process.env.GUESTY_CLIENT_SECRET?.trim();
  if (!key) throw new Error("Guesty is not configured for booking inquiries.");
  return key;
}

function signature(encodedPayload: string): Buffer {
  return createHmac("sha256", signingKey()).update(encodedPayload).digest();
}

export function parseBookingInquiryGuest(
  input: unknown,
): { guest?: BookingInquiryGuest; error?: string } {
  const value = record(input);
  if (!value) return { error: "Enter your contact information." };

  const firstName = text(value.firstName);
  const lastName = text(value.lastName);
  const email = text(value.email).toLocaleLowerCase();
  const phone = text(value.phone);

  if (firstName.length < 1 || firstName.length > 80) return { error: "Enter your first name." };
  if (lastName.length < 1 || lastName.length > 80) return { error: "Enter your last name." };
  if (!EMAIL.test(email) || email.length > 254) return { error: "Enter a valid email address." };
  if (phone.length > 40) return { error: "Enter a shorter phone number." };
  if (value.acceptedTerms !== true) {
    return { error: "Please confirm that this is a booking request, not a confirmed reservation." };
  }

  return {
    guest: {
      firstName,
      lastName,
      email,
      phone: phone || undefined,
    },
  };
}

export function issueInquiryGrant(input: Omit<InquiryGrantPayload, "version" | "expiresAt"> & {
  expiresAt?: string;
}): string {
  const now = Date.now();
  const guestyExpiry = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
  const payload: InquiryGrantPayload = {
    version: 1,
    listingId: text(input.listingId),
    quoteId: text(input.quoteId),
    ratePlanId: text(input.ratePlanId),
    checkIn: text(input.checkIn),
    checkOut: text(input.checkOut),
    guests: input.guests,
    expiresAt: Math.min(
      Number.isFinite(guestyExpiry) ? guestyExpiry : now + 24 * 60 * 60 * 1000,
      now + MAX_GRANT_LIFETIME_MS,
    ),
  };
  if (
    !LISTING_ID.test(payload.listingId)
    || !payload.quoteId
    || !payload.ratePlanId
    || !payload.checkIn
    || !payload.checkOut
    || typeof payload.guests !== "number"
    || !Number.isInteger(payload.guests)
    || payload.expiresAt <= now
  ) {
    throw new Error("Guesty returned an unusable booking quote.");
  }
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded).toString("base64url")}`;
}

export function verifyInquiryGrant(
  token: unknown,
  now = Date.now(),
): { grant?: InquiryGrantPayload; error?: string } {
  const [encoded, suppliedSignature, extra] = text(token).split(".");
  if (!encoded || !suppliedSignature || extra) {
    return { error: "This quote is invalid. Please check the stay again." };
  }

  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expected = signature(encoded);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { error: "This quote is invalid. Please check the stay again." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return { error: "This quote is invalid. Please check the stay again." };
  }
  const payload = record(parsed);
  if (
    !payload
    || payload.version !== 1
    || !LISTING_ID.test(text(payload.listingId))
    || !text(payload.quoteId)
    || !text(payload.ratePlanId)
    || !text(payload.checkIn)
    || !text(payload.checkOut)
    || !Number.isInteger(payload.guests)
    || typeof payload.expiresAt !== "number"
    || !Number.isFinite(payload.expiresAt)
  ) {
    return { error: "This quote is invalid. Please check the stay again." };
  }
  if (payload.expiresAt <= now) {
    return { error: "This quote expired. Please check the stay again." };
  }

  return {
    grant: {
      version: 1,
      listingId: text(payload.listingId),
      quoteId: text(payload.quoteId),
      ratePlanId: text(payload.ratePlanId),
      checkIn: text(payload.checkIn),
      checkOut: text(payload.checkOut),
      guests: payload.guests as number,
      expiresAt: payload.expiresAt,
    },
  };
}
