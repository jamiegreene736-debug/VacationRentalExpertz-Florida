interface UnknownRecord {
  [key: string]: unknown;
}

export interface GuestyStayQuote {
  available: true;
  quoteId: string;
  ratePlanId: string;
  ratePlanName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  currency: string;
  accommodationTotal: number;
  averageNightlyRate: number;
  fees: number;
  taxes: number;
  total: number;
  expiresAt?: string;
}

export interface GuestyUnavailableStay {
  available: false;
  reason: "dates" | "stay-rules";
}

export type GuestyStayResult = GuestyStayQuote | GuestyUnavailableStay;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nestedMoney(value: unknown): UnknownRecord | undefined {
  if (!isRecord(value)) return undefined;
  return isRecord(value.money) ? value.money : value;
}

function quoteRestrictionReason(value: unknown): GuestyUnavailableStay["reason"] | undefined {
  if (!isRecord(value)) return undefined;
  const hardDateRules = ["hardBlocked", "manual", "preparationTime", "byDefault", "allotment"];
  return hardDateRules.some((key) => value[key] === true) ? "dates" : "stay-rules";
}

export function unavailableReasonFromGuestyError(
  value: unknown,
): GuestyUnavailableStay["reason"] | undefined {
  if (!isRecord(value) || !isRecord(value.error)) return undefined;
  if (value.error.code !== "LISTING_IS_NOT_AVAILABLE") return undefined;
  const data = isRecord(value.error.data) ? value.error.data : {};
  const details = isRecord(data.moreDetails) ? data.moreDetails : {};
  const ratePlans = Array.isArray(details.notApplicableRatePlans)
    ? details.notApplicableRatePlans
    : [];
  const reasons = ratePlans
    .map((ratePlan) => (
      isRecord(ratePlan) ? quoteRestrictionReason(ratePlan.notApplicable) : undefined
    ))
    .filter((reason): reason is GuestyUnavailableStay["reason"] => Boolean(reason));
  return reasons.includes("dates") ? "dates" : "stay-rules";
}

export function normalizeStayQuote(
  value: unknown,
  checkIn: string,
  checkOut: string,
  guests: number,
): GuestyStayResult {
  if (!isRecord(value) || !isRecord(value.rates) || !Array.isArray(value.rates.ratePlans)) {
    throw new Error("Guesty returned an invalid quote response.");
  }

  const quoteId = stringValue(value._id);
  if (!quoteId) throw new Error("Guesty returned an invalid quote response.");
  const nights = Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000,
  );
  const restrictions: GuestyUnavailableStay["reason"][] = [];
  const quotes: GuestyStayQuote[] = [];

  for (const candidate of value.rates.ratePlans) {
    if (!isRecord(candidate)) continue;
    const restricted = quoteRestrictionReason(candidate.notApplicable);
    if (
      isRecord(candidate.notApplicable)
      && Object.values(candidate.notApplicable).some((flag) => flag === true)
    ) {
      restrictions.push(restricted ?? "stay-rules");
      continue;
    }
    const ratePlan = isRecord(candidate.ratePlan) ? candidate.ratePlan : {};
    if (ratePlan.active === false) continue;
    const money = nestedMoney(candidate.money) ?? nestedMoney(ratePlan.money);
    if (!money) continue;
    const days = Array.isArray(candidate.days) ? candidate.days.filter(isRecord) : [];
    const accommodationTotal = numberValue(money.fareAccommodationAdjusted)
      ?? numberValue(money.fareAccommodation)
      ?? days.reduce((total, day) => total + (numberValue(day.price) ?? 0), 0);
    const fees = numberValue(money.totalFees)
      ?? Math.max(0, (numberValue(money.subTotalPrice) ?? accommodationTotal) - accommodationTotal);
    const taxes = numberValue(money.totalTaxes) ?? 0;
    const subtotal = numberValue(money.subTotalPrice) ?? accommodationTotal + fees;
    const total = subtotal + taxes;
    const ratePlanId = stringValue(ratePlan._id)
      ?? stringValue(ratePlan.id)
      ?? stringValue(isRecord(candidate.money) ? candidate.money.rateId : undefined)
      ?? "default-rateplan-id";
    const currency = stringValue(money.currency)
      ?? stringValue(days[0]?.currency)
      ?? "USD";

    if (nights < 1 || accommodationTotal < 0 || total < 0 || !Number.isFinite(total)) continue;
    quotes.push({
      available: true,
      quoteId,
      ratePlanId,
      ratePlanName: stringValue(ratePlan.name) ?? "Standard rate",
      checkIn,
      checkOut,
      guests,
      nights,
      currency,
      accommodationTotal,
      averageNightlyRate: accommodationTotal / nights,
      fees,
      taxes,
      total,
      expiresAt: stringValue(value.expiresAt),
    });
  }

  quotes.sort((left, right) => left.total - right.total);
  if (quotes[0]) return quotes[0];
  return {
    available: false,
    reason: restrictions.includes("dates") ? "dates" : "stay-rules",
  };
}
