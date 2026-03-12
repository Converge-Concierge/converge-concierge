import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import {
  ArrowLeft, Save, Copy, Archive, Plus, Pencil, Trash2, GripVertical,
  ChevronDown, ChevronRight, Gem, CheckCircle2, Eye, EyeOff, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DELIVERABLE_CATEGORIES, DELIVERABLE_OWNER_TYPES, DELIVERABLE_FULFILLMENT_TYPES, DELIVERABLE_DUE_TIMING_TYPES,
  type PackageTemplate, type DeliverableTemplateItem,
} from "@shared/schema";

type TemplateDetail = PackageTemplate & { items: DeliverableTemplateItem[] };

type ItemForm = {
  deliverableName: string;
  deliverableDescription: string;
  category: string;
  defaultQuantity: string;
  quantityUnit: string;
  ownerType: string;
  sponsorEditable: boolean;
  sponsorVisible: boolean;
  fulfillmentType: string;
  reminderEligible: boolean;
  dueTiming: string;
  dueOffsetDays: string;
  displayOrder: string;
  sponsorFacingNote: string;
  helpTitle: string;
  helpText: string;
  helpLink: string;
};

const emptyItemForm = (): ItemForm => ({
  deliverableName: "",
  deliverableDescription: "",
  category: "Company Profile",
  defaultQuantity: "",
  quantityUnit: "",
  ownerType: "Converge",
  sponsorEditable: false,
  sponsorVisible: true,
  fulfillmentType: "status_only",
  reminderEligible: false,
  dueTiming: "not_applicable",
  dueOffsetDays: "",
  displayOrder: "0",
  sponsorFacingNote: "",
  helpTitle: "",
  helpText: "",
  helpLink: "",
});

const FULFILLMENT_LABELS: Record<string, string> = {
  status_only: "Status Only",
  file_upload: "File Upload",
  link_proof: "Link Proof",
  quantity_progress: "Qty Progress",
  mixed: "Mixed",
};

const DUE_LABELS: Record<string, string> = {
  before_event: "Before Event",
  during_event: "During Event",
  after_event: "After Event",
  specific_date: "Specific Date",
  not_applicable: "N/A",
};

const LEVEL_COLORS: Record<string, string> = {
  Platinum: "bg-slate-100 text-slate-700",
  Gold:     "bg-amber-50 text-amber-700",
  Silver:   "bg-gray-100 text-gray-600",
  Bronze:   "bg-orange-50 text-orange-700",
};

