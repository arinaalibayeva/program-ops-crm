"use client";

import { DeadlineList } from "@/components/deadline-list";
import { PageHeader } from "@/components/page-header";

export default function DeadlinesPage() {
  return (
    <>
      <PageHeader
        title="Deadlines"
        description="Assignment and report due dates. They show on the calendar automatically."
      />
      <DeadlineList />
    </>
  );
}
