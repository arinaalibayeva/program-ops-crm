// Dummy cohort used until the FastAPI backend exists. All names, emails and
// partners are made up. Problems are planted on purpose (see PLANTED below)
// so user tests have known answers to score against.

import type {
  Attendance,
  Calculation,
  CohortData,
  Completion,
  CustomRecord,
  Enrollment,
  FieldDefinition,
  Person,
  ProgramEvent,
  Project,
  RecordForm,
  RecordType,
  Requirement,
  Rule,
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

/** Starting custom fields: generic ones most programs ask for. */
const FIELDS: FieldDefinition[] = [
  {
    id: "field-phone",
    label: "Phone",
    type: "text",
    placeholder: "+1 555 010 0000",
    required: false,
    showInList: false,
    visibleToParticipant: true,
  },
  {
    id: "field-organization",
    label: "Organization",
    type: "text",
    placeholder: "School, company or community group",
    required: false,
    showInList: true,
    visibleToParticipant: true,
  },
  {
    id: "field-location",
    label: "Location",
    type: "text",
    placeholder: "City, country",
    required: false,
    showInList: true,
    visibleToParticipant: true,
  },
];

const ORGANIZATIONS = [
  "Northfield College", "Brightline Labs", "Riverside University",
  "Open Harbor Foundation", "Cedar Street Studio", "Lakeview Institute",
];
const LOCATIONS = [
  "San Francisco, USA", "Berlin, Germany", "Seoul, South Korea", "Buenos Aires, Argentina",
  "Hyderabad, India", "Taipei, Taiwan", "London, UK", "Nairobi, Kenya",
];

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
    details: Pick<
      ProgramEvent,
      "startTime" | "endTime" | "location" | "host" | "description" | "links"
    >,
  ): ProgramEvent => ({
    id,
    cohortId,
    title,
    category,
    date,
    isRequired,
    ...details,
    checkinToken: `chk-${id}-${Math.floor(rand() * 1e8).toString(36)}`,
  });

  const events: ProgramEvent[] = [
    ev("ev-1", "Kickoff", "all-hands", "2026-09-22", true, {
      startTime: "17:00",
      endTime: "19:00",
      location: "Main hall",
      host: "Program team",
      description:
        "Welcome to the cohort! This is the first time everyone is in the same room, so we'll start with introductions and a quick tour of how the program works: the timeline, what's expected of each team and how attendance and check-ins are tracked.\n\nAfter that, you'll meet your team for the first time and hear from two participants from last year about what they wish they had known at the start. We'll finish with an open Q&A.\n\nDinner is provided. Please arrive 10 minutes early to pick up your name badge.",
      links: [
        { label: "Welcome slides", url: "https://slides.example.org/kickoff" },
        { label: "Program handbook", url: "https://docs.example.org/handbook" },
        { label: "Recording", url: "https://video.example.org/kickoff-recording" },
      ],
    }),
    ev("ev-2", "Workshop 1: Problem framing", "workshop", "2026-09-29", true, {
      startTime: "18:00",
      endTime: "20:00",
      location: "Room 204",
      host: "Dana Lee",
      description:
        "Most projects struggle not because the solution is wrong but because the problem was never clearly defined. In this workshop, each team turns its partner's broad challenge into a specific problem statement it can actually test.\n\nWe'll work through three short exercises: mapping who is affected, separating symptoms from causes, and writing a \"How might we\" question. By the end, every team should have one problem statement it agrees on.\n\nBring your partner brief and a laptop. Teams will share their statements at the end for quick feedback.",
      links: [
        { label: "Workshop slides", url: "https://slides.example.org/problem-framing" },
        { label: "Problem statement template", url: "https://docs.example.org/problem-statement-template" },
        { label: "Partner briefs", url: "https://drive.example.org/partner-briefs" },
      ],
    }),
    ev("ev-3", "Workshop 2: User research", "workshop", "2026-10-06", true, {
      startTime: "18:00",
      endTime: "20:00",
      location: "Room 204",
      host: "Dana Lee",
      description:
        "Before building anything, you need to hear from the people your project is for. This session covers how to find interviewees, how to ask open questions without leading people toward the answer you want, and how to take notes your whole team can use.\n\nThe second half is practice: teams pair up and run short mock interviews with each other, then swap roles. You'll leave with an interview guide and a plan to talk to at least five people before the next workshop.",
      links: [
        { label: "Workshop slides", url: "https://slides.example.org/user-research" },
        { label: "Interview guide template", url: "https://docs.example.org/interview-guide" },
        { label: "Consent form for interviewees", url: "https://forms.example.org/interview-consent" },
      ],
    }),
    ev("ev-4", "Partner meet & greet", "partner", "2026-10-08", false, {
      startTime: "12:00",
      endTime: "13:30",
      location: "https://meet.example.org/partners",
      host: "Partner organizations",
      description:
        "An informal online call to meet the partner organizations behind this cohort's projects. Each partner will spend a few minutes on who they are, the work they do and why they brought their challenge to the program.\n\nThere will be time for questions at the end, so come with anything you'd like to know about your partner's goals, constraints or the people they serve. The call is optional but strongly recommended if you haven't spoken with your partner yet.\n\nThe recording will be shared afterwards for anyone who can't join.",
      links: [
        { label: "Call link", url: "https://meet.example.org/partners" },
        { label: "Partner profiles", url: "https://docs.example.org/partner-profiles" },
        { label: "Recording", url: "https://video.example.org/partner-call" },
      ],
    }),
    ev("ev-5", "Workshop 3: Prototyping", "workshop", "2026-10-13", true, {
      startTime: "18:00",
      endTime: "20:00",
      location: "Maker lab",
      host: "Sam Ortiz",
      description:
        "Now that you understand the problem, it's time to make something people can react to. This workshop is about building quick, rough versions of your idea, like paper sketches, clickable mockups or a simple role-play, before investing weeks into a polished solution.\n\nWe'll look at examples of good and bad prototypes, then teams will have about an hour in the maker lab to build their first one. Materials are provided, including paper, markers, sticky notes and a few tablets.\n\nThe goal is not perfection. If your prototype takes more than an hour to make, it's probably too detailed.",
      links: [
        { label: "Workshop slides", url: "https://slides.example.org/prototyping" },
        { label: "Prototype examples", url: "https://board.example.org/prototype-examples" },
        { label: "Maker lab booking form", url: "https://forms.example.org/maker-lab" },
      ],
    }),
    ev("ev-6", "Social night", "social", "2026-10-16", false, {
      startTime: "19:00",
      location: "Courtyard",
      description:
        "A relaxed evening with food, music and games, and no work talk required. It's a chance to get to know people from other teams, swap stories about how your projects are going and meet some of the mentors outside of workshops.\n\nVegetarian and vegan options will be available. Friends and partners are welcome to come along.",
      links: [
        { label: "RSVP for food", url: "https://forms.example.org/social-rsvp" },
      ],
    }),
    // Happening on the demo's "today" so the check-in page can be tried.
    // Built without ev() so it doesn't draw from rand() and shift the
    // planted attendance below.
    {
      id: "ev-9",
      cohortId,
      title: "Weekly team check-in",
      category: "meeting",
      date: "2026-10-19",
      startTime: "17:00",
      endTime: "18:00",
      location: "Room 204",
      host: "Program team",
      description:
        "A short weekly meeting where each team shares what they did last week, what they plan to do next and anything they're stuck on.\n\nKeep it to two minutes per team. Mentors will stay afterwards for anyone who wants help.",
      links: [{ label: "Weekly update form", url: "https://forms.example.org/weekly-update" }],
      isRequired: false,
      checkinToken: "chk-ev-9-today",
    },
    ev("ev-7", "Workshop 4: Testing with users", "workshop", "2026-10-27", true, {
      startTime: "18:00",
      endTime: "20:00",
      location: "Room 204",
      host: "Sam Ortiz",
      description:
        "Time to put your prototype in front of real users and find out what works. We'll cover how to run a short testing session, what to watch for while someone uses your prototype and how to avoid explaining it too much.\n\nEach team will then run at least two live tests with invited guests during the session. At the end, teams will sort what they saw into what to keep, change and drop, and decide on next steps before the midpoint showcase.\n\nPlease bring your latest prototype and make sure it's ready to be tested.",
      links: [
        { label: "Testing script template", url: "https://docs.example.org/testing-script" },
        { label: "Guest sign-up sheet", url: "https://sheets.example.org/test-guests" },
      ],
    }),
    ev("ev-8", "Midpoint showcase", "all-hands", "2026-11-10", true, {
      startTime: "17:00",
      endTime: "19:30",
      location: "Main hall",
      host: "Program team",
      description:
        "The midpoint showcase is where each team presents its progress to partners, mentors and the rest of the cohort. Every team gets five minutes to present followed by three minutes of questions.\n\nCover the problem you're working on, what you've learned from users so far, what your prototype looks like now and what you plan to do in the second half of the program. Slides are optional; a short demo is encouraged.\n\nPartners will give written feedback to each team after the event. Please send your slides, if any, to the program team by noon on the day.",
      links: [
        { label: "Presentation guidelines", url: "https://docs.example.org/showcase-guidelines" },
        { label: "Slide upload folder", url: "https://drive.example.org/showcase-slides" },
        { label: "Feedback form for partners", url: "https://forms.example.org/showcase-feedback" },
      ],
    }),
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

  // Separate generator so adding fields doesn't shift the attendance data above.
  const fieldRand = mulberry32(7);
  const pick = <T,>(items: T[]) => items[Math.floor(fieldRand() * items.length)];
  enrollments.forEach((enr, i) => {
    enr.fields = {
      "field-phone": `+1 555 010 ${String(i + 1).padStart(4, "0")}`,
      "field-organization": pick(ORGANIZATIONS),
      "field-location": pick(LOCATIONS),
    };
  });

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
    exemptions: [],
    fields: FIELDS.map((f) => ({ ...f })),
    teamNotes: [],
    ...sampleRecords(cohortId, teams, memberships),
  };
}

