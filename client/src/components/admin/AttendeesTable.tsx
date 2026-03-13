import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Linkedin, Archive, RotateCcw, Eye } from "lucide-react";
import { Attendee, Event } from "@shared/schema";
import { SortHead, useSortState, sortData } from "@/hooks/use-sort";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface AttendeesTableProps {
  attendees: Attendee[];
  events: Event[];
  tab: "active" | "archived";
  isAdmin: boolean;
  onEdit: (attendee: Attendee) => void;
  onView: (attendee: Attendee) => void;
  onArchive: (attendee: Attendee) => void;
  onReactivate: (attendee: Attendee) => void;
  onDelete: (attendee: Attendee) => void;
}

function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return "—";
  switch (cat) {
    case "PRACTITIONER": return "Practitioner";
    case "GOVERNMENT_NONPROFIT": return "Gov / Non-Profit";
    case "SOLUTION_PROVIDER": return "Solution Provider";
    default: return cat;
  }
}

function categoryBadgeClass(cat: string | null | undefined): string {
  switch (cat) {
    case "PRACTITIONER": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "GOVERNMENT_NONPROFIT": return "bg-blue-100 text-blue-800 border-blue-200";
    case "SOLUTION_PROVIDER": return "bg-amber-100 text-amber-800 border-amber-200";
    default: return "bg-gray-100 text-gray-500 border-gray-200";
  }
}

export function AttendeesTable({ attendees, events, tab, isAdmin, onEdit, onView, onArchive, onReactivate, onDelete }: AttendeesTableProps) {
  const { sort, toggle } = useSortState("added", "desc");

  const getEvent = (id: string) => events.find((e) => e.id === id);

  const getValue = (a: Attendee, key: string): string | number => {
    if (key === "lastName") return a.lastName || a.name?.split(" ").slice(1).join(" ") || "";
    if (key === "firstName") return a.firstName || a.name?.split(" ")[0] || "";
    if (key === "name") return a.name;
    if (key === "company") return a.company;
    if (key === "title") return a.title;
    if (key === "email") return a.email;
    if (key === "category") return a.attendeeCategory || "";
    if (key === "event") return getEvent(a.assignedEvent)?.slug ?? "";
    if (key === "added") return new Date(a.createdAt).getTime();
    return "";
  };

  const sorted = sortData(attendees, sort, getValue);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <SortHead sortKey="lastName" sort={sort} onSort={toggle}>Last Name</SortHead>
            <SortHead sortKey="firstName" sort={sort} onSort={toggle}>First Name</SortHead>
            <SortHead sortKey="company" sort={sort} onSort={toggle}>Company</SortHead>
            <SortHead sortKey="title" sort={sort} onSort={toggle}>Title</SortHead>
            <SortHead sortKey="category" sort={sort} onSort={toggle}>Category</SortHead>
            <SortHead sortKey="email" sort={sort} onSort={toggle}>Email</SortHead>
            <SortHead sortKey="event" sort={sort} onSort={toggle}>Assigned Event</SortHead>
            <SortHead sortKey="added" sort={sort} onSort={toggle}>Added</SortHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((attendee) => (
            <TableRow key={attendee.id} data-testid={`row-attendee-${attendee.id}`} className={cn(tab === "archived" ? "opacity-70" : "")}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{attendee.lastName || attendee.name?.split(" ").slice(1).join(" ") || "—"}</span>
                  {attendee.linkedinUrl && (
                    <a
                      href={attendee.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-500 hover:text-blue-700 transition-colors"
                      title="LinkedIn Profile"
                      data-testid={`link-linkedin-${attendee.id}`}
                    >
                      <Linkedin className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium">{attendee.firstName || attendee.name?.split(" ")[0] || "—"}</TableCell>
              <TableCell>{attendee.company}</TableCell>
              <TableCell>{attendee.title}</TableCell>
              <TableCell>
                {attendee.attendeeCategory ? (
                  <Badge variant="outline" className={cn("text-[10px] font-medium", categoryBadgeClass(attendee.attendeeCategory))} data-testid={`badge-category-${attendee.id}`}>
                    {categoryLabel(attendee.attendeeCategory)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Unmapped</span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">{attendee.email}</TableCell>
              <TableCell>
                {getEvent(attendee.assignedEvent) ? (
                  <Badge variant="outline" className="text-xs font-mono">{getEvent(attendee.assignedEvent)!.slug}</Badge>
                ) : (
                  <span className="text-muted-foreground italic text-xs">Unknown</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(attendee.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {tab === "active" ? (
                    <>
                      <Button variant="ghost" size="icon" title="View attendee details" onClick={() => onView(attendee)} data-testid={`view-attendee-${attendee.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Edit attendee" onClick={() => onEdit(attendee)} data-testid={`edit-attendee-${attendee.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Archive attendee" onClick={() => onArchive(attendee)} data-testid={`archive-attendee-${attendee.id}`}>
                        <Archive className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete attendee" onClick={() => onDelete(attendee)} data-testid={`delete-attendee-${attendee.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" title="View attendee details" onClick={() => onView(attendee)} data-testid={`view-attendee-${attendee.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" title="Re-activate attendee" onClick={() => onReactivate(attendee)} className="text-green-600 hover:text-green-700" data-testid={`reactivate-attendee-${attendee.id}`}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete attendee" onClick={() => onDelete(attendee)} data-testid={`delete-attendee-archived-${attendee.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                {tab === "active" ? "No active attendees." : "No archived attendees."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
