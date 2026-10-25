"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  formatTripDates,
  splitTrips,
  STATUS_LABELS,
} from "@/lib/dark-matter-travel-tracker/board";
import { etToday } from "@/lib/dates";
import { createDarkMatterTrip } from "@/lib/server-actions/dark-matter-travel-tracker";
import {
  DARK_MATTER_ROOT,
  TRIP_STATUSES,
  darkMatterTripPath,
  type Trip,
  type TripStatus,
} from "@/lib/dark-matter-travel-tracker/types";

function TripCard({ trip }: { trip: Trip }) {
  return (
    <Link className="dm-card" href={darkMatterTripPath(trip.slug)}>
      <h3>{trip.title}</h3>
      <p className="dm-meta">
        {trip.destination ? `${trip.destination} · ` : ""}
        {formatTripDates(trip.startDate, trip.endDate)}
      </p>
      <div className="dm-pills">
        <span className="dm-pill gold">{STATUS_LABELS[trip.status]}</span>
        {trip.travelers.map((person) => (
          <span className="dm-pill" key={person.id}>
            {person.name}
          </span>
        ))}
        {trip.items.length ? (
          <span className="dm-pill">
            {trip.items.length} plan {trip.items.length === 1 ? "item" : "items"}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function DarkMatterBoard({ trips }: { trips: Trip[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { upcoming, past } = splitTrips(trips, etToday());

  function onCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createDarkMatterTrip({
        title: String(formData.get("title") ?? ""),
        destination: String(formData.get("destination") ?? ""),
        startDate: String(formData.get("startDate") ?? "") || null,
        endDate: String(formData.get("endDate") ?? "") || null,
        status: (String(formData.get("status") ?? "planning") || "planning") as TripStatus,
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`${DARK_MATTER_ROOT}/${result.data.slug}`);
      router.refresh();
    });
  }

  return (
    <div className="dm-shell">
      <p className="dm-kicker">
        <span className="dm-kicker-dot" />
        Family travel board
      </p>
      <h1 className="dm-title">Dark Matter Travel Tracker</h1>
      <p className="dm-lede">
        Trips, who is going, and the day-by-day plan.
      </p>

      <div className="dm-section">
        <div className="dm-actions">
          <button className="dm-button" type="button" onClick={() => setOpen((value) => !value)}>
            {open ? "Hide new trip" : "Add a trip"}
          </button>
        </div>
        {open ? (
          <form className="dm-form" style={{ marginTop: "0.85rem" }} action={onCreate} autoComplete="off">
            <div className="dm-field">
              <span>Trip name</span>
              <input name="title" required maxLength={120} placeholder="Vermont weekend" />
            </div>
            <div className="dm-form-row two">
              <label className="dm-field">
                <span>Where</span>
                <input name="destination" maxLength={160} placeholder="Stowe" />
              </label>
              <label className="dm-field">
                <span>Status</span>
                <select name="status" defaultValue="planning">
                  {TRIP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="dm-form-row two">
              <label className="dm-field">
                <span>Start</span>
                <input name="startDate" type="date" />
              </label>
              <label className="dm-field">
                <span>End</span>
                <input name="endDate" type="date" />
              </label>
            </div>
            <label className="dm-field">
              <span>Notes</span>
              <textarea name="notes" maxLength={4000} placeholder="Drive Friday after school." />
            </label>
            {error ? <p className="dm-error">{error}</p> : null}
            <div className="dm-actions">
              <button className="dm-button" disabled={pending} type="submit">
                {pending ? "Saving…" : "Save trip"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <section className="dm-section">
        <h2>Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="dm-card dm-empty">No upcoming trips yet. Add one above.</div>
        ) : (
          <div className="dm-grid">
            {upcoming.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </section>

      {past.length ? (
        <section className="dm-section">
          <h2>Past</h2>
          <div className="dm-grid">
            {past.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="dm-footer">Dark Matter Travel Tracker</p>
    </div>
  );
}
