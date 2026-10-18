import { NavDock } from "@/components/nav-dock";
import { SyncError } from "@/components/sync-error";
import { CohortProvider } from "@/lib/store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <CohortProvider>
      <div className="min-h-screen bg-background">
        {/* Edge to edge; the bottom padding keeps content clear of the dock. */}
        <main className="w-full px-4 pt-8 pb-32 sm:px-6 lg:px-10">{children}</main>
        <NavDock />
        <SyncError />
      </div>
    </CohortProvider>
  );
}
