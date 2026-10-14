import { AppSidebar } from "@/components/app-sidebar";
import { CohortProvider } from "@/lib/store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CohortProvider>
      <div className="flex min-h-screen bg-muted/30">
        <AppSidebar />
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
        </main>
      </div>
    </CohortProvider>
  );
}
