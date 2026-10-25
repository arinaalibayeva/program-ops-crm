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
  Note,
  Partner,
  Person,
  ProgramEvent,
  Project,
  RecordForm,
  RecordType,
  Requirement,
  Rule,
  StaffMember,
  Team,
  TeamMembership,
} from "./types";

const FIRST_NAMES = [
  "Amara", "Bruno", "Chen", "Dalia", "Emeka", "Farah", "Gabriel", "Hana",
  "Ivan", "Jaya", "Kofi", "Lucía", "Mateo", "Nadia", "Omar", "Priya",
  "Rafael", "Sofia", "Tariq", "Yuki", "Aisha", "Andrei", "Beatriz", "Camila",
  "Daniel", "Elena", "Fatima", "Georgia", "Hugo", "Ingrid", "Jonas", "Kavya",
  "Leila", "Marcus", "Naomi", "Oscar", "Paula", "Quentin", "Rosa", "Samir",
  "Tessa", "Uma", "Victor", "Wei", "Ximena", "Yusuf", "Zara", "Noah",
];
const LAST_NAMES = [
  "Okafor", "Silva", "Wang", "Haddad", "Mensah", "Rahman", "Costa", "Kim",
  "Petrov", "Iyer", "Asante", "Moreno", "Rossi", "Nowak", "Farouk", "Shah",
  "Duarte", "Lindqvist", "Aziz", "Tanaka", "Abebe", "Bauer", "Castillo", "Dang",
  "Eriksen", "Fernandes", "Garcia", "Hassan", "Ivanova", "Jensen", "Khan", "Lopez",
  "Morales", "Nguyen", "Oliveira", "Park", "Quispe", "Reyes", "Santos", "Torres",
  "Ueda", "Vargas", "Weber", "Yilmaz", "Zhou", "Banerjee", "Clarke", "Dubois",
];

const TEAM_NAMES = [
  "Harbor", "Lantern", "Compass", "Meridian", "Orchard", "Beacon",
  "Summit", "Willow", "Atlas", "Ember", "Tide", "Juniper",
  "Redwood", "Cypress", "Anchor", "Horizon", "Sequoia", "Marina",
  "Presidio", "Golden",
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
  { title: "Transit access guide", partner: "Bay Rides Coalition" },
  { title: "Shelter bed availability board", partner: "Oakland Open Door" },
  { title: "After-school tutor matching", partner: "Richmond Reads" },
  { title: "Small business grant finder", partner: "Fruitvale Merchants Group" },
  { title: "Community fridge tracker", partner: "Sunset Mutual Aid" },
  { title: "Wetlands volunteer log", partner: "Baylands Stewards" },
  { title: "Immigrant legal clinic intake", partner: "San Jose Legal Access" },
  { title: "Veteran benefits navigator", partner: "Marin Veterans Hub" },
];

/** The four interns who look after the teams and their partners. */
const INTERNS: StaffMember[] = [
  { id: "staff-maya", name: "Maya Lindgren", email: "maya.lindgren@example.org", role: "admin", jobTitle: "Intern" },
  { id: "staff-theo", name: "Theo Okonkwo", email: "theo.okonkwo@example.org", role: "admin", jobTitle: "Intern" },
  { id: "staff-lucia", name: "Lucia Ferrante", email: "lucia.ferrante@example.org", role: "admin", jobTitle: "Intern" },
  { id: "staff-jonah", name: "Jonah Reyes", email: "jonah.reyes@example.org", role: "admin", jobTitle: "Intern" },
];

/** Sample staff. With the backend on, the manager is whoever signed in. */
const STAFF: StaffMember[] = [
  { id: "staff-demo", name: "Demo Admin", email: "admin@demo.test", role: "manager", jobTitle: "Program coordinator" },
  ...INTERNS,
];

/** An even but shuffled split, the same on every load: index in PROJECTS -> intern. */
function internForEachTeam(count: number): StaffMember[] {
  const rand = mulberry32(7);
  const assigned = Array.from({ length: count }, (_, i) => INTERNS[i % INTERNS.length]);
  for (let i = assigned.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [assigned[i], assigned[j]] = [assigned[j], assigned[i]];
  }
  return assigned;
}

const CONTACT_NAMES = [
  "Maya Torres", "Daniel Osei", "Ruth Lindholm", "Imran Qureshi", "Lena Fischer",
  "Carlos Mendes", "Grace Adeyemi", "Hannah Cohen", "Minh Tran", "Sara Novak",
];

