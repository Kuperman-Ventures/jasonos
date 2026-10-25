"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  KIND_LABELS,
  STATUS_LABELS,
  formatClock,
  formatTripDates,
  groupItemsByDay,
} from "@/lib/dark-matter-travel-tracker/board";
import {
  DARK_MATTER_ROOT,
  ITEM_KINDS,
  TRIP_STATUSES,
  type ItemKind,
  type Trip,
  type TripStatus,
} from "@/lib/dark-matter-travel-tracker/types";
import {
  addDarkMatterItem,
  addDarkMatterTraveler,
  deleteDarkMatterTrip,
  removeDarkMatterItem,
  removeDarkMatterTraveler,
  updateDarkMatterTrip,
} from "@/lib/server-actions/dark-matter-travel-tracker";

export function DarkMatterTripView({ trip }: { trip: Trip }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const days = groupItemsByDay(trip.items);

  function run(label: string, fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(`${label}: ${result.error}`);
      else router.refresh();
    });
  }

  function onUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateDarkMatterTrip(trip.slug, {
        title: String(formData.get("title") ?? ""),
        destination: String(formData.get("destination") ?? ""),
        startDate: String(formData.get("startDate") ?? "") || null,
        endDate: String(formData.get("endDate") ?? "") || null,
        status: (String(formData.get("status") ?? trip.status) || trip.status) as TripStatus,
        notes: String(formData.get("notes") ?? ""),
      });
      if (!result.ok) {
        setError(`Save trip: ${result.error}`);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function onAddPerson(formData: FormData) {
    run("Add person", () => addDarkMatterTraveler(trip.slug, String(formData.get("name") ?? "")));
  }

  function onAddItem(formData: FormData) {
    run("Add plan item", () =>
      addDarkMatterItem(trip.slug, {
        title: String(formData.get("title") ?? ""),
        kind: (String(formData.get("kind") ?? "activity") || "activity") as ItemKind,
        occursOn: String(formData.get("occursOn") ?? "") || null,
        startTime: String(formData.get("startTime") ?? "") || null,
        location: String(formData.get("location") ?? ""),
        confirmation: String(formData.get("confirmation") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      })
    );
  }

  function onDeleteTrip() {
    if (!window.confirm(`Delete ${trip.title}? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteDarkMatterTrip(trip.slug);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(DARK_MATTER_ROOT);
      router.refresh();
    });
  }

  return (
    <div className="dm-shell">
      <Link className="dm-back" href={DARK_MATTER_ROOT}>
        ← All trips
      </Link>
      <p className="dm-kicker">
        <span className="dm-kicker-dot" />
        {STATUS_LABELS[trip.status]}
      </p>
      <h1 className="dm-title">{trip.title}</h1>
      <p className="dm-lede">
        {trip.destination ? `${trip.destination} · ` : ""}
        {formatTripDates(trip.startDate, trip.endDate)}
      </p>
      {trip.notes ? <p className="dm-lede">{trip.notes}</p> : null}

      <div className="dm-actions" style={{ marginTop: "1.25rem" }}>
        <button className="dm-button ghost" type="button" onClick={() => setEditing((value) => !value)}>
          {editing ? "Close editor" : "Edit trip"}
        </button>
        <button className="dm-button danger" type="button" disabled={pending} onClick={onDeleteTrip}>
          Delete trip
        </button>
      </div>
      {error ? <p className="dm-error">{error}</p> : null}

      {editing ? (
        <form className="dm-form" style={{ marginTop: "1rem" }} action={onUpdate}>
          <label className="dm-field">
            <span>Trip name</span>
            <input name="title" required maxLength={120} defaultValue={trip.title} />
          </label>
          <div className="dm-form-row two">
            <label className="dm-field">
              <span>Where</span>
              <input name="destination" maxLength={160} defaultValue={trip.destination} />
            </label>
            <label className="dm-field">
              <span>Status</span>
              <select name="status" defaultValue={trip.status}>
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
              <input name="startDate" type="date" defaultValue={trip.startDate ?? ""} />
            </label>
            <label className="dm-field">
              <span>End</span>
              <input name="endDate" type="date" defaultValue={trip.endDate ?? ""} />
            </label>
          </div>
          <label className="dm-field">
            <span>Notes</span>
            <textarea name="notes" maxLength={4000} defaultValue={trip.notes} />
          </label>
          <button className="dm-button" disabled={pending} type="submit">
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      ) : null}

      <section className="dm-section">
        <h2>Who is going</h2>
        <div className="dm-people">
          {trip.travelers.length === 0 ? (
            <span className="dm-meta">No one listed yet.</span>
          ) : (
            trip.travelers.map((person) => (
              <span className="dm-person" key={person.id}>
                {person.name}
                <button
                  type="button"
                  aria-label={`Remove ${person.name}`}
                  disabled={pending}
                  onClick={() =>
                    run("Remove person", () => removeDarkMatterTraveler(trip.slug, person.id))
                  }
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <form className="dm-form" style={{ marginTop: "0.85rem" }} action={onAddPerson} autoComplete="off">
          <div className="dm-form-row two">
            <label className="dm-field">
              <span>Name</span>
              <input name="name" required maxLength={80} placeholder="Kyle" />
            </label>
            <div className="dm-actions" style={{ alignSelf: "end" }}>
              <button className="dm-button" disabled={pending} type="submit">
                Add person
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="dm-section">
        <h2>Plan</h2>
        {days.length === 0 ? (
          <div className="dm-card dm-empty">Nothing on the itinerary yet.</div>
        ) : (
          days.map((day) => (
            <div className="dm-day" key={day.key}>
              <h3>{day.label}</h3>
              {day.items.map((item) => (
                <article className="dm-item" key={item.id}>
                  <time>{formatClock(item.startTime) ?? "Anytime"}</time>
                  <div>
                    <h4>
                      {KIND_LABELS[item.kind]} · {item.title}
                    </h4>
                    {item.location ? <p>{item.location}</p> : null}
                    {item.confirmation ? <p>Conf {item.confirmation}</p> : null}
                    {item.notes ? <p>{item.notes}</p> : null}
                  </div>
                  <button
                    className="dm-button ghost"
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run("Remove item", () => removeDarkMatterItem(trip.slug, item.id))
                    }
                  >
                    Remove
                  </button>
                </article>
              ))}
            </div>
          ))
        )}

        <form className="dm-form" style={{ marginTop: "1rem" }} action={onAddItem} autoComplete="off">
          <div className="dm-form-row two">
            <label className="dm-field">
              <span>What</span>
              <input name="title" required maxLength={160} placeholder="Drive to the mountain" />
            </label>
            <label className="dm-field">
              <span>Kind</span>
              <select name="kind" defaultValue="activity">
                {ITEM_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="dm-form-row three">
            <label className="dm-field">
              <span>Day</span>
              <input name="occursOn" type="date" />
            </label>
            <label className="dm-field">
              <span>Time</span>
              <input name="startTime" type="time" />
            </label>
            <label className="dm-field">
              <span>Place</span>
              <input name="location" maxLength={160} placeholder="Mountain Creek" />
            </label>
          </div>
          <div className="dm-form-row two">
            <label className="dm-field">
              <span>Confirmation</span>
              <input name="confirmation" maxLength={80} />
            </label>
            <label className="dm-field">
              <span>Notes</span>
              <input name="notes" maxLength={2000} />
            </label>
          </div>
          <button className="dm-button" disabled={pending} type="submit">
            Add to plan
          </button>
        </form>
      </section>

      <p className="dm-footer">Dark Matter Travel Tracker</p>
    </div>
  );
}
