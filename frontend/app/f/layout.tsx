import { USE_BACKEND } from "@/lib/api";
import { CohortProvider } from "@/lib/store";

// Public forms: no admin navigation. With the backend on, they only load the
// one form, never the cohort.
export default function FormLayout({ children }: { children: React.ReactNode }) {
  const page = <div className="min-h-screen bg-background">{children}</div>;
  return USE_BACKEND ? page : <CohortProvider>{page}</CohortProvider>;
}