function buildPartners(interns: StaffMember[]): Partner[] {
  return PROJECTS.map((p, i) => {
    const slug = p.partner.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const name = CONTACT_NAMES[i % CONTACT_NAMES.length];
    return {
      id: `partner-${slug}`,
      programId: "prog-civic",
      name: p.partner,
      website: `https://${slug}.example.org`,
      ownerId: interns[i].id,
      contacts: [
        {
          id: `contact-${i + 1}`,
          name,
          title: "Program director",
          email: `${name.split(" ")[0].toLowerCase()}@${slug}.example.org`,
        },
      ],
    };
  });
}

const TEAM_SIZE = 6; // 20 teams, 120 participants

/**
 * Planted problems, by participant index. Matches the example in the project
 * proposal: on Monday of Week 5 the organizer should find exactly these.
 */
export const PLANTED = {
  missedLastWorkshop: [3, 17, 28, 44], // at risk
  missedTwoWorkshops: [11, 36], // missing
  // Two people swap teams, so team sizes stay at 6 but history has changes.
  teamSwap: [31, 13],
  teamMissingBrief: 9, // Ember: missing
  teamsResearchPlanPending: [3, 7, 10], // at risk (due soon)
};

/** Starting custom fields: generic ones most programs ask for. */
/** Each team has one of each, as the CCP handbook sets out. */
const GROUP_ROLES = [
  "Communication Manager",
  "Schedule Manager",
  "Project Timeline Manager",
  "Production Manager",
  "Team Manager",
  "Documentation Manager",
];

