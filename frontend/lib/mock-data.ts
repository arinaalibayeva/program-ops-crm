// Dummy cohort used until the FastAPI backend exists. All names, emails and
// partners are made up. Problems are planted on purpose (see PLANTED below)
// so user tests have known answers to score against.

import type {
  Attendance,
  CohortData,
  Completion,
  Enrollment,
  Person,
  ProgramEvent,
  Project,
  Requirement,
  Team,
  TeamMembership,
} from "./types";

const FIRST_NAMES = [
  "Amara", "Bruno", "Chen", "Dalia", "Emeka", "Farah", "Gabriel", "Hana",
  "Ivan", "Jaya", "Kofi", "Lucía", "Mateo", "Nadia", "Omar", "Priya",
  "Rafael", "Sofia", "Tariq", "Yuki",
];
const LAST_NAMES = [
  "Okafor", "Silva", "Wang", "Haddad", "Mensah", "Rahman", "Costa", "Kim",
  "Petrov", "Iyer", "Asante", "Moreno", "Rossi", "Nowak", "Farouk", "Shah",
  "Duarte", "Lindqvist", "Aziz", "Tanaka",
];

const TEAM_NAMES = [
  "Harbor", "Lantern", "Compass", "Meridian", "Orchard", "Beacon",
  "Summit", "Willow", "Atlas", "Ember", "Tide", "Juniper",
];

const PROJECTS: { title: string; partner: string }[] = [
  { title: "Volunteer shift scheduling", partner: "Bayview Community Pantry" },
  { title: "Tenant rights info hub", partner: "Mission Housing Collective" },
  { title: "Youth coding club curriculum", partner: "Eastside Learning Center" },
  { title: "Library e-resource onboarding", partner: "Northgate Public Library" },
  { title: "Urban garden plot booking", partner: "Green Blocks Initiative" },
  { title: "Senior tech help desk", partner: "Golden Years Network" },
  { title: "Bike repair co-op inventory", partner: "Spokes Together" },
  { title: "Refugee job board", partner: "New Roots Alliance" },
  { title: "Clinic wait-time tracker", partner: "Harborview Free Clinic" },
  { title: "Neighborhood safety map", partner: "Westside Residents Assoc." },
  { title: "Food waste pickup routing", partner: "Second Plate" },
  { title: "Arts grant application helper", partner: "City Arts Fund" },
];

// Team index -> original size. Team 6 (Summit) is planted to drop to 2.
const TEAM_SIZES = [5, 5, 5, 5, 5, 5, 4, 5, 5, 5, 5, 5];

/**
 * Planted problems, by participant index. Matches the example in the project
 * proposal: on Monday of Week 5 the organizer should find exactly these.
 */
export const PLANTED = {
  missedLastWorkshop: [3, 17, 28, 44], // at risk
  missedTwoWorkshops: [11, 36], // missing
  onboardingNotDone: [22, 51], // missing
  // Summit (team 6): one member withdraws, one moves to Compass (team 2).
  summitWithdrawn: 30,
  summitMovedOut: 31,
  teamMissingBrief: 9, // Ember: missing
  teamsResearchPlanPending: [3, 7, 10], // at risk (due soon)
};

