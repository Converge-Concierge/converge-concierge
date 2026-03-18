import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Linkedin, Archive, RotateCcw, Eye, Send, CalendarDays } from "lucide-react";
import { categoryLabel, categoryBadgeClass } from "@/lib/categoryUtils";
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
  onSendSchedulingEmail?: (attendee: Attendee) => void;
  sendingEmailForId?: string | null;
  savedSessionCounts?: Record<string, number>;
  onViewAgenda?: (attendee: Attendee) => void;
}


export function AttendeesTable({ attendees, events, tab, isAdmin, onEdit, onView, onArchive, onReactivate, onDelete, onSendSchedulingEmail, sendingEmailForId, savedSessionCounts, onViewAgenda }: AttendeesTableProps) {
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
    <div className="rounded-xl border border-border/60 bg-card overflow-x-auto shadow-sm">
      <Table className="min-w-[1000px] table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <SortHead sortKey="lastName" sort={sort} onSort={toggle} className="w-[110px]">Last Name</SortHead>
            <SortHead sortKey="firstName" sort={sort} onSort={toggle} className="w-[100px]">First Name</SortHead>
            <SortHead sortKey="company" sort={sort} onSort={toggle} className="w-[130px]">Company</SortHead>
            <SortHead sortKey="title" sort={sort} onSort={toggle} className="w-[130px]">Title</SortHead>
            <SortHead sortKey="category" sort={sort} onSort={toggle} className="w-[120px]">Category</SortHead>
            <SortHead sortKey="email" sort={sort} onSort={toggle} className="w-[190px]">Email</SortHead>
            <SortHead sortKey="event" sort={sort} onSort={toggle} className="w-[110px]">Assigned Event</SortHead>
            <SortHead sortKey="added" sort={sort} onSort={toggle} className="w-[100px]">Added</SortHead>
            <TableHead className="text-right w-[210px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((attendee) => (
            <TableRow key={attendee.id} data-testid={`row-attendee-${attendee.id}`} className={cn(tab === "archived" ? "opacity-70" : "")}>
              <TableCell className="max-w-[110px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-medium truncate">{attendee.lastName || attendee.name?.split(" ").slice(1).join(" ") || "—"}</span>
                  {attendee.linkedinUrl && (
                    <a
                      href={attendee.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-blue-500 hover:text-blue-700 transition-colors shrink-0"
                      title="LinkedIn Profile"
                      data-testid={`link-linkedin-${attendee.id}`}
                    >
                      <Linkedin className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium max-w-[100px] truncate">{attendee.firstName || attendee.name?.split(" ")[0] || "—"}</TableCell>
              <TableCell className="max-w-[130px]"><div className="truncate" title={attendee.company}>{attendee.company}</div></TableCell>
              <TableCell className="max-w-[130px]"><div className="truncate" title={attendee.title ?? ""}>{attendee.title}</div></TableCell>
              <TableCell>
                {attendee.attendeeCategory ? (
                  <Badge variant="outline" className={cn("text-[10px] font-medium", categoryBadgeClass(attendee.attendeeCategory))} data-testid={`badge-category-${attendee.id}`}>
                    {categoryLabel(attendee.attendeeCategory)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs italic">Unmapped</span>
                )}
              </TableCell>
              <TableCell className="max-w-[190px]"><div className="truncate text-muted-foreground text-sm" title={attendee.email}>{attendee.email}</div></TableCell>
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
              <TableCell className="text-right w-[200px] min-w-[200px]">
                <div className="flex justify-end gap-1 flex-nowrap">
                  {tab === "active" ? (
                    <>
                      <Button variant="ghost" size="icon" title="View attendee details" onClick={() => onView(attendee)} data-testid={`view-attendee-${attendee.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {onViewAgenda && (() => {
                        const count = savedSessionCounts?.[attendee.id] ?? 0;
                        return (
                          <div className="relative inline-flex">
                            <Button
                              variant="ghost"
                              size="icon"
                              title={count > 0 ? `View My Agenda (${count} session${count !== 1 ? "s" : ""})` : "No saved sessions"}
                              onClick={() => count > 0 && onViewAgenda(attendee)}
                              disabled={count === 0}
                              className={cn(count > 0 ? "text-accent hover:text-accent/80" : "text-muted-foreground/30 cursor-not-allowed")}
                              data-testid={`view-agenda-${attendee.id}`}
                            >
                              <CalendarDays className="h-4 w-4" />
                            </Button>
                            {count > 0 && (
                              <span className="absolute -top-1 -right-1 bg-accent text-white text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center leading-none" data-testid={`badge-session-count-${attendee.id}`}>
                                {count > 9 ? "9+" : count}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <Button variant="ghost" size="icon" title="Edit attendee" onClick={() => onEdit(attendee)} data-testid={`edit-attendee-${attendee.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {onSendSchedulingEmail && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title={attendee.email ? "Send scheduling email" : "Attendee email required"}
                          onClick={() => attendee.email && onSendSchedulingEmail(attendee)}
                          disabled={!attendee.email || sendingEmailForId === attendee.id}
                          className={cn(
                            attendee.email ? "text-teal-600 hover:text-teal-700" : "text-muted-foreground/40 cursor-not-allowed"
                          )}
                          data-testid={`send-scheduling-email-${attendee.id}`}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
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
