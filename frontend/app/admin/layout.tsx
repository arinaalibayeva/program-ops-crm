import { AppSidebar } from "@/components/app-sidebar";
import { CohortProvider } from "@/lib/store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CohortProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar />
        <main className="min-w-0 flex-1">
          {/* Fill the window; cap only on very wide screens so lines stay readable. */}
          <div className="mx-auto w-full max-w-[1800px] px-6 py-8 lg:px-10">{children}</div>
        </main>
      </div>
    </CohortProvider>
  );
}