const FIELDS: FieldDefinition[] = [
  {
    id: "field-role",
    label: "Role",
    type: "select",
    options: [...GROUP_ROLES],
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

/** Where each team is based; everyone else is in San Francisco. */
const TEAM_LOCATIONS: Record<string, string> = {
  Marina: "Buenos Aires",
  Presidio: "Buenos Aires",
  Golden: "VSY",
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
  const startDate = "2026-09-07"; // Monday of Week 1

  const interns = internForEachTeam(PROJECTS.length);
  const partners = buildPartners(interns);
  const projects: Project[] = PROJECTS.map((p, i) => ({
    id: `proj-${i + 1}`,
    cohortId,
    title: p.title,
    partnerId: partners[i].id,
  }));

  const teams: Team[] = TEAM_NAMES.map((name, i) => ({
    id: `team-${i + 1}`,
    cohortId,
    name,
    projectId: projects[i].id,
    ownerId: interns[i].id,
  }));

  const people: Person[] = [];
  const enrollments: Enrollment[] = [];
  const memberships: TeamMembership[] = [];

  // Its own generator so names don't shift the attendance data below.
  const nameRand = mulberry32(2026);
  const nameFrom = <T,>(items: T[]) => items[Math.floor(nameRand() * items.length)];
  const usedNames = new Set<string>();
  function uniqueName(): [string, string] {
    for (;;) {
      const [first, last] = [nameFrom(FIRST_NAMES), nameFrom(LAST_NAMES)];
      if (usedNames.has(`${first} ${last}`)) continue;
      usedNames.add(`${first} ${last}`);
      return [first, last];
    }
  }

  let index = 0;
  teams.forEach((team) => {
    for (let k = 0; k < TEAM_SIZE; k++, index++) {
      const [first, last] = uniqueName();
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
        teamId: team.id,
        startDate,
      });
    }
  });

  const [swapA, swapB] = PLANTED.teamSwap.map((i) => enrollments[i].id);
  const swapTeam = (enrollmentId: string, teamId: string) => {
    memberships.find((m) => m.enrollmentId === enrollmentId)!.endDate = "2026-10-05";
    memberships.push({ enrollmentId, teamId, startDate: "2026-10-05" });
  };
  const teamOf = (enrollmentId: string) => memberships.find((m) => m.enrollmentId === enrollmentId)!.teamId;
  const [teamA, teamB] = [teamOf(swapA), teamOf(swapB)];
  swapTeam(swapA, teamB);
  swapTeam(swapB, teamA);

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
    ev("ev-1", "CCP Kick-Off", "all-hands", "2026-10-02", true, {
      startTime: "10:00",
      endTime: "13:00",
      location: "In person, San Francisco",
      host: "CCP team",
      description:
        "Introduction to CCP, your team and your project. Attendance at your session is required and no make-up work is available.\n\nM30s in San Francisco: in person, 10:00 am to 1:00 pm PT.\n\nGroups 22 and 23 (predominantly M30s in Buenos Aires): 7:00 to 9:00 am UTC, see the Google Calendar invitation.\n\nGroup 24 (most VSYs): 2:00 to 4:00 pm UTC, see the Google Calendar invitation.",
    }),
    ev("ev-2", "Workshop 1: Problem framing", "workshop", "2026-10-06", true, {
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
    ev("ev-3", "Workshop 2: User research", "workshop", "2026-10-13", true, {
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
    ev("ev-5", "Workshop 3: Prototyping", "workshop", "2026-10-15", true, {
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

  // The handbook's Fall 2026 timeline. All assignments are due at 11 pm PT, and
  // Forum closes one day after the due date.
  const milestone = (
    id: string,
    title: string,
    date: string,
    description: string,
    details?: Partial<ProgramEvent>,
  ): ProgramEvent => ({
    id,
    cohortId,
    title,
    category: "deadline",
    date,
    startTime: "23:00",
    location: "Forum",
    host: "CCP team",
    description,
    isRequired: true,
    checkinToken: `chk-${id}`,
    ...details,
  });
  // Deadlines are requirements (below), so they're checked and shown on the
  // calendar from there. The presentations are a real event.
  events.push(
    milestone(
      "ev-14",
      "Final Project Proposal Presentations",
      "2026-12-15",
      "A 10-minute presentation plus 5 minutes of Q&A with your Civic Partner and Faculty Grader. The schedule will be released closer to presentation time.\n\nPresentations are on Zoom, so you must be available with a reliable internet connection during your assigned time.",
      { category: "showcase", endDate: "2026-12-17", startTime: undefined, location: "Zoom" },
    ),
  );
  events.sort((a, b) => a.date.localeCompare(b.date));

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

  // The handbook's monthly Forum report: one per team, counted by its Month.
  // All assignments are due at 11 pm PT.
  const monthlyReport = (month: string, dueDate: string) => ({
    typeId: "rt-reports",
    viaFieldId: "rf-r-team",
    minCount: 1,
    dueDate,
    dateFieldId: "rf-r-date",
    filter: { fieldId: "rf-r-month", op: "is" as const, value: month },
    description: `One Forum submission per team covering the ${month} meetings with your partner, faculty grader and CCP TA: the date, a brief summary, who attended, and a photo or screenshot from each meeting.`,
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
    {
      id: "req-7",
      name: "September Meeting Report",
      scope: "team",
      type: "record_by",
      params: monthlyReport("September", "2026-10-05"),
    },
    { id: "req-8", name: "October Meeting Report", scope: "team", type: "record_by", params: monthlyReport("October", "2026-10-31") },
    {
      id: "req-9",
      name: "Research Synthesis",
      scope: "team",
      type: "complete_by",
      params: {
        dueDate: "2026-11-19",
        description:
          "Group assignment submitted to Forum as a single PDF, scored on #gapanalysis, #evidencebased and #professionalism. Hold your November meetings with your partner, faculty grader and TA before this assignment.",
      },
    },
    { id: "req-10", name: "November Meeting Report", scope: "team", type: "record_by", params: monthlyReport("November", "2026-11-30") },
    { id: "req-11", name: "December Meeting Report", scope: "team", type: "record_by", params: monthlyReport("December", "2026-12-14") },
    {
      id: "req-12",
      name: "Group and Individual Final Deliverable",
      scope: "team",
      type: "complete_by",
      params: {
        dueDate: "2026-12-18",
        description:
          "Group: Project Proposal and presentation materials. Individual: Teamwork Survey and HC Explanations.",
      },
    },
  ];

  const seatsTaken = new Map<string, number>();
  enrollments.forEach((enr) => {
    const teamId = memberships.find((m) => m.enrollmentId === enr.id && !m.endDate)!.teamId;
    const teamName = teams.find((t) => t.id === teamId)!.name;
    const seat = seatsTaken.get(teamId) ?? 0;
    seatsTaken.set(teamId, seat + 1);
    enr.fields = {
      "field-role": GROUP_ROLES[seat],
      "field-location": TEAM_LOCATIONS[teamName] ?? "San Francisco",
    };
  });

  const completions: Completion[] = [];
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
      endDate: "2026-12-18",
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
    partners,
    staff: STAFF.map((s) => ({ ...s })),
    notes: sampleNotes(teams, enrollments, partners),
    ...sampleRecords(cohortId, teams, memberships),
  };
}

/** A few notes with follow-ups, some already overdue on the demo's "today". */
function sampleNotes(teams: Team[], enrollments: Enrollment[], partners: Partner[]): Note[] {
  const note = (
    id: string,
    subjectType: Note["subjectType"],
    subjectId: string,
    createdAt: string,
    author: string,
    body: string,
    followUpDate?: string,
  ): Note => ({
    id: `note-${id}`,
    subjectType,
    subjectId,
    body,
    author,
    followUpDate,
    followUpDone: false,
    createdAt: `${createdAt}T16:00:00.000Z`,
  });
  return [
    note("1", "team", teams[PLANTED.teamMissingBrief].id, "2026-10-16", "Maya Lindgren",
      "Brief is late. They said the partner hasn't confirmed scope yet, so ask again on Monday.", "2026-10-19"),
    note("2", "participant", enrollments[PLANTED.missedTwoWorkshops[0]].id, "2026-10-15", "Demo Admin",
      "Missed two workshops. Emailed to ask if something's going on.", "2026-10-21"),
    note("3", "partner", partners[RECORD_PLANTED.teamOpenIssue].id, "2026-10-14", "Theo Okonkwo",
      "Main contact is leaving. Find out who takes over before the midpoint showcase.", "2026-10-16"),
    note("4", "team", teams[RECORD_PLANTED.teamNoMeetings].id, "2026-10-12", "Demo Admin",
      "No partner meetings logged yet. Check whether they're meeting and not logging it.", "2026-10-23"),
    note("5", "partner", partners[0].id, "2026-10-08", "Theo Okonkwo",
      "Happy with the team so far. Interested in taking another team next cohort."),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ---- Custom record types ----
// Three example types, set up the way an admin would through Customize, so the
// demo shows links, calculations, rules and a form working together.

export const RECORD_PLANTED = {
  /** Last partner meeting more than two weeks before "today". */
  teamsStaleMeetings: [2, 9],
  /** Never logged a partner meeting. */
  teamNoMeetings: 11,
  /** Has an open issue. */
  teamOpenIssue: 4,
  /** September report came in after the due date. */
  teamsLateReports: [6, 12, 17],
  /** Never sent the September report. */
  teamsMissingReports: [9, 15],
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
      { id: "rf-m-event", label: "Event", type: "link", linkTo: "event", required: false },
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
  {
    id: "rt-reports",
    programId: "prog-civic",
    name: "Meeting reports",
    singular: "Meeting report",
    fields: [
      { id: "rf-r-title", label: "Title", type: "text", required: true },
      { id: "rf-r-date", label: "Submitted on", type: "date", required: true },
      { id: "rf-r-team", label: "Team", type: "link", linkTo: "team", required: true },
      { id: "rf-r-link", label: "Report link", type: "url", required: false },
      {
        id: "rf-r-month",
        label: "Month",
        type: "select",
        required: true,
        options: ["September", "October", "November", "December"],
      },
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
  {
    id: "form-report",
    typeId: "rt-reports",
    title: "Submit a meeting report",
    description: "One per team, each month. Submitting it completes your team's report requirement.",
    fieldIds: ["rf-r-title", "rf-r-month", "rf-r-date", "rf-r-link"],
    token: "submit-report-demo",
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

  teams.forEach((team, i) => {
    if (RECORD_PLANTED.teamsMissingReports.includes(i)) return;
    const late = RECORD_PLANTED.teamsLateReports.includes(i);
    const date = late ? addDays("2026-10-07", i % 3) : addDays("2026-10-01", i % 4);
    add("rt-reports", date, {
      "rf-r-title": `${team.name} · September`,
      "rf-r-date": date,
      "rf-r-team": team.id,
      "rf-r-month": "September",
    });
  });

  return {
    recordTypes: RECORD_TYPES.map((t) => ({ ...t, fields: t.fields.map((f) => ({ ...f })) })),
    records,
    calculations: CALCULATIONS.map((c) => ({ ...c })),
    rules: RULES.map((r) => ({ ...r })),
    forms: FORMS.map((f) => ({ ...f })),
  };
}
