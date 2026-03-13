import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Tags, Plus, Pencil, Trash2, FlaskConical, ArrowUpDown, Loader2, RefreshCw, Download } from "lucide-react";

interface CategoryDef {
  id: string;
  key: string;
  label: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  matchWeight: number;
  createdAt: string;
  updatedAt: string;
}

interface MatchingRule {
  id: string;
  categoryKey: string;
  sourceField: string;
  matchType: string;
  searchTerm: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TestResult {
  results: Array<{ rule: MatchingRule; matched: boolean; categoryLabel: string }>;
  winner: { matched: boolean; categoryKey: string | null; label: string | null };
}

const MATCH_TYPE_LABELS: Record<string, string> = {
  contains: "Contains",
  equals: "Equals",
  starts_with: "Starts with",
  ends_with: "Ends with",
};

const SOURCE_FIELD_OPTIONS = [
  { value: "ticket_type", label: "Ticket Type" },
  { value: "attendee_category", label: "Attendee Category" },
  { value: "company", label: "Company" },
  { value: "title", label: "Job Title" },
];

export default function CategoryRulesPage() {
  const { toast } = useToast();

  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryDef | null>(null);
  const [catForm, setCatForm] = useState({ key: "", label: "", description: "", matchWeight: 50, sortOrder: 0, isActive: true });

  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<MatchingRule | null>(null);
  const [ruleForm, setRuleForm] = useState({ categoryKey: "", sourceField: "ticket_type", matchType: "contains", searchTerm: "", priority: 0, isActive: true });

  const [testValue, setTestValue] = useState("");
  const [testField, setTestField] = useState("ticket_type");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const categoriesQuery = useQuery<CategoryDef[]>({ queryKey: ["/api/admin/attendee-categories"] });
  const rulesQuery = useQuery<MatchingRule[]>({ queryKey: ["/api/admin/category-rules"] });

  const createCatMutation = useMutation({
    mutationFn: (data: typeof catForm) => apiRequest("POST", "/api/admin/attendee-categories", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/attendee-categories"] }); setCatDialogOpen(false); toast({ title: "Category created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateCatMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof catForm> }) => apiRequest("PATCH", `/api/admin/attendee-categories/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/attendee-categories"] }); setCatDialogOpen(false); toast({ title: "Category updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/attendee-categories/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/attendee-categories"] }); toast({ title: "Category deleted" }); },
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: typeof ruleForm) => apiRequest("POST", "/api/admin/category-rules", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/category-rules"] }); setRuleDialogOpen(false); toast({ title: "Rule created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof ruleForm> }) => apiRequest("PATCH", `/api/admin/category-rules/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/category-rules"] }); setRuleDialogOpen(false); toast({ title: "Rule updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/category-rules/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/admin/category-rules"] }); toast({ title: "Rule deleted" }); },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/attendee-categories/seed-defaults"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/attendee-categories"] });
      toast({ title: "Defaults seeded" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const backfillMutation = useMutation({
    mutationFn: (forceAll: boolean) => apiRequest("POST", "/api/admin/attendees/backfill-categories", { forceAll }),
    onSuccess: async (resp) => {
      const data = await resp.json();
      toast({ title: "Backfill complete", description: `Updated: ${data.updated}, Skipped: ${data.skipped}${data.unmapped?.length ? `, Unmapped: ${data.unmapped.length}` : ""}` });
    },
    onError: (e: any) => toast({ title: "Backfill failed", description: e.message, variant: "destructive" }),
  });

  const testRuleMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/admin/category-rules/test", { value: testValue, sourceField: testField });
      return resp.json() as Promise<TestResult>;
    },
    onSuccess: (data) => setTestResult(data),
  });

  function openNewCat() {
    setEditingCat(null);
    setCatForm({ key: "", label: "", description: "", matchWeight: 50, sortOrder: 0, isActive: true });
    setCatDialogOpen(true);
  }

  function openEditCat(cat: CategoryDef) {
    setEditingCat(cat);
    setCatForm({ key: cat.key, label: cat.label, description: cat.description ?? "", matchWeight: cat.matchWeight, sortOrder: cat.sortOrder, isActive: cat.isActive });
    setCatDialogOpen(true);
  }

  function saveCat() {
    if (editingCat) {
      updateCatMutation.mutate({ id: editingCat.id, data: catForm });
    } else {
      createCatMutation.mutate(catForm);
    }
  }

  function openNewRule() {
    setEditingRule(null);
    const defaultCatKey = categoriesQuery.data?.[0]?.key ?? "";
    setRuleForm({ categoryKey: defaultCatKey, sourceField: "ticket_type", matchType: "contains", searchTerm: "", priority: 0, isActive: true });
    setRuleDialogOpen(true);
  }

  function openEditRule(rule: MatchingRule) {
    setEditingRule(rule);
    setRuleForm({ categoryKey: rule.categoryKey, sourceField: rule.sourceField, matchType: rule.matchType, searchTerm: rule.searchTerm, priority: rule.priority, isActive: rule.isActive });
    setRuleDialogOpen(true);
  }

  function saveRule() {
    if (editingRule) {
      updateRuleMutation.mutate({ id: editingRule.id, data: ruleForm });
    } else {
      createRuleMutation.mutate(ruleForm);
    }
  }

  const categories = categoriesQuery.data ?? [];
  const rules = rulesQuery.data ?? [];
  const catKeyToLabel = Object.fromEntries(categories.map(c => [c.key, c.label]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Tags className="h-6 w-6" />
            Category Rules
          </h1>
          <p className="text-muted-foreground mt-1">
            Define attendee categories and keyword matching rules for auto-classification
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => seedDefaultsMutation.mutate()} disabled={seedDefaultsMutation.isPending} data-testid="button-seed-defaults">
            {seedDefaultsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Seed Defaults
          </Button>
          <Button variant="outline" size="sm" onClick={() => backfillMutation.mutate(false)} disabled={backfillMutation.isPending} data-testid="button-backfill">
            {backfillMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Backfill Attendees
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg">Categories</CardTitle>
              <CardDescription>Attendee classification labels with matchmaking weights</CardDescription>
            </div>
            <Button size="sm" onClick={openNewCat} data-testid="button-add-category">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {categoriesQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : categories.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No categories defined. Click "Seed Defaults" to add the standard set.</p>
            ) : (
              <div className="space-y-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`card-category-${cat.key}`}>
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cat.label}</span>
                          <Badge variant={cat.isActive ? "default" : "secondary"} className="text-xs">
                            {cat.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Key: <code className="bg-muted px-1 rounded">{cat.key}</code> &middot; Weight: {cat.matchWeight} &middot; Order: {cat.sortOrder}
                        </div>
                        {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditCat(cat)} data-testid={`button-edit-category-${cat.key}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm(`Delete category "${cat.label}"?`)) deleteCatMutation.mutate(cat.id); }} data-testid={`button-delete-category-${cat.key}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-lg">Matching Rules</CardTitle>
              <CardDescription>Keyword rules evaluated by priority (lower = higher priority)</CardDescription>
            </div>
            <Button size="sm" onClick={openNewRule} disabled={categories.length === 0} data-testid="button-add-rule">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </CardHeader>
          <CardContent>
            {rulesQuery.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : rules.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No matching rules defined yet. Add rules to auto-classify attendees.</p>
            ) : (
              <div className="space-y-2">
                {rules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`card-rule-${rule.id}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono">P{rule.priority}</Badge>
                        <span className="text-sm">
                          If <code className="bg-muted px-1 rounded text-xs">{SOURCE_FIELD_OPTIONS.find(o => o.value === rule.sourceField)?.label ?? rule.sourceField}</code>
                          {" "}<strong>{MATCH_TYPE_LABELS[rule.matchType] ?? rule.matchType}</strong>
                          {" "}"<span className="font-medium">{rule.searchTerm}</span>"
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        &rarr; {catKeyToLabel[rule.categoryKey] ?? rule.categoryKey}
                        {!rule.isActive && <Badge variant="secondary" className="ml-2 text-xs">Disabled</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRule(rule)} data-testid={`button-edit-rule-${rule.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Delete this rule?")) deleteRuleMutation.mutate(rule.id); }} data-testid={`button-delete-rule-${rule.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Rule Tester
          </CardTitle>
          <CardDescription>Test how a value would be classified by the current rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Test Value</Label>
              <Input
                placeholder="e.g. Practitioner - Full Conference"
                value={testValue}
                onChange={e => setTestValue(e.target.value)}
                data-testid="input-test-value"
              />
            </div>
            <div className="w-44">
              <Label>Source Field</Label>
              <Select value={testField} onValueChange={setTestField}>
                <SelectTrigger data-testid="select-test-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_FIELD_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => testRuleMutation.mutate()} disabled={!testValue || testRuleMutation.isPending} data-testid="button-test-rules">
              {testRuleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FlaskConical className="h-4 w-4 mr-1" />}
              Test
            </Button>
          </div>

          {testResult && (
            <div className="mt-4 space-y-3">
              <Separator />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Winner:</span>
                {testResult.winner.matched ? (
                  <Badge>{testResult.winner.label}</Badge>
                ) : (
                  <Badge variant="secondary">No match</Badge>
                )}
              </div>
              {testResult.results.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">All rules evaluated:</span>
                  {testResult.results.map((r, i) => (
                    <div key={i} className={`text-xs p-2 rounded border ${r.matched ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800" : "bg-muted/30"}`} data-testid={`text-test-result-${i}`}>
                      <span className="font-mono mr-1">P{r.rule.priority}</span>
                      {MATCH_TYPE_LABELS[r.rule.matchType]} "{r.rule.searchTerm}" on {r.rule.sourceField}
                      {" → "}{r.categoryLabel}
                      {r.matched ? <Badge className="ml-2 text-[10px]" variant="default">Match</Badge> : <Badge className="ml-2 text-[10px]" variant="secondary">No match</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Key</Label>
                <Input
                  value={catForm.key}
                  onChange={e => setCatForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))}
                  placeholder="PRACTITIONER"
                  disabled={!!editingCat}
                  data-testid="input-category-key"
                />
              </div>
              <div>
                <Label>Label</Label>
                <Input value={catForm.label} onChange={e => setCatForm(f => ({ ...f, label: e.target.value }))} placeholder="Practitioner" data-testid="input-category-label" />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" data-testid="input-category-description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Match Weight</Label>
                <Input type="number" value={catForm.matchWeight} onChange={e => setCatForm(f => ({ ...f, matchWeight: parseInt(e.target.value) || 0 }))} data-testid="input-category-weight" />
                <p className="text-xs text-muted-foreground mt-1">Used for matchmaking score (0-1000)</p>
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input type="number" value={catForm.sortOrder} onChange={e => setCatForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} data-testid="input-category-sort" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={catForm.isActive} onCheckedChange={v => setCatForm(f => ({ ...f, isActive: v }))} data-testid="switch-category-active" />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)} data-testid="button-cancel-category">Cancel</Button>
            <Button onClick={saveCat} disabled={!catForm.key || !catForm.label || createCatMutation.isPending || updateCatMutation.isPending} data-testid="button-save-category">
              {(createCatMutation.isPending || updateCatMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingCat ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "New Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Category</Label>
              <Select value={ruleForm.categoryKey} onValueChange={v => setRuleForm(f => ({ ...f, categoryKey: v }))}>
                <SelectTrigger data-testid="select-rule-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Source Field</Label>
                <Select value={ruleForm.sourceField} onValueChange={v => setRuleForm(f => ({ ...f, sourceField: v }))}>
                  <SelectTrigger data-testid="select-rule-source-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_FIELD_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Match Type</Label>
                <Select value={ruleForm.matchType} onValueChange={v => setRuleForm(f => ({ ...f, matchType: v }))}>
                  <SelectTrigger data-testid="select-rule-match-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contains</SelectItem>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="starts_with">Starts with</SelectItem>
                    <SelectItem value="ends_with">Ends with</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Search Term</Label>
              <Input value={ruleForm.searchTerm} onChange={e => setRuleForm(f => ({ ...f, searchTerm: e.target.value }))} placeholder="e.g. practitioner" data-testid="input-rule-search-term" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Input type="number" value={ruleForm.priority} onChange={e => setRuleForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} data-testid="input-rule-priority" />
                <p className="text-xs text-muted-foreground mt-1">Lower = higher priority</p>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={ruleForm.isActive} onCheckedChange={v => setRuleForm(f => ({ ...f, isActive: v }))} data-testid="switch-rule-active" />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)} data-testid="button-cancel-rule">Cancel</Button>
            <Button onClick={saveRule} disabled={!ruleForm.categoryKey || !ruleForm.searchTerm || createRuleMutation.isPending || updateRuleMutation.isPending} data-testid="button-save-rule">
              {(createRuleMutation.isPending || updateRuleMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
