import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Mail,
  Star,
  Trash2,
  Plus,
  Loader2,
  UserPlus,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Shield,
} from "lucide-react";
import { Sponsor, SponsorUser } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

interface SponsorUsersModalProps {
  sponsor: Sponsor | null;
  open: boolean;
  onClose: () => void;
}

const sponsorUserFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
  accessLevel: z.enum(["owner", "editor", "viewer"]),
  isPrimary: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type SponsorUserFormValues = z.infer<typeof sponsorUserFormSchema>;

export function SponsorUsersModal({ sponsor, open, onClose }: SponsorUsersModalProps) {
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<SponsorUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SponsorUser | null>(null);

  const { data: users = [], isLoading } = useQuery<SponsorUser[]>({
    queryKey: ["/api/admin/sponsors", sponsor?.id, "users"],
    enabled: !!sponsor && open,
  });

  const form = useForm<SponsorUserFormValues>({
    resolver: zodResolver(sponsorUserFormSchema),
    defaultValues: {
      name: "",
      email: "",
      accessLevel: "owner",
      isPrimary: false,
      isActive: true,
    },
  });

  const resetForm = () => {
    setEditingUser(null);
    form.reset({
      name: "",
      email: "",
      accessLevel: "owner",
      isPrimary: false,
      isActive: true,
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: SponsorUserFormValues) => {
      const res = await apiRequest("POST", `/api/admin/sponsors/${sponsor?.id}/users`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsors", sponsor?.id, "users"] });
      toast({ title: "User added successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to add user", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SponsorUserFormValues) => {
      const res = await apiRequest("PATCH", `/api/admin/sponsors/${sponsor?.id}/users/${editingUser?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsors", sponsor?.id, "users"] });
      toast({ title: "User updated successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update user", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("DELETE", `/api/admin/sponsors/${sponsor?.id}/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsors", sponsor?.id, "users"] });
      toast({ title: "User removed successfully" });
      setDeletingUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to remove user", variant: "destructive" });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("POST", `/api/admin/sponsors/${sponsor?.id}/users/${userId}/send-access-email`);
    },
    onSuccess: () => {
      toast({ title: "Access email sent" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to send email", variant: "destructive" });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest("PATCH", `/api/admin/sponsors/${sponsor?.id}/users/${userId}`, { isPrimary: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsors", sponsor?.id, "users"] });
      toast({ title: "Primary user updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to set primary user", variant: "destructive" });
    },
  });

  const onSubmit = (data: SponsorUserFormValues) => {
    if (editingUser) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (user: SponsorUser) => {
    setEditingUser(user);
    form.reset({
      name: user.name,
      email: user.email,
      accessLevel: user.accessLevel as any,
      isPrimary: user.isPrimary,
      isActive: user.isActive,
    });
  };

  const getAccessLevelBadge = (level: string) => {
    switch (level) {
      case "owner":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100"><ShieldCheck className="w-3 h-3 mr-1" /> Owner</Badge>;
      case "editor":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100"><Shield className="w-3 h-3 mr-1" /> Editor</Badge>;
      default:
        return <Badge variant="secondary" className="hover:bg-secondary"><ShieldAlert className="w-3 h-3 mr-1" /> Viewer</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sponsor Users</DialogTitle>
            <DialogDescription>
              Manage users who can access the dashboard for <span className="font-semibold text-foreground">{sponsor?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Access Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No users yet. Add the first user below.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{user.name}</span>
                            {user.isPrimary && (
                              <Badge variant="outline" className="text-[10px] uppercase tracking-wider py-0 px-1.5 h-4 bg-amber-50 text-amber-700 border-amber-200">
                                Primary
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell>{getAccessLevelBadge(user.accessLevel)}</TableCell>
                        <TableCell>
                          {user.isActive ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground bg-muted">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit User"
                              onClick={() => handleEdit(user)}
                              data-testid={`btn-edit-user-${user.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Send Access Email"
                              onClick={() => sendEmailMutation.mutate(user.id)}
                              disabled={sendEmailMutation.isPending}
                              data-testid={`btn-send-email-${user.id}`}
                            >
                              {sendEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                            </Button>
                            {!user.isPrimary && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Set as Primary"
                                onClick={() => setPrimaryMutation.mutate(user.id)}
                                disabled={setPrimaryMutation.isPending}
                                data-testid={`btn-set-primary-${user.id}`}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Remove User"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingUser(user)}
                              data-testid={`btn-delete-user-${user.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                {editingUser ? <><Edit className="w-4 h-4" /> Edit User</> : <><UserPlus className="w-4 h-4" /> Add New User</>}
              </h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John Doe" {...field} data-testid="input-user-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="john@example.com" {...field} data-testid="input-user-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="accessLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Access Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-access-level">
                                <SelectValue placeholder="Select level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="owner">Owner</SelectItem>
                              <SelectItem value="editor">Editor</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end gap-4 pb-2">
                      <FormField
                        control={form.control}
                        name="isPrimary"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-is-primary"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Primary User
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-is-active"
                              />
                            </FormControl>
                            <FormLabel className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                              Active
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormDescription className="text-xs italic">
                    Only Primary Owners can export sponsor data and download reports.
                  </FormDescription>

                  <div className="flex justify-end gap-2 pt-2">
                    {editingUser && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetForm}
                        data-testid="button-cancel-edit"
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      type="submit"
                      disabled={createMutation.isPending || updateMutation.isPending}
                      data-testid="button-save-user"
                    >
                      {(createMutation.isPending || updateMutation.isPending) && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {editingUser ? "Save Changes" : "Save User"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingUser} onOpenChange={(val) => !val && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to remove this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access for <span className="font-semibold text-foreground">{deletingUser?.name}</span> to the sponsor dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-user"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
