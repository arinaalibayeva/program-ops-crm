// Prototype: sample staff for the profile page's Your team section. Nothing here is
// saved yet; the signed-in admin is the "you" node, with their own details.

export interface StaffMember {
  id: string;
  name: string;
  title: string;
  /** What they look after, in a few words. */
  focus: string;
  email?: string;
  managerId?: string;
}

export const YOU = "you";

export const SAMPLE_STAFF: StaffMember[] = [
  {
    id: "dana",
    name: "Dana Whitfield",
    title: "Executive director",
    focus: "Strategy, funding and the board",
    email: "dana@example.org",
  },
  {
    id: "marcus",
    name: "Marcus Lee",
    title: "Director of programs",
    focus: "All cohort programs and their outcomes",
    email: "marcus@example.org",
    managerId: "dana",
  },
  {
    id: "jordan",
    name: "Jordan Ellis",
    title: "Partnerships manager",
    focus: "Partner organizations and project scoping",
    email: "jordan@example.org",
    managerId: "dana",
  },
  {
    id: "sam",
    name: "Sam Okoye",
    title: "Operations lead",
    focus: "Rooms, budgets and tools",
    email: "sam@example.org",
    managerId: "dana",
  },
  {
    id: YOU,
    name: "",
    title: "Program manager, Civic Projects",
    focus: "Runs the Civic Projects cohort",
    managerId: "marcus",
  },
  {
    id: "sofia",
    name: "Sofia Alvarez",
    title: "Program manager, Data Fellows",
    focus: "Runs the Data Fellows cohort",
    email: "sofia@example.org",
    managerId: "marcus",
  },
  {
    id: "priya",
    name: "Priya Nair",
    title: "Program coordinator",
    focus: "Events, check-ins and attendance",
    email: "priya@example.org",
    managerId: YOU,
  },
  {
    id: "tom",
    name: "Tom Becker",
    title: "Program coordinator",
    focus: "Onboarding and participant support",
    email: "tom@example.org",
    managerId: YOU,
  },
  {
    id: "yuki",
    name: "Yuki Tanaka",
    title: "Mentor lead",
    focus: "Matches mentors with teams",
    email: "yuki@example.org",
    managerId: YOU,
  },
];