// ---- Custom record types ----
// Two example types, set up the way an admin would through Customize, so the
// demo shows links, calculations, rules and a form working together.

export const RECORD_PLANTED = {
  /** Last partner meeting more than two weeks before "today". */
  teamsStaleMeetings: [2, 9],
  /** Never logged a partner meeting. */
  teamNoMeetings: 11,
  /** Has an open issue. */
  teamOpenIssue: 4,
};

const RECORD_TYPES: RecordType[] = [
  {
    id: "rt-meetings",
    programId: "prog-civic",
    name: "Partner meetings",
    singular: "Partner meeting",
    fields: [
      { id: "rf-m-summary", label: "Summary", type: "text", required: true },
      { id: "rf-m-date", label: "Date", type: "date", required: true },
      { id: "rf-m-team", label: "Team", type: "link", linkTo: "team", required: true },
      { id: "rf-m-attended", label: "Attended by", type: "link", linkTo: "participant", multiple: true, required: false },
      { id: "rf-m-partner", label: "Partner attended", type: "checkbox", required: false },
      { id: "rf-m-notes", label: "Notes", type: "long_text", required: false },
      { id: "rf-m-next", label: "Next steps", type: "long_text", required: false },
    ],
  },
  {
    id: "rt-issues",
    programId: "prog-civic",
    name: "Issues",
    singular: "Issue",
    fields: [
      { id: "rf-i-title", label: "Title", type: "text", required: true },
      { id: "rf-i-status", label: "Status", type: "select", options: ["Open", "Resolved"], required: true },
      { id: "rf-i-severity", label: "Severity", type: "select", options: ["Low", "Medium", "High"], required: false },
      { id: "rf-i-team", label: "Team", type: "link", linkTo: "team", required: false },
      { id: "rf-i-people", label: "People involved", type: "link", linkTo: "participant", multiple: true, required: false },
      { id: "rf-i-opened", label: "Opened on", type: "date", required: false },
      { id: "rf-i-details", label: "Details", type: "long_text", required: false },
    ],
  },
];

