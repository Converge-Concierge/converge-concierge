import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Linkedin, Archive, RotateCcw, Eye } from "lucide-react";
import { Attendee, Event } from "@shared/schema";
import { SortHead, useSortState, sortData } from "@/hooks/use-sort";
import { cn } from "@/lib/utils";

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

export function AttendeesTable({ attendees, events, tab, isAdmin, onEdit, onView, onArchive, onReactivate, onDelete }: AttendeesTableProps) {
  const { sort, toggle } = useSortState("name");

  const getEvent = (id: string) => events.find((e) => e.id === id);

  const getValue = (a: Attendee, key: string): string => {
    if (key === "name") return a.name;
    if (key === "company") return a.company;
    if (key === "title") return a.title;
    if (key === "email") return a.email;
    if (key === "event") return getEvent(a.assignedEvent)?.slug ?? "";
    return "";
  };

  const sorted = sortData(attendees, sort, getValue);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <SortHead sortKey="name" sort={sort} onSort={toggle}>Name</SortHead>
            <SortHead sortKey="company" sort={sort} onSort={toggle}>Company</SortHead>
            <SortHead sortKey="title" sort={sort} onSort={toggle}>Title</SortHead>
            <SortHead sortKey="email" sort={sort} onSort={toggle}>Email</SortHead>
            <SortHead sortKey="event" sort={sort} onSort={toggle}>Assigned Event</SortHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((attendee) => (
            <TableRow key={attendee.id} data-testid={`row-attendee-${attendee.id}`} className={cn(tab === "archived" ? "opacity-70" : "")}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{attendee.name}</span>
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
              <TableCell>{attendee.company}</TableCell>
              <TableCell>{attendee.title}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{attendee.email}</TableCell>
              <TableCell>
                {getEvent(attendee.assignedEvent) ? (
                  <Badge variant="outline" className="text-xs font-mono">{getEvent(attendee.assignedEvent)!.slug}</Badge>
                ) : (
                  <span className="text-muted-foreground italic text-xs">Unknown</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  {tab === "active" ? (
                    <>
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
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {tab === "active" ? "No active attendees." : "No archived attendees."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
