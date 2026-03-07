import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TableHead } from "@/components/ui/table";

export type SortDir = "asc" | "desc";
export interface SortState { key: string | null; dir: SortDir; }

export function useSortState(defaultKey?: string, defaultDir: SortDir = "asc") {
  const [sort, setSort] = useState<SortState>({ key: defaultKey ?? null, dir: defaultDir });

  const toggle = useCallback((key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  }, []);

  return { sort, toggle };
}

interface SortHeadProps {
  sortKey: string;
  sort: SortState;
  onSort: (key: string) => void;
  className?: string;
  children: React.ReactNode;
  rightAlign?: boolean;
}

export function SortHead({ sortKey, sort, onSort, className, children, rightAlign }: SortHeadProps) {
  const isActive = sort.key === sortKey;
  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors group", className)}
      onClick={() => onSort(sortKey)}
    >
      <div className={cn("flex items-center gap-1", rightAlign && "justify-end")}>
        {children}
        {isActive ? (
          sort.dir === "asc"
            ? <ChevronUp className="h-3 w-3 text-foreground" />
            : <ChevronDown className="h-3 w-3 text-foreground" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30 group-hover:opacity-60" />
        )}
      </div>
    </TableHead>
  );
}

export function sortData<T>(
  data: T[],
  sort: SortState,
  getValue: (item: T, key: string) => string | number | Date | null | undefined,
): T[] {
  if (!sort.key) return data;
  const key = sort.key;
  return [...data].sort((a, b) => {
    const va = getValue(a, key) ?? "";
    const vb = getValue(b, key) ?? "";
    let cmp = 0;
    if (va instanceof Date && vb instanceof Date) {
      cmp = va.getTime() - vb.getTime();
    } else if (typeof va === "number" && typeof vb === "number") {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: "base" });
    }
    return sort.dir === "asc" ? cmp : -cmp;
  });
}