const CALCULATIONS: Calculation[] = [
  { id: "calc-last-meeting", programId: "prog-civic", label: "Last partner meeting", on: "team", kind: "latest", sourceTypeId: "rt-meetings", viaFieldId: "rf-m-team", dateFieldId: "rf-m-date" },
  { id: "calc-days-since-meeting", programId: "prog-civic", label: "Days since partner meeting", on: "team", kind: "days_since", sourceTypeId: "rt-meetings", viaFieldId: "rf-m-team", dateFieldId: "rf-m-date" },
  { id: "calc-partner-present", programId: "prog-civic", label: "Meetings the partner attended", on: "team", kind: "percent", sourceTypeId: "rt-meetings", viaFieldId: "rf-m-team", filter: { fieldId: "rf-m-partner", op: "is", value: "yes" } },
  { id: "calc-open-issues", programId: "prog-civic", label: "Open issues", on: "team", kind: "count", sourceTypeId: "rt-issues", viaFieldId: "rf-i-team", filter: { fieldId: "rf-i-status", op: "is", value: "Open" } },
  { id: "calc-meetings-attended", programId: "prog-civic", label: "Partner meetings attended", on: "participant", kind: "count", sourceTypeId: "rt-meetings", viaFieldId: "rf-m-attended" },
];

