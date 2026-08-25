import type { StaySearch } from "../../lib/stay-search";

export function StaySearchForm({ search }: { search?: StaySearch }) {
  return (
    <form className="stay-search" id="find-a-stay" action="/listings" method="get">
      <label>
        <span>Where</span>
        <select name="destination" defaultValue={search?.city ?? ""}>
          <option value="">Anywhere in Florida</option>
          <option value="Orlando">Orlando &amp; Disney</option>
          <option value="Naples">Naples &amp; Southwest Florida</option>
          <option value="Key West">Florida Keys</option>
          <option value="Miami">Miami &amp; Atlantic Coast</option>
        </select>
      </label>
      <label>
        <span>Check in</span>
        <input type="date" name="checkIn" defaultValue={search?.checkIn} />
      </label>
      <label>
        <span>Check out</span>
        <input type="date" name="checkOut" defaultValue={search?.checkOut} />
      </label>
      <label>
        <span>Guests</span>
        <select name="guests" defaultValue={String(search?.guests ?? 2)}>
          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((count) => (
            <option key={count} value={count}>{count}{count === 12 ? "+" : ""} guest{count === 1 ? "" : "s"}</option>
          ))}
        </select>
      </label>
      <button type="submit">Search condos</button>
    </form>
  );
}
