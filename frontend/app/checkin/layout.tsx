import { USE_BACKEND } from "@/lib/api";
import { CohortProvider } from "@/lib/store";

// Public pages for participants: no admin navigation. With the backend on,
// they only load the one event, never the cohort.
export default function CheckinLayout({ children }: { children: React.ReactNode }) {
  const page = <div className="min-h-screen bg-background">{children}</div>;
  return USE_BACKEND ? page : <CohortProvider>{page}</CohortProvider>;
}
