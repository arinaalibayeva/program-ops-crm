"use client";

import { MiniCalendar } from "@/components/mini-calendar";
import { MyListCard } from "@/components/today-cards";
import { PageHeader } from "@/components/page-header";
import { TermProgress } from "@/components/today/term-progress";
import { Agenda } from "@/components/today/agenda";
import { Attention } from "@/components/today/attention";
import { Interns } from "@/components/today/interns";
import { useCohort } from "@/lib/store";
import { followUpsOf } from "@/lib/notes";
import { usePersonalItems } from "@/lib/personal";
import { useProfile } from "@/lib/profile";

export default function DashboardPage() {
  const { data } = useCohort();
  const { profile } = useProfile();
  const personal = usePersonalItems();
  const followUps = followUpsOf(data);

  return (
    <>
      <PageHeader
        title={profile ? `Hi, ${profile.name.split(" ")[0]}` : "Hi"}
      />

      {/*
        The people you manage, then what needs a decision and what's coming;
        your calendar, list and charts on the right. Both columns end on the
        same line. Below xl the right column becomes a row of cards under the rest.
      */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <Interns />
          {/*
            On wide screens the right column sets the height and these two
            fill it exactly, scrolling inside when there's more.
          */}
          <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:min-h-[24rem]">
            <div className="relative min-w-0">
              <Attention className="xl:absolute xl:inset-0 xl:overflow-y-auto" />
            </div>
            <div className="relative min-w-0">
              <Agenda className="xl:absolute xl:inset-0 xl:overflow-y-auto" />
            </div>
          </div>
        </div>
        <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:flex xl:flex-col">
          <MiniCalendar />
          <MyListCard
            personal={personal}
            followUps={followUps}
            className="xl:flex-1"
          />
          <TermProgress />
        </div>
      </div>
    </>
  );
}
