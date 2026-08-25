import { NextResponse } from "next/server";
import {
  parseBookingInquiryGuest,
  verifyInquiryGrant,
} from "../../../../lib/booking-inquiry";
import {
  createReservationInquiry,
  GuestyNotFoundError,
  GuestyRequestError,
} from "../../../../lib/guesty";
import { allowRequest, requestClientKey } from "../../../../lib/request-rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!allowRequest("booking-inquiry", requestClientKey(request), 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Please wait a few minutes before sending another booking request." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Complete the booking request and try again." },
      { status: 400 },
    );
  }
  const value = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const grantResult = verifyInquiryGrant(value.grant);
  if (!grantResult.grant) {
    return NextResponse.json({ error: grantResult.error }, { status: 400 });
  }
  const guestResult = parseBookingInquiryGuest(value.guest);
  if (!guestResult.guest) {
    return NextResponse.json({ error: guestResult.error }, { status: 400 });
  }

  try {
    const result = await createReservationInquiry({
      quoteId: grantResult.grant.quoteId,
      ratePlanId: grantResult.grant.ratePlanId,
      guest: guestResult.guest,
    });
    return NextResponse.json({
      ok: true,
      reservationId: result.reservationId,
      status: result.status,
      holdHours: 24,
    });
  } catch (error) {
    if (error instanceof GuestyNotFoundError) {
      return NextResponse.json(
        { error: "This quote expired. Please check the stay again." },
        { status: 409 },
      );
    }
    if (error instanceof GuestyRequestError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "Guesty is busy right now. Your request was not submitted; please try again shortly." },
          { status: 429 },
        );
      }
      if (error.status === 400 || error.status === 403) {
        return NextResponse.json(
          { error: "This inquiry could not be created. Please check the stay again or contact reservations." },
          { status: 409 },
        );
      }
    }
    console.error("Booking inquiry failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "We couldn’t submit this request just now. No booking was created; please try again." },
      { status: 502 },
    );
  }
}
