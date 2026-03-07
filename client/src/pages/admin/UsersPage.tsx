import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Search, Edit, Trash2, UserCog, ShieldCheck, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface InternalUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "manager";
  isActive: boolean;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: "admin" | "manager";
  isActive: boolean;
}

const BLANK_FORM: UserFormState = { name: "", email: "", password: "", role: "manager", isActive: true };

const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<InternalUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<InternalUser | null>(null);
  const [form, setForm] = useState<UserFormState>(BLANK_FORM);
  const [formError, setFormError] = useState("");

  const { data: users = [], isLoading } = useQuery<InternalUser[]>({
    queryKey: ["/api/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserFormState) => {
      const res = await apiRequest("POST", "/api/users", data);
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created", description: `${form.name} has been added.` });
      setModalOpen(false);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormState> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
      setModalOpen(false);
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/users/${id}`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted" });
      setDeletingUser(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingUser(null);
    setForm(BLANK_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(u: InternalUser) {
    setEditingUser(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, isActive: u.isActive });
    setFormError("");
    setModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (editingUser) {
      const patch: Partial<UserFormState> = { name: form.name, email: form.email, role: form.role, isActive: form.isActive };
      if (form.password) patch.password = form.password;
      updateMutation.mutate({ id: editingUser.id, data: patch });
    } else {
      if (!form.password) { setFormError("Password is required"); return; }
      createMutation.mutate(form);
    }
  }

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <UserCog className="h-7 w-7 text-accent" /> Users
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Manage internal platform users and their roles.</p>
        </div>
        <Button
          className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20"
          onClick={openCreate}
          data-testid="button-add-user"
        >
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email…"
            className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-users"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`} className={cn(!u.isActive ? "opacity-60" : "")}>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted border border-border/60 flex items-center justify-center shrink-0">
                        {u.role === "admin"
                          ? <ShieldCheck className="h-4 w-4 text-accent" />
                          : <UserIcon className="h-4 w-4 text-muted-foreground" />
                        }
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{u.name}</p>
                        {u.id === currentUser?.id && (
                          <span className="text-[10px] text-accent font-semibold">You</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm py-3">{u.email}</TableCell>
                  <TableCell className="py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-semibold",
                        u.role === "admin"
                          ? "bg-accent/10 border-accent/30 text-accent"
                          : "bg-muted border-border text-muted-foreground",
                      )}
                    >
                      {u.role === "admin" ? <ShieldCheck className="h-3 w-3 mr-1" /> : <UserIcon className="h-3 w-3 mr-1" />}
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant={u.isActive ? "default" : "secondary"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-3">
                    <div className="flex justify-end items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeletingUser(u)}
                        disabled={u.id === currentUser?.id}
                        data-testid={`delete-user-${u.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <UserCog className="h-6 w-6 opacity-30" />
                      <p className="text-sm">No users found.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add User"}</DialogTitle>
          </DialogHeader>
          <form id="user-form" onSubmit={handleSubmit} className="space-y-4 py-1">
            {formError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{formError}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="u-name">Full Name <span className="text-destructive">*</span></Label>
              <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Jane Smith" data-testid="input-user-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-email">Work Email <span className="text-destructive">*</span></Label>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required placeholder="jane@converge.com" data-testid="input-user-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="u-password">{editingUser ? "New Password" : "Password"} {!editingUser && <span className="text-destructive">*</span>}</Label>
              <Input id="u-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={editingUser ? "Leave blank to keep current" : "••••••••"} data-testid="input-user-password" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="u-role">Role <span className="text-destructive">*</span></Label>
                <select id="u-role" className={selectClass} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "manager" })} data-testid="select-user-role">
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-status">Status</Label>
                <select id="u-status" className={selectClass} value={form.isActive ? "active" : "inactive"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })} data-testid="select-user-status">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </form>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={isPending}>Cancel</Button>
            <Button type="submit" form="user-form" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={isPending} data-testid="button-submit-user">
              {isPending ? "Saving…" : editingUser ? "Update User" : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingUser} onOpenChange={(o) => !o && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingUser?.name}</strong> ({deletingUser?.email}). They will immediately lose access. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-user"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
