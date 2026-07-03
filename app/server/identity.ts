// Best-effort Workbench identity, resolved out-of-band by the container's
// entrypoint (see app/entrypoint.sh) which runs the `wb` CLI against the
// Workbench platform and writes the result to IDENTITY_FILE. Reading a file
// keeps the slow (JVM cold-start) `wb` calls off the request path and means a
// failed/blocked resolution simply yields `unavailable` — the UI then asks the
// user to type their details instead. This module never throws.

import fs from "fs";
import path from "path";

const IDENTITY_FILE =
  process.env.IDENTITY_FILE ?? path.join(__dirname, "..", "identity.json");

export type IdentityStatus = "pending" | "resolved" | "unavailable";

export interface WorkbenchIdentity {
  status: IdentityStatus;
  // The Workbench user account email (from `wb workspace describe`).
  email?: string;
  // Environment context the container can see, surfaced to make the wb-tools
  // integration visible in the UI (proves the CLI reached the platform).
  project?: string;
  workspace?: string;
  petSa?: string;
}

export function readIdentity(): WorkbenchIdentity {
  try {
    const raw = fs.readFileSync(IDENTITY_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<WorkbenchIdentity>;
    const status: IdentityStatus =
      parsed.status === "resolved" || parsed.status === "pending"
        ? parsed.status
        : "unavailable";
    return {
      status,
      email: parsed.email || undefined,
      project: parsed.project || undefined,
      workspace: parsed.workspace || undefined,
      petSa: parsed.petSa || undefined,
    };
  } catch {
    // File not written yet or unreadable — resolution may still be running.
    return { status: "pending" };
  }
}
