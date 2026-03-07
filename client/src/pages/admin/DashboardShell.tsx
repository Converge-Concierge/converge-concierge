import { Plus, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

interface DashboardShellProps {
  title: string;
  description: string;
}

export function DashboardShell({ title, description }: DashboardShellProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">{title}</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">{description}</p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-3">
          <Button variant="outline" className="hidden sm:flex shadow-sm" onClick={() => console.log("Export")}>
            Export
          </Button>
          <Button className="w-full sm:w-auto shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => console.log(`Create ${title}`)}>
            <Plus className="mr-2 h-4 w-4" /> Add New
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder={`Search ${title.toLowerCase()}...`} 
            className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20"
          />
        </div>
        <Button variant="outline" className="w-full sm:w-auto shadow-sm" onClick={() => console.log("Filter")}>
          <Filter className="mr-2 h-4 w-4" /> Filters
        </Button>
      </div>

      {/* Placeholder Content Area */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden min-h-[400px] flex flex-col items-center justify-center text-center p-8">
        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <div className="h-8 w-8 rounded bg-border animate-pulse" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">No {title.toLowerCase()} found</h3>
        <p className="text-muted-foreground mt-1 mb-6 max-w-sm">
          Get started by creating your first record. This module is currently functioning as a structural shell.
        </p>
        <Button variant="outline" onClick={() => console.log(`Create ${title}`)}>
          <Plus className="mr-2 h-4 w-4" /> Create {title.replace(/s$/, '')}
        </Button>
      </div>
    </motion.div>
  );
}