/** Small deterministic PRNG so the dummy data is the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildMockCohort(): CohortData {
  const rand = mulberry32(42);
  const cohortId = "c-fall-2026";
  const startDate = "2026-09-21";

  const projects: Project[] = PROJECTS.map((p, i) => ({
    id: `proj-${i + 1}`,
    cohortId,
    title: p.title,
    partner: p.partner,
  }));

  const teams: Team[] = TEAM_NAMES.map((name, i) => ({
    id: `team-${i + 1}`,
    cohortId,
    name,
    projectId: projects[i].id,
  }));

  const people: Person[] = [];
  const enrollments: Enrollment[] = [];
  const memberships: TeamMembership[] = [];

  let index = 0;
  TEAM_SIZES.forEach((size, teamIndex) => {
    for (let k = 0; k < size; k++, index++) {
      const first = FIRST_NAMES[index % 20];
      const last = LAST_NAMES[(index % 20 + Math.floor(index / 20) * 7 + 3) % 20];
      const personId = `person-${index + 1}`;
      const enrollmentId = `enr-${index + 1}`;
      people.push({
        id: personId,
        name: `${first} ${last}`,
        email: `${first}.${last}@example.edu`
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, ""),
      });
      enrollments.push({
        id: enrollmentId,
        personId,
        cohortId,
        status: "active",
        joinedAt: startDate,
      });
      memberships.push({
        enrollmentId,
        teamId: teams[teamIndex].id,
        startDate,
      });
    }
  });

  // Summit loses two members.
  const withdrawn = enrollments[PLANTED.summitWithdrawn];
  withdrawn.status = "withdrawn";
  withdrawn.leftAt = "2026-10-09";
  memberships.find((m) => m.enrollmentId === withdrawn.id)!.endDate = "2026-10-09";

  const moved = enrollments[PLANTED.summitMovedOut];
  memberships.find((m) => m.enrollmentId === moved.id)!.endDate = "2026-10-05";
  memberships.push({
    enrollmentId: moved.id,
    teamId: teams[2].id,
    startDate: "2026-10-05",
  });

  const ev = (
    id: string,
    title: string,
    category: ProgramEvent["category"],
    date: string,
    isRequired: boolean,
  ): ProgramEvent => ({
    id,
    cohortId,
    title,
    category,
    date,
    isRequired,
    checkinToken: `chk-${id}-${Math.floor(rand() * 1e8).toString(36)}`,
  });

  const events: ProgramEvent[] = [
    ev("ev-1", "Kickoff", "all-hands", "2026-09-22", true),
    ev("ev-2", "Workshop 1: Problem framing", "workshop", "2026-09-29", true),
    ev("ev-3", "Workshop 2: User research", "workshop", "2026-10-06", true),
    ev("ev-4", "Partner meet & greet", "partner", "2026-10-08", false),
    ev("ev-5", "Workshop 3: Prototyping", "workshop", "2026-10-13", true),
    ev("ev-6", "Social night", "social", "2026-10-16", false),
    ev("ev-7", "Workshop 4: Testing with users", "workshop", "2026-10-27", true),
    ev("ev-8", "Midpoint showcase", "all-hands", "2026-11-10", true),
  ];

  const today = "2026-10-19";
  const attendance: Attendance[] = [];
  const skip = new Map<number, Set<string>>();
  for (const i of PLANTED.missedLastWorkshop) skip.set(i, new Set(["ev-5"]));
  skip.set(PLANTED.missedTwoWorkshops[0], new Set(["ev-2", "ev-5"]));
  skip.set(PLANTED.missedTwoWorkshops[1], new Set(["ev-3", "ev-5"]));

  enrollments.forEach((enr, i) => {
    for (const e of events) {
      if (e.date >= today) continue;
      if (enr.leftAt && e.date > enr.leftAt) continue;
      if (skip.get(i)?.has(e.id)) continue;
      // Optional events have patchy attendance, required ones are full
      // except for the planted misses.
      if (!e.isRequired && rand() > 0.65) continue;
      attendance.push({
        eventId: e.id,
        enrollmentId: enr.id,
        source: rand() < 0.9 ? "link" : "manual",
      });
    }
  });

  const requirements: Requirement[] = [
    {
      id: "req-1",
      name: "Workshop attendance",
      scope: "participant",
      type: "attendance_min",
      params: { category: "workshop", minCount: 3 },
    },
    {
      id: "req-2",
      name: "All-hands attendance",
      scope: "participant",
      type: "attendance_min",
      params: { category: "all-hands", minCount: 2 },
    },
    {
      id: "req-3",
      name: "Onboarding form",
      scope: "participant",
      type: "complete_by",
      params: { dueDate: "2026-10-02" },
    },
    {
      id: "req-4",
      name: "Minimum team size",
      scope: "team",
      type: "team_min_size",
      params: { minActive: 3 },
    },
    {
      id: "req-5",
      name: "Project brief",
      scope: "team",
      type: "complete_by",
      params: { dueDate: "2026-10-16" },
    },
    {
      id: "req-6",
      name: "User research plan",
      scope: "team",
      type: "complete_by",
      params: { dueDate: "2026-10-23" },
    },
  ];

  const completions: Completion[] = [];
  enrollments.forEach((enr, i) => {
    if (PLANTED.onboardingNotDone.includes(i)) return;
    completions.push({
      requirementId: "req-3",
      subjectId: enr.id,
      completedAt: addDays(startDate, 1 + Math.floor(rand() * 10)),
    });
  });
  teams.forEach((team, i) => {
    if (i !== PLANTED.teamMissingBrief) {
      completions.push({
        requirementId: "req-5",
        subjectId: team.id,
        completedAt: addDays("2026-10-11", Math.floor(rand() * 5)),
      });
    }
    if (!PLANTED.teamsResearchPlanPending.includes(i)) {
      completions.push({
        requirementId: "req-6",
        subjectId: team.id,
        completedAt: addDays("2026-10-14", Math.floor(rand() * 5)),
      });
    }
  });

  return {
    program: { id: "prog-civic", name: "Civic Projects" },
    cohort: {
      id: cohortId,
      programId: "prog-civic",
      name: "Fall 2026",
      startDate,
      endDate: "2026-12-11",
    },
    today,
    people,
    enrollments,
    projects,
    teams,
    memberships,
    events,
    attendance,
    requirements,
    completions,
  };
}
