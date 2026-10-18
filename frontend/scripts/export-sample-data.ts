// Writes the demo cohort, and the statuses the frontend computes for it, to
// the backend. The backend seeds its database from the first file and checks
// its Python requirement logic against the second.
//   npx tsx scripts/export-sample-data.ts
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildMockCohort } from "../lib/mock-data";
import { participantStatus, teamStatus } from "../lib/requirements";

const out = join(__dirname, "../../backend/app/sample");
const data = buildMockCohort();

const statuses = {
  participants: Object.fromEntries(
    data.enrollments
      .filter((e) => e.status === "active")
      .map((e) => [e.id, participantStatus(data, e.id)]),
  ),
  teams: Object.fromEntries(data.teams.map((t) => [t.id, teamStatus(data, t)])),
};

writeFileSync(join(out, "cohort.json"), JSON.stringify(data, null, 2) + "\n");
writeFileSync(join(out, "expected_statuses.json"), JSON.stringify(statuses, null, 2) + "\n");
console.log(`Wrote ${data.enrollments.length} enrollments and ${data.events.length} events to ${out}`);
