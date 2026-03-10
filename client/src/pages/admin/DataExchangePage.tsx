import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertCircle, 
  FileDown, 
  History,
  Info,
  ChevronRight,
  ChevronDown,
  Building2,
  Users,
  Handshake,
  Monitor,
  Video,
  Globe,
  Shield
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle, 
  CardFooter 
} from "@/components/ui/card";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Event, 
  Sponsor, 
  Attendee, 
  Meeting, 
  DataExchangeLog 
} from "@shared/schema";
import { cn } from "@/lib/utils";

// --- Types ---

type Category = "sponsors" | "attendees" | "meetings";

interface PreviewRow {
  index: number;
  data: any;
  isValid: boolean;
  errors: string[];
}

interface ImportResult {
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  rejectedCount: number;
  rejections: { row: number; data: any; error: string }[];
}

// --- Helpers ---

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- Components ---

function CategorySection({ 
  category, 
  events, 
  sponsors, 
  attendees, 
  meetings 
}: { 
  category: Category; 
  events: Event[]; 
  sponsors: Sponsor[]; 
  attendees: Attendee[]; 
  meetings: Meeting[]; 
}) {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState<string>("all");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

  // Sample CSV Headers
  const headersMap: Record<Category, string[]> = {
    sponsors: ["Name", "Level", "AllowOnlineMeetings", "ShortDescription", "WebsiteUrl", "LinkedinUrl", "ContactName", "ContactEmail", "ContactPhone", "Attributes"],
    attendees: ["FirstName", "LastName", "Company", "Title", "Email", "Phone", "LinkedinUrl", "EventCode", "Interests", "Notes"],
    meetings: ["EventCode", "SponsorName", "AttendeeEmail", "MeetingType", "Date", "Time", "Location", "Status", "Notes", "MeetingLink"]
  };

  const handleDownloadSample = () => {
    const headers = headersMap[category];
    const sampleRows: Record<Category, string[][]> = {
      sponsors: [["Sample Sponsor", "Platinum", "true", "A leading tech company", "https://example.com", "https://linkedin.com/company/sample", "John Doe", "john@example.com", "555-0101", "AI;Automation"]],
      attendees: [["Jane", "Smith", "Acme Corp", "Director", "jane@example.com", "555-0202", "https://linkedin.com/in/janesmith", "EVENT2024", "Networking;Cloud", "VIP attendee"]],
      meetings: [["EVENT2024", "Sample Sponsor", "jane@example.com", "onsite", "2024-10-15", "10:00", "Booth 101", "Scheduled", "Intro meeting", ""]]
    };
    
    const csvContent = [
      headers.join(","),
      ...sampleRows[category].map(row => row.join(","))
    ].join("\n");
    
    downloadCSV(`${category}_sample.csv`, csvContent);
  };

  const handleExport = () => {
    const headers = headersMap[category];
    let dataToExport: any[] = [];

    if (category === "sponsors") {
      dataToExport = sponsors.map(s => [
        s.name, s.level, s.allowOnlineMeetings, s.shortDescription, s.websiteUrl, s.linkedinUrl, s.contactName, s.contactEmail, s.contactPhone, (s.attributes || []).join(";")
      ]);
    } else if (category === "attendees") {
      dataToExport = attendees
        .filter(a => selectedEventId === "all" || a.assignedEvent === selectedEventId)
        .map(a => {
          const event = events.find(e => e.id === a.assignedEvent);
          return [
            a.firstName, a.lastName, a.company, a.title, a.email, a.phone, a.linkedinUrl, event?.slug || "", (a.interests || []).join(";"), a.notes
          ];
        });
    } else if (category === "meetings") {
      dataToExport = meetings
        .filter(m => selectedEventId === "all" || m.eventId === selectedEventId)
        .map(m => {
          const event = events.find(e => e.id === m.eventId);
          const sponsor = sponsors.find(s => s.id === m.sponsorId);
          const attendee = attendees.find(a => a.id === m.attendeeId);
          return [
            event?.slug || "", sponsor?.name || "", attendee?.email || "", m.meetingType, m.date, m.time, m.location, m.status, m.notes, m.meetingLink
          ];
        });
    }

    const csvContent = [
      headers.join(","),
      ...dataToExport.map(row => row.map((cell: any) => `"${(cell || "").toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    downloadCSV(`${category}_export.csv`, csvContent);
    toast({ title: "Export Complete", description: `${categoryLabel} exported successfully.` });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 1) {
        toast({ title: "Empty File", description: "The selected CSV file is empty.", variant: "destructive" });
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim());
      const expectedHeaders = headersMap[category];
      
      // Basic header validation
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        toast({ 
          title: "Invalid Headers", 
          description: `Missing headers: ${missingHeaders.join(", ")}`, 
          variant: "destructive" 
        });
        return;
      }

      const rows: PreviewRow[] = lines.slice(1).map((line, idx) => {
        const values = line.split(",").map(v => v.trim());
        const rowData: any = {};
        headers.forEach((h, i) => {
          rowData[h] = values[i];
        });

        const errors: string[] = [];
        // Basic validation based on category
        if (category === "sponsors" && !rowData.Name) errors.push("Name is required");
        if (category === "attendees") {
          if (!rowData.Email) errors.push("Email is required");
          if (!rowData.EventCode) errors.push("EventCode is required");
        }
        if (category === "meetings") {
          if (!rowData.EventCode) errors.push("EventCode is required");
          if (!rowData.SponsorName) errors.push("SponsorName is required");
          if (!rowData.AttendeeEmail) errors.push("AttendeeEmail is required");
        }

        return {
          index: idx + 1,
          data: rowData,
          isValid: errors.length === 0,
          errors
        };
      });

      setPreview(rows);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!preview || isImporting) return;
    setIsImporting(true);
    
    try {
      const validRows = preview.filter(r => r.isValid).map(r => r.data);
      const res = await apiRequest("POST", `/api/admin/data-exchange/import/${category}`, {
        rows: validRows,
        fileName: file?.name
      });
      const result: ImportResult = await res.json();
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: [`/api/${category}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-exchange/logs"] });
      
      toast({ 
        title: "Import Finished", 
        description: `Successfully processed ${result.totalRows} rows.` 
      });
    } catch (error) {
      toast({ 
        title: "Import Failed", 
        description: "An error occurred during import.", 
        variant: "destructive" 
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadRejections = () => {
    if (!importResult || importResult.rejections.length === 0) return;
    const headers = [...headersMap[category], "Error"];
    const csvContent = [
      headers.join(","),
      ...importResult.rejections.map(r => [
        ...headersMap[category].map(h => `"${(r.data[h] || "").toString().replace(/"/g, '""')}"`),
        `"${r.error.replace(/"/g, '""')}"`
      ].join(","))
    ].join("\n");
    downloadCSV(`${category}_rejections.csv`, csvContent);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sample Card */}
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-accent" />
              Download Sample
            </CardTitle>
            <CardDescription>
              Get a template with correct headers and example data.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" className="w-full gap-2" onClick={handleDownloadSample} data-testid={`button-sample-${category}`}>
              <Download className="h-4 w-4" /> Download template
            </Button>
          </CardFooter>
        </Card>

        {/* Export Card */}
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileDown className="h-5 w-5 text-blue-500" />
              Export {categoryLabel}
            </CardTitle>
            <CardDescription>
              Download your current {category} as a CSV file.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(category === "attendees" || category === "meetings") && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Filter by Event</label>
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger data-testid={`select-export-event-${category}`}>
                    <SelectValue placeholder="All Events" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {events.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.slug})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full gap-2" onClick={handleExport} data-testid={`button-export-${category}`}>
              <Download className="h-4 w-4" /> Export to CSV
            </Button>
          </CardFooter>
        </Card>

        {/* Import Card */}
        <Card className="hover-elevate">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-500" />
              Import {categoryLabel}
            </CardTitle>
            <CardDescription>
              Upload a CSV file to bulk create or update {category}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-accent/50 transition-colors relative cursor-pointer">
                <Input 
                  type="file" 
                  accept=".csv" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleFileChange}
                  data-testid={`input-import-file-${category}`}
                />
                <div className="space-y-2">
                  <div className="mx-auto w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-accent" />
                  </div>
                  <div className="text-sm">
                    {file ? <span className="font-medium text-foreground">{file.name}</span> : <span>Click to upload or drag and drop</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">CSV files only</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground" 
              disabled={!preview || isImporting} 
              onClick={handleImport}
              data-testid={`button-import-${category}`}
            >
              {isImporting ? "Importing..." : "Start Import"}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Preview Panel */}
      {preview && !importResult && (
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Import Preview</CardTitle>
              <CardDescription>Review the data before finalizing the import.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                {preview.filter(r => r.isValid).length} Valid Rows
              </Badge>
              {preview.some(r => !r.isValid) && (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                  {preview.filter(r => !r.isValid).length} Invalid Rows
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-height-[400px] overflow-auto border rounded-lg bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Row</TableHead>
                    <TableHead>Status</TableHead>
                    {headersMap[category].slice(0, 3).map(h => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 50).map((row) => (
                    <TableRow key={row.index}>
                      <TableCell className="text-center font-mono text-xs">{row.index}</TableCell>
                      <TableCell>
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                      {headersMap[category].slice(0, 3).map(h => (
                        <TableCell key={h} className="text-xs truncate max-w-[120px]">
                          {row.data[h]}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs text-muted-foreground">
                        {row.isValid ? "Ready to import" : row.errors.join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {preview.length > 50 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground italic">
                        Showing first 50 of {preview.length} rows...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result Panel */}
      {importResult && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Import Completed
            </CardTitle>
            <CardDescription>The import process has finished. See the summary below.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card p-4 rounded-xl border border-border/50 text-center">
                <p className="text-2xl font-bold">{importResult.totalRows}</p>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Total Rows</p>
              </div>
              <div className="bg-card p-4 rounded-xl border border-border/50 text-center">
                <p className="text-2xl font-bold text-green-600">{importResult.importedCount}</p>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Imported</p>
              </div>
              <div className="bg-card p-4 rounded-xl border border-border/50 text-center">
                <p className="text-2xl font-bold text-blue-600">{importResult.updatedCount}</p>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Updated</p>
              </div>
              <div className="bg-card p-4 rounded-xl border border-border/50 text-center">
                <p className="text-2xl font-bold text-red-600">{importResult.rejectedCount}</p>
                <p className="text-xs text-muted-foreground uppercase font-semibold">Rejected</p>
              </div>
            </div>

            {importResult.rejectedCount > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Rejected Rows
                  </h4>
                  <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadRejections} data-testid={`button-download-rejections-${category}`}>
                    <Download className="h-3 w-3" /> Download Rejections CSV
                  </Button>
                </div>
                <div className="max-height-[300px] overflow-auto border rounded-lg bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">Row</TableHead>
                        <TableHead>Error Reason</TableHead>
                        <TableHead>Data Snippet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.rejections.slice(0, 20).map((rej, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-center font-mono text-xs">{rej.row}</TableCell>
                          <TableCell className="text-xs text-red-600 font-medium">{rej.error}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {JSON.stringify(rej.data).substring(0, 100)}...
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" onClick={() => { setFile(null); setPreview(null); setImportResult(null); }}>
              Done / Start New Import
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

export default function DataExchangePage() {
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: attendees = [] } = useQuery<Attendee[]>({ queryKey: ["/api/attendees"] });
  const { data: meetings = [] } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });
  const { data: logs = [] } = useQuery<DataExchangeLog[]>({ queryKey: ["/api/admin/data-exchange/logs"] });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 max-w-7xl mx-auto p-6"
    >
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Data Exchange</h1>
        <p className="text-muted-foreground mt-1">Bulk manage your data via CSV import and export.</p>
      </div>

      <Tabs defaultValue="sponsors" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="sponsors" className="gap-2" data-testid="tab-exchange-sponsors">
            <Building2 className="h-4 w-4" /> Sponsors
          </TabsTrigger>
          <TabsTrigger value="attendees" className="gap-2" data-testid="tab-exchange-attendees">
            <Users className="h-4 w-4" /> Attendees
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2" data-testid="tab-exchange-meetings">
            <Handshake className="h-4 w-4" /> Meetings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sponsors">
          <CategorySection 
            category="sponsors" 
            events={events} 
            sponsors={sponsors} 
            attendees={attendees} 
            meetings={meetings} 
          />
        </TabsContent>
        <TabsContent value="attendees">
          <CategorySection 
            category="attendees" 
            events={events} 
            sponsors={sponsors} 
            attendees={attendees} 
            meetings={meetings} 
          />
        </TabsContent>
        <TabsContent value="meetings">
          <CategorySection 
            category="meetings" 
            events={events} 
            sponsors={sponsors} 
            attendees={attendees} 
            meetings={meetings} 
          />
        </TabsContent>
      </Tabs>

      {/* Audit Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Audit Log
            </CardTitle>
            <CardDescription>Track all recent import and export activity.</CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {logs.length} Entries
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>File / Results</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground italic">
                      No logs found.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-medium">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-bold text-accent">
                            {log.adminUser.substring(0, 2).toUpperCase()}
                          </div>
                          {log.adminUser}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize text-[10px]">{log.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          {log.operation === "import" ? (
                            <><Upload className="h-3 w-3 text-green-500" /> Import</>
                          ) : (
                            <><Download className="h-3 w-3 text-blue-500" /> Export</>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {log.fileName && <p className="text-xs font-medium truncate max-w-[200px]">{log.fileName}</p>}
                          <div className="flex gap-2">
                            <span className="text-[10px] text-muted-foreground">Total: {log.totalRows}</span>
                            {log.operation === "import" && (
                              <>
                                <span className="text-[10px] text-green-600">Imp: {log.importedCount}</span>
                                <span className="text-[10px] text-blue-600">Upd: {log.updatedCount}</span>
                                <span className="text-[10px] text-red-600">Rej: {log.rejectedCount}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Ensure icons are correctly imported and used in CategorySection
