import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Shield, 
  User as UserIcon, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  Save, 
  RotateCcw,
  LayoutDashboard,
  Calendar,
  Building2,
  Users,
  Handshake,
  BarChart3,
  ArrowLeftRight,
  Palette,
  Settings,
  Users2,
  Lock,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  type User, 
  type UserPermissions, 
  type PermissionAuditLog,
  DEFAULT_USER_PERMISSIONS 
} from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface UserWithPermissions extends User {
  permissionsUpdatedAt?: string;
  permissionsUpdatedBy?: string;
}

export default function AccessControlPage() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [localPermissions, setLocalPermissions] = useState<UserPermissions | null>(null);

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<UserWithPermissions[]>({
    queryKey: ["/api/users"],
  });

  const { data: userPermissions, isLoading: isLoadingPermissions } = useQuery<{ permissions: UserPermissions, updatedAt?: string, updatedBy?: string }>({
    queryKey: ["/api/admin/users", selectedUserId, "permissions"],
    enabled: !!selectedUserId,
  });

  const { data: auditLogs = [] } = useQuery<PermissionAuditLog[]>({
    queryKey: ["/api/admin/permission-audit-logs", { userId: selectedUserId }],
    enabled: true,
  });

  const updateMutation = useMutation({
    mutationFn: async (permissions: UserPermissions) => {
      const res = await apiRequest("PUT", `/api/admin/users/${selectedUserId}/permissions`, permissions);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUserId, "permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/permission-audit-logs"] });
      toast({ title: "Permissions updated", description: "Changes have been saved successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const selectedUser = users.find(u => u.id === selectedUserId);

  // Initialize local permissions when userPermissions loads
  if (userPermissions && !localPermissions && selectedUserId) {
    setLocalPermissions(userPermissions.permissions);
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUserId(userId);
    setLocalPermissions(null);
  };

  const handleToggle = (key: keyof UserPermissions) => {
    if (!localPermissions) return;
    setLocalPermissions({ ...localPermissions, [key]: !localPermissions[key] });
  };

  const handleReset = () => {
    setLocalPermissions(DEFAULT_USER_PERMISSIONS);
  };

  const handleSave = () => {
    if (localPermissions) {
      updateMutation.mutate(localPermissions);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const renderPermissionGroup = (title: string, icon: any, permissions: { key: keyof UserPermissions, label: string }[]) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon && <icon.type {...icon.props} className="h-4 w-4 text-accent" />}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {permissions.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between space-x-2 rounded-lg border p-3 bg-muted/30">
            <Label htmlFor={key} className="text-xs font-medium cursor-pointer">{label}</Label>
            <Switch 
              id={key} 
              checked={!!localPermissions?.[key]} 
              onCheckedChange={() => handleToggle(key)}
              disabled={selectedUser?.role === 'admin' || updateMutation.isPending}
              data-testid={`switch-permission-${key}`}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
          <Shield className="h-7 w-7 text-accent" /> Access Control
        </h1>
        <p className="text-muted-foreground text-sm">Manage granular permissions and access levels for platform users.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* User List Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden flex flex-col h-[700px]">
            <div className="p-4 border-b bg-muted/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-users"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="divide-y">
                {isLoadingUsers ? (
                  <div className="p-8 text-center text-muted-foreground italic">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground italic">No users found</div>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user.id)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1",
                        selectedUserId === user.id && "bg-accent/5 border-r-2 border-r-accent"
                      )}
                      data-testid={`button-select-user-${user.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm truncate">{user.name}</span>
                        <Badge variant={user.role === 'admin' ? "default" : "secondary"} className="text-[10px] h-4">
                          {user.role === 'admin' ? "Admin" : "Manager"}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={user.isActive ? "outline" : "destructive"} className="text-[9px] h-3 px-1">
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {user.permissionsUpdatedAt && (
                          <span className="text-[10px] text-muted-foreground italic">
                            Updated {format(new Date(user.permissionsUpdatedAt), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Permission Editor Panel */}
        <div className="lg:col-span-8">
          <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden flex flex-col h-[700px]">
            {!selectedUserId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <UserIcon className="h-12 w-12 opacity-20 mb-4" />
                <h3 className="font-semibold text-lg text-foreground">No User Selected</h3>
                <p className="max-w-xs mt-2">Select a user from the list on the left to view and manage their permissions.</p>
              </div>
            ) : selectedUser?.role === 'admin' ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                <ShieldCheck className="h-12 w-12 text-accent opacity-40 mb-4" />
                <h3 className="font-semibold text-lg text-foreground">Full Access (Admin)</h3>
                <p className="max-w-xs mt-2">Administrator users have all permissions enabled by default. These cannot be modified.</p>
                <Badge variant="outline" className="mt-4 bg-accent/5 text-accent border-accent/20">Read-Only View</Badge>
              </div>
            ) : isLoadingPermissions ? (
               <div className="flex-1 flex items-center justify-center">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
               </div>
            ) : (
              <>
                <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-lg">{selectedUser?.name}</h2>
                    <p className="text-xs text-muted-foreground">Manager Permissions</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset} disabled={updateMutation.isPending} data-testid="button-reset-permissions">
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                    </Button>
                    <Button size="sm" className="bg-accent hover:bg-accent/90" onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-permissions">
                      <Save className="h-3.5 w-3.5 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-10 pb-12">
                    {/* General Access */}
                    {renderPermissionGroup("General Access", <LayoutDashboard />, [
                      { key: "mod_dashboard", label: "Dashboard Module" },
                      { key: "mod_events", label: "Events Module" },
                      { key: "mod_sponsors", label: "Sponsors Module" },
                      { key: "mod_attendees", label: "Attendees Module" },
                      { key: "mod_meetings", label: "Meetings Module" },
                      { key: "mod_reports", label: "Reports Module" },
                      { key: "mod_dataExchange", label: "Data Exchange Module" },
                      { key: "mod_branding", label: "Branding Module" },
                      { key: "mod_settings", label: "Settings Module" },
                      { key: "mod_users", label: "Users Module" },
                    ])}

                    <Separator />

                    {/* Events */}
                    {renderPermissionGroup("Events Actions", <Calendar />, [
                      { key: "ev_create", label: "Create Events" },
                      { key: "ev_edit", label: "Edit Events" },
                      { key: "ev_archive", label: "Archive Events" },
                      { key: "ev_delete", label: "Delete Events" },
                      { key: "ev_copy", label: "Copy Events" },
                      { key: "ev_editMeetingBlocks", label: "Edit Meeting Blocks" },
                      { key: "ev_toggleScheduling", label: "Toggle Scheduling" },
                    ])}

                    <Separator />

                    {/* Sponsors */}
                    {renderPermissionGroup("Sponsors Actions", <Building2 />, [
                      { key: "sp_create", label: "Create Sponsors" },
                      { key: "sp_edit", label: "Edit Sponsors" },
                      { key: "sp_archive", label: "Archive Sponsors" },
                      { key: "sp_delete", label: "Delete Sponsors" },
                      { key: "sp_copy", label: "Copy Sponsors" },
                      { key: "sp_export", label: "Export Sponsors" },
                      { key: "sp_import", label: "Import Sponsors" },
                    ])}

                    <Separator />

                    {/* Attendees */}
                    {renderPermissionGroup("Attendees Actions", <Users />, [
                      { key: "at_create", label: "Create Attendees" },
                      { key: "at_edit", label: "Edit Attendees" },
                      { key: "at_archive", label: "Archive Attendees" },
                      { key: "at_delete", label: "Delete Attendees" },
                      { key: "at_export", label: "Export Attendees" },
                      { key: "at_import", label: "Import Attendees" },
                      { key: "at_viewDetail", label: "View Full Detail" },
                      { key: "at_viewContacts", label: "View Contact Info" },
                      { key: "at_viewInterests", label: "View Interests" },
                    ])}

                    <Separator />

                    {/* Meetings */}
                    {renderPermissionGroup("Meetings Actions", <Handshake />, [
                      { key: "mt_create", label: "Create Meetings" },
                      { key: "mt_edit", label: "Edit Meetings" },
                      { key: "mt_cancel", label: "Cancel Meetings" },
                      { key: "mt_delete", label: "Delete Meetings" },
                      { key: "mt_export", label: "Export Meetings" },
                      { key: "mt_import", label: "Import Meetings" },
                      { key: "mt_approvePending", label: "Approve Pending" },
                      { key: "mt_nunifySync", label: "Nunify Sync" },
                    ])}

                    <Separator />

                    {/* Reports */}
                    {renderPermissionGroup("Reports Actions", <BarChart3 />, [
                      { key: "rp_view", label: "View Reports" },
                      { key: "rp_export", label: "Export Reports" },
                      { key: "rp_viewContactData", label: "View Contact Data" },
                    ])}

                    <Separator />

                    {/* Data Exchange */}
                    {renderPermissionGroup("Data Exchange Actions", <ArrowLeftRight />, [
                      { key: "de_exportSponsors", label: "Export Sponsors" },
                      { key: "de_exportAttendees", label: "Export Attendees" },
                      { key: "de_exportMeetings", label: "Export Meetings" },
                      { key: "de_importSponsors", label: "Import Sponsors" },
                      { key: "de_importAttendees", label: "Import Attendees" },
                      { key: "de_importMeetings", label: "Import Meetings" },
                      { key: "de_nunify", label: "Nunify Import/Export" },
                      { key: "de_viewHistory", label: "View History" },
                    ])}

                    <Separator />

                    {/* Branding & Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {renderPermissionGroup("Branding", <Palette />, [
                        { key: "br_edit", label: "Edit Branding" },
                      ])}
                      {renderPermissionGroup("Settings", <Settings />, [
                        { key: "st_edit", label: "Edit Settings" },
                      ])}
                    </div>

                    <Separator />

                    {/* Users */}
                    {renderPermissionGroup("Users Actions", <Users2 />, [
                      { key: "us_create", label: "Create Users" },
                      { key: "us_edit", label: "Edit Users" },
                      { key: "us_deactivate", label: "Deactivate Users" },
                      { key: "us_resetPassword", label: "Reset Passwords" },
                      { key: "us_managePermissions", label: "Manage Permissions" },
                    ])}

                    <Separator />

                    {/* Sensitive Data */}
                    {renderPermissionGroup("Sensitive Data", <Lock />, [
                      { key: "data_viewAttendeeEmails", label: "View Attendee Emails" },
                      { key: "data_viewAttendeePhones", label: "View Attendee Phones" },
                      { key: "data_viewSponsorContacts", label: "View Sponsor Contacts" },
                      { key: "data_exportContacts", label: "Export Contact Info" },
                    ])}

                    <Separator />

                    {/* Account Controls */}
                    {renderPermissionGroup("Account Controls", <Settings />, [
                      { key: "account_canSignIn", label: "Can Sign In" },
                      { key: "account_requirePasswordReset", label: "Require Password Reset" },
                    ])}

                    <div className="pt-4 text-xs text-muted-foreground italic">
                      {userPermissions?.updatedAt ? (
                        <p>Last updated by {userPermissions.updatedBy || "System"} on {format(new Date(userPermissions.updatedAt), "PPP p")}</p>
                      ) : (
                        <p>No permission update history available.</p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-accent" />
            <h2 className="font-bold">Permission Audit Log</h2>
          </div>
          {selectedUserId && (
            <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20">
              Filtered by User
            </Badge>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/10">
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Target User</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Old Value</TableHead>
                <TableHead>New Value</TableHead>
                <TableHead>Changed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                    No audit logs found.
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map((log) => (
                  <TableRow key={log.id} className="text-xs">
                    <TableCell className="font-medium">
                      {format(new Date(log.changedAt), "MMM d, HH:mm:ss")}
                    </TableCell>
                    <TableCell>{log.targetUserName}</TableCell>
                    <TableCell className="font-mono text-[10px]">{log.field}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] h-4", log.oldValue === "true" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                        {log.oldValue}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] h-4", log.newValue === "true" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                        {log.newValue}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{log.changedBy}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </motion.div>
  );
}
