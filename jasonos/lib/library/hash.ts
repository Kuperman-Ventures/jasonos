import { createHash } from "node:crypto";
import { libraryBodyHashSource } from "./text";

export function libraryBodyHash(body: string): string {
  return createHash("sha256").update(libraryBodyHashSource(body), "utf8").digest("hex");
}
