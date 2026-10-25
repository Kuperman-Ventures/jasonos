import Link from "next/link";
import { DARK_MATTER_ROOT } from "@/lib/dark-matter-travel-tracker/types";

export default function DarkMatterNotFound() {
  return (
    <div className="dm-shell">
      <p className="dm-kicker">
        <span className="dm-kicker-dot" />
        Travel tracker
      </p>
      <h1 className="dm-title">Trip not found</h1>
      <p className="dm-lede">That trip is not on the board.</p>
      <p style={{ marginTop: "1.25rem" }}>
        <Link className="dm-back" href={DARK_MATTER_ROOT}>
          ← All trips
        </Link>
      </p>
    </div>
  );
}