export default function PackageTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [, nav] = useLocation();
  const { toast } = useToast();

  const [editingHeader, setEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState("");
  const [headerDesc, setHeaderDesc] = useState("");
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<DeliverableTemplateItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(DELIVERABLE_CATEGORIES));

  const { data: template, isLoading } = useQuery<TemplateDetail>({
    queryKey: ["/api/agreement/package-templates", id],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/package-templates/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (template) {
      setHeaderName(template.packageName);
      setHeaderDesc(template.description ?? "");
    }
  }, [template]);

  const updateTemplate = useMutation({
    mutationFn: (data: object) => apiRequest("PATCH", `/api/agreement/package-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates"] });
      toast({ title: "Template saved" });
      setEditingHeader(false);
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const archiveTemplate = useMutation({
    mutationFn: () => apiRequest("POST", `/api/agreement/package-templates/${id}/archive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates"] });
      toast({ title: "Template archived" });
      nav("/admin/agreement");
    },
    onError: () => toast({ title: "Archive failed", variant: "destructive" }),
  });

  const createItem = useMutation({
    mutationFn: (data: object) => apiRequest("POST", `/api/agreement/package-templates/${id}/items`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates", id] });
      toast({ title: "Deliverable added" });
      setShowItemDialog(false);
    },
    onError: () => toast({ title: "Failed to add deliverable", variant: "destructive" }),
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: object }) =>
      apiRequest("PATCH", `/api/agreement/template-items/${itemId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates", id] });
      toast({ title: "Deliverable updated" });
      setShowItemDialog(false);
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => apiRequest("DELETE", `/api/agreement/template-items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates", id] });
      toast({ title: "Deliverable removed" });
    },
    onError: () => toast({ title: "Failed to remove", variant: "destructive" }),
  });

  function openAddItem(category: string) {
    setEditingItem(null);
    setEditingCategory(category);
    const maxOrder = (template?.items ?? []).filter((i) => i.category === category).reduce((m, i) => Math.max(m, i.displayOrder), -1);
    setItemForm({ ...emptyItemForm(), category, displayOrder: String(maxOrder + 1) });
    setShowItemDialog(true);
  }

  function openEditItem(item: DeliverableTemplateItem) {
    setEditingItem(item);
    setEditingCategory(item.category);
    setItemForm({
      deliverableName: item.deliverableName,
      deliverableDescription: item.deliverableDescription ?? "",
      category: item.category,
      defaultQuantity: item.defaultQuantity !== null ? String(item.defaultQuantity) : "",
      quantityUnit: item.quantityUnit ?? "",
      ownerType: item.ownerType,
      sponsorEditable: item.sponsorEditable,
      sponsorVisible: item.sponsorVisible,
      fulfillmentType: item.fulfillmentType,
      reminderEligible: item.reminderEligible,
      dueTiming: item.dueTiming,
      dueOffsetDays: item.dueOffsetDays !== null ? String(item.dueOffsetDays) : "",
      displayOrder: String(item.displayOrder),
      sponsorFacingNote: item.sponsorFacingNote ?? "",
      helpTitle: item.helpTitle ?? "",
      helpText: item.helpText ?? "",
      helpLink: item.helpLink ?? "",
    });
    setShowItemDialog(true);
  }

  function submitItemForm() {
    const payload = {
      deliverableName: itemForm.deliverableName.trim(),
      deliverableDescription: itemForm.deliverableDescription.trim() || null,
      category: itemForm.category,
      defaultQuantity: itemForm.defaultQuantity ? parseInt(itemForm.defaultQuantity) : null,
      quantityUnit: itemForm.quantityUnit.trim() || null,
      ownerType: itemForm.ownerType,
      sponsorEditable: itemForm.sponsorEditable,
      sponsorVisible: itemForm.sponsorVisible,
      fulfillmentType: itemForm.fulfillmentType,
      reminderEligible: itemForm.reminderEligible,
      dueTiming: itemForm.dueTiming,
      dueOffsetDays: itemForm.dueOffsetDays ? parseInt(itemForm.dueOffsetDays) : null,
      displayOrder: parseInt(itemForm.displayOrder) || 0,
      isActive: true,
      sponsorFacingNote: itemForm.sponsorFacingNote.trim() || null,
      helpTitle: itemForm.helpTitle.trim() || null,
      helpText: itemForm.helpText.trim() || null,
      helpLink: itemForm.helpLink.trim() || null,
    };
    if (editingItem) {
      updateItem.mutate({ itemId: editingItem.id, data: payload });
    } else {
      createItem.mutate(payload);
    }
  }

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex flex-col items-center py-24 gap-3 text-muted-foreground">
        <p className="text-sm">Template not found</p>
        <Button variant="outline" size="sm" onClick={() => nav("/admin/agreement")}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
        </Button>
      </div>
    );
  }

  const itemsByCategory = DELIVERABLE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = (template.items ?? []).filter((i) => i.category === cat).sort((a, b) => a.displayOrder - b.displayOrder);
    return acc;
  }, {} as Record<string, DeliverableTemplateItem[]>);

  const totalItems = (template.items ?? []).filter((i) => i.isActive).length;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2" onClick={() => nav("/admin/agreement")}>
        <ArrowLeft className="h-4 w-4" /> Agreement Deliverables
      </Button>

      {/* Header card */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {editingHeader ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Package Name</Label>
                  <Input id="edit-name" value={headerName} onChange={(e) => setHeaderName(e.target.value)} className="text-lg font-bold" data-testid="input-header-name" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-desc">Description</Label>
                  <Textarea id="edit-desc" value={headerDesc} onChange={(e) => setHeaderDesc(e.target.value)} rows={2} data-testid="input-header-desc" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-display font-bold text-foreground">{template.packageName}</h1>
                  <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold", LEVEL_COLORS[template.sponsorshipLevel] ?? "bg-muted text-muted-foreground")}>
                    {template.sponsorshipLevel === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                    {template.sponsorshipLevel}
                  </span>
                  <span className="text-xs text-muted-foreground">{[template.eventFamily, template.year].filter(Boolean).join(" ")}</span>
                </div>
                {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-600" /> {totalItems} deliverables
                  </span>
                  <span>Updated {format(new Date(template.updatedAt), "MMM d, yyyy")}</span>
                  <span className={cn("px-2 py-0.5 rounded-full font-medium", template.isActive ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground")}>
                    {template.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editingHeader ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditingHeader(false)}>Cancel</Button>
                <Button size="sm" onClick={() => updateTemplate.mutate({ packageName: headerName, description: headerDesc || null })} disabled={!headerName.trim() || updateTemplate.isPending} data-testid="button-save-header">
                  <Save className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingHeader(true)} data-testid="button-edit-header">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => archiveTemplate.mutate()} disabled={archiveTemplate.isPending} data-testid="button-archive-template">
                  <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Categorized deliverables */}
      <div className="space-y-3">
        {DELIVERABLE_CATEGORIES.map((cat) => {
          const items = itemsByCategory[cat] ?? [];
          const expanded = expandedCategories.has(cat);
          return (
            <div key={cat} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              {/* Category header */}
              <div
                className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => toggleCategory(cat)}
              >
                <div className="flex items-center gap-3">
                  <button className="text-muted-foreground">
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <h3 className="font-display font-semibold text-sm text-foreground">{cat}</h3>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                <Button
                  variant="ghost" size="sm" className="h-7 px-2.5 text-xs gap-1 text-accent hover:text-accent"
                  onClick={(e) => { e.stopPropagation(); openAddItem(cat); }}
                  data-testid={`button-add-item-${cat.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <Plus className="h-3 w-3" /> Add Deliverable
                </Button>
              </div>

              {/* Items table */}
              {expanded && (
                items.length === 0 ? (
                  <div className="px-5 py-4 border-t border-border/50 text-center text-sm text-muted-foreground">
                    No deliverables in this category.{" "}
                    <button
                      className="text-accent hover:underline underline-offset-2 text-xs"
                      onClick={() => openAddItem(cat)}
                    >
                      Add one
                    </button>
                  </div>
                ) : (
                  <div className="border-t border-border/50 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/20">
                          {["Deliverable", "Qty", "Unit", "Owner", "Editable", "Reminder", "Fulfillment", "Due Timing", "Actions"].map((h) => (
                            <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} className="border-t border-border/30 hover:bg-muted/10 transition-colors" data-testid={`row-item-${item.id}`}>
                            <td className="px-4 py-2.5 font-medium text-foreground max-w-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate">{item.deliverableName}</span>
                                {!item.isActive && <Badge variant="secondary" className="text-[10px] h-4">Inactive</Badge>}
                              </div>
                              {item.deliverableDescription && (
                                <p className="text-[11px] text-muted-foreground truncate">{item.deliverableDescription}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-center text-muted-foreground">{item.defaultQuantity ?? "—"}</td>
                            <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.quantityUnit ?? "—"}</td>
                            <td className="px-4 py-2.5">
                              <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                                item.ownerType === "Sponsor" ? "bg-blue-50 text-blue-700" :
                                item.ownerType === "Converge" ? "bg-purple-50 text-purple-700" :
                                "bg-gray-50 text-gray-600"
                              )}>
                                {item.ownerType}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {item.sponsorEditable ? <Eye className="h-3.5 w-3.5 text-green-600 mx-auto" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground/40 mx-auto" />}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {item.reminderEligible ? <Bell className="h-3.5 w-3.5 text-amber-500 mx-auto" /> : <span className="text-muted-foreground/30 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {FULFILLMENT_LABELS[item.fulfillmentType] ?? item.fulfillmentType}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {DUE_LABELS[item.dueTiming] ?? item.dueTiming}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => openEditItem(item)} data-testid={`button-edit-item-${item.id}`}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => deleteItem.mutate(item.id)} disabled={deleteItem.isPending} data-testid={`button-delete-item-${item.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Item Edit/Add Dialog */}
      <Dialog open={showItemDialog} onOpenChange={(o) => !o && setShowItemDialog(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Deliverable" : "Add Deliverable"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-name">Deliverable Name *</Label>
                <Input id="item-name" value={itemForm.deliverableName} onChange={(e) => setItemForm((f) => ({ ...f, deliverableName: e.target.value }))} data-testid="input-item-name" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-desc">Description</Label>
                <Textarea id="item-desc" rows={2} value={itemForm.deliverableDescription} onChange={(e) => setItemForm((f) => ({ ...f, deliverableDescription: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={itemForm.category} onValueChange={(v) => setItemForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-item-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Owner Type</Label>
                <Select value={itemForm.ownerType} onValueChange={(v) => setItemForm((f) => ({ ...f, ownerType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_OWNER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-qty">Default Quantity</Label>
                <Input id="item-qty" type="number" min="0" value={itemForm.defaultQuantity} onChange={(e) => setItemForm((f) => ({ ...f, defaultQuantity: e.target.value }))} placeholder="Leave blank if N/A" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-unit">Quantity Unit</Label>
                <Input id="item-unit" value={itemForm.quantityUnit} onChange={(e) => setItemForm((f) => ({ ...f, quantityUnit: e.target.value }))} placeholder="e.g. sessions, registrations" />
              </div>
              <div className="space-y-1.5">
                <Label>Fulfillment Type</Label>
                <Select value={itemForm.fulfillmentType} onValueChange={(v) => setItemForm((f) => ({ ...f, fulfillmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_FULFILLMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{FULFILLMENT_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Timing</Label>
                <Select value={itemForm.dueTiming} onValueChange={(v) => setItemForm((f) => ({ ...f, dueTiming: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_DUE_TIMING_TYPES.map((t) => <SelectItem key={t} value={t}>{DUE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-offset">Due Offset Days</Label>
                <Input id="item-offset" type="number" value={itemForm.dueOffsetDays} onChange={(e) => setItemForm((f) => ({ ...f, dueOffsetDays: e.target.value }))} placeholder="e.g. -30 for 30 days before" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="item-order">Display Order</Label>
                <Input id="item-order" type="number" min="0" value={itemForm.displayOrder} onChange={(e) => setItemForm((f) => ({ ...f, displayOrder: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-sponsor-note">Sponsor-Facing Note</Label>
                <Textarea id="item-sponsor-note" rows={2} value={itemForm.sponsorFacingNote} onChange={(e) => setItemForm((f) => ({ ...f, sponsorFacingNote: e.target.value }))} placeholder="Visible to sponsor on their dashboard..." data-testid="input-item-sponsor-note" />
              </div>
              <div className="col-span-2 pt-2 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sponsor Help Content</p>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-help-title">Help Title</Label>
                <Input id="item-help-title" value={itemForm.helpTitle} onChange={(e) => setItemForm((f) => ({ ...f, helpTitle: e.target.value }))} placeholder="e.g. How to submit your logo files" data-testid="input-item-help-title" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-help-text">Help Text</Label>
                <Textarea id="item-help-text" rows={3} value={itemForm.helpText} onChange={(e) => setItemForm((f) => ({ ...f, helpText: e.target.value }))} placeholder="Instructions or guidance shown to the sponsor..." data-testid="input-item-help-text" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="item-help-link">Help Link</Label>
                <Input id="item-help-link" value={itemForm.helpLink} onChange={(e) => setItemForm((f) => ({ ...f, helpLink: e.target.value }))} placeholder="https://example.com/help-guide" data-testid="input-item-help-link" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-1">
              {([
                { id: "sponsor-editable", label: "Sponsor Editable", field: "sponsorEditable" as const },
                { id: "sponsor-visible", label: "Sponsor Visible", field: "sponsorVisible" as const },
                { id: "reminder-eligible", label: "Reminder Eligible", field: "reminderEligible" as const },
              ] as const).map(({ id: fid, label, field }) => (
                <div key={fid} className="flex items-center gap-2">
                  <Switch
                    id={fid}
                    checked={itemForm[field]}
                    onCheckedChange={(v) => setItemForm((f) => ({ ...f, [field]: v }))}
                    data-testid={`switch-${fid}`}
                  />
                  <Label htmlFor={fid} className="text-sm cursor-pointer">{label}</Label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancel</Button>
            <Button
              onClick={submitItemForm}
              disabled={!itemForm.deliverableName.trim() || createItem.isPending || updateItem.isPending}
              data-testid="button-submit-item"
            >
              {editingItem ? "Update" : "Add Deliverable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
