import { redirect } from "next/navigation";

// Deadlines are requirements with a due date now; old links land there.
export default function DeadlinesPage() {
  redirect("/admin/requirements");
}