const RULES: Rule[] = [
  { id: "rule-meeting-gap", calculationId: "calc-days-since-meeting", op: "gt", value: 14, whenEmpty: true, status: "at_risk", message: "No partner meeting in over 2 weeks" },
  { id: "rule-open-issue", calculationId: "calc-open-issues", op: "gte", value: 1, whenEmpty: false, status: "at_risk", message: "Has an open issue" },
];

const FORMS: RecordForm[] = [
  {
    id: "form-meeting",
    typeId: "rt-meetings",
    title: "Log a partner meeting",
    description: "Fill this in after every meeting with your partner. It takes a minute.",
    fieldIds: ["rf-m-summary", "rf-m-date", "rf-m-partner", "rf-m-notes", "rf-m-next"],
    token: "log-meeting-demo",
    roster: true,
    isOpen: true,
  },
];

const MEETING_TOPICS = [
  "Kickoff and scope",
  "Weekly sync",
  "Interview findings review",
  "Prototype walkthrough",
  "Feedback on wireframes",
  "Planning next sprint",
];

function sampleRecords(cohortId: string, teams: Team[], memberships: TeamMembership[]) {
  const rand = mulberry32(11);
  const records: CustomRecord[] = [];
  let n = 0;
  const add = (typeId: string, date: string, values: CustomRecord["values"]) =>
    records.push({ id: `rec-${++n}`, typeId, cohortId, values, createdAt: `${date}T18:00:00.000Z` });

  teams.forEach((team, i) => {
    if (i === RECORD_PLANTED.teamNoMeetings) return;
    const members = memberships.filter((m) => m.teamId === team.id && !m.endDate).map((m) => m.enrollmentId);
    // Roughly weekly from the kickoff; stale teams stop early.
    const last = RECORD_PLANTED.teamsStaleMeetings.includes(i) ? "2026-09-30" : "2026-10-19";
    for (let date = addDays("2026-09-10", Math.floor(rand() * 3)), k = 0; date <= last; date = addDays(date, 6 + Math.floor(rand() * 4)), k++) {
      add("rt-meetings", date, {
        "rf-m-summary": MEETING_TOPICS[Math.min(k, MEETING_TOPICS.length - 1)],
        "rf-m-date": date,
        "rf-m-team": team.id,
        "rf-m-attended": members.filter(() => rand() > 0.2),
        "rf-m-partner": rand() > 0.25,
        "rf-m-notes": "Went through progress since last week and open questions.",
      });
    }
  });

  const issueTeam = teams[RECORD_PLANTED.teamOpenIssue];
  add("rt-issues", "2026-10-14", {
    "rf-i-title": "Partner contact changed jobs",
    "rf-i-status": "Open",
    "rf-i-severity": "High",
    "rf-i-team": issueTeam.id,
    "rf-i-opened": "2026-10-14",
    "rf-i-details": "Their main contact left the organization. Waiting to hear who takes over.",
  });
  add("rt-issues", "2026-10-02", {
    "rf-i-title": "Disagreement over project scope",
    "rf-i-status": "Resolved",
    "rf-i-severity": "Medium",
    "rf-i-team": teams[1].id,
    "rf-i-opened": "2026-10-02",
    "rf-i-details": "Resolved after a meeting with the partner on Oct 6.",
  });

  return {
    recordTypes: RECORD_TYPES.map((t) => ({ ...t, fields: t.fields.map((f) => ({ ...f })) })),
    records,
    calculations: CALCULATIONS.map((c) => ({ ...c })),
    rules: RULES.map((r) => ({ ...r })),
    forms: FORMS.map((f) => ({ ...f })),
  };
}
