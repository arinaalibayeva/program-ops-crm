"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { useCohort } from "@/lib/store";
import { activeMembers } from "@/lib/requirements";

export default function PartnersPage() {
  const { data, teamStatuses } = useCohort();
  const projects = data.projects
    .filter((p) => p.partner)
    .sort((a, b) => a.partner!.localeCompare(b.partner!));

  return (
    <>
      <PageHeader
        title="Partners"
        description={`${projects.length} partner organizations working with teams in ${data.cohort.name}`}
      />
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Partner</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="pr-4">Team status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const teams = data.teams.filter((t) => t.projectId === project.id);
              return (
                <TableRow key={project.id}>
                  <TableCell className="pl-4 font-medium">{project.partner}</TableCell>
                  <TableCell>{project.title}</TableCell>
                  <TableCell>
                    {teams.length === 0 ? (
                      <span className="text-muted-foreground">No team yet</span>
                    ) : (
                      teams.map((team) => (
                        <div key={team.id}>
                          <Link href={`/admin/teams/${team.id}`} className="hover:underline">
                            Team {team.name}
                          </Link>
                          <span className="text-muted-foreground">
                            {" "}
                            · {activeMembers(data, team.id).length} members
                          </span>
                        </div>
                      ))
                    )}
                  </TableCell>
                  <TableCell className="pr-4">
                    {teams.map((team) => {
                      const status = teamStatuses.get(team.id);
                      return status ? (
                        <StatusBadge key={team.id} status={status.status} overall />
                      ) : null;
                    })}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
