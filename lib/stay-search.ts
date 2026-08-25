export interface StaySearch {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests: number;
}

const allowedCities = new Set(["New Smyrna Beach"]);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRealIsoDate(value: string): boolean {
  if (!isoDate.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function parseStaySearch(
  params: Record<string, string | string[] | undefined>,
): { search: StaySearch; error?: string } {
  const rawCity = first(params.destination)?.trim();
  const rawCheckIn = first(params.checkIn)?.trim();
  const rawCheckOut = first(params.checkOut)?.trim();
  const rawGuests = first(params.guests)?.trim();
  const guests = rawGuests ? Number.parseInt(rawGuests, 10) : 2;

  const search: StaySearch = {
    guests: Number.isInteger(guests) && guests >= 1 && guests <= 30 ? guests : 2,
  };

  if (rawCity && allowedCities.has(rawCity)) search.city = rawCity;

  if ((rawCheckIn && !rawCheckOut) || (!rawCheckIn && rawCheckOut)) {
    return { search, error: "Choose both check-in and check-out dates." };
  }

  if (rawCheckIn && rawCheckOut) {
    if (!isRealIsoDate(rawCheckIn) || !isRealIsoDate(rawCheckOut)) {
      return { search, error: "Choose valid travel dates." };
    }
    if (rawCheckOut <= rawCheckIn) {
      return { search, error: "Check-out must be after check-in." };
    }
    search.checkIn = rawCheckIn;
    search.checkOut = rawCheckOut;
  }

  return { search };
}
