const KNOWN_LABELS: Record<string, string> = {
  PRACTITIONER: "Practitioner",
  GOVERNMENT_NONPROFIT: "Gov / Non-Profit",
  SOLUTION_PROVIDER: "Solution Provider",
};

const KNOWN_COLORS: Record<string, string> = {
  PRACTITIONER: "#10b981",
  GOVERNMENT_NONPROFIT: "#3b82f6",
  SOLUTION_PROVIDER: "#f59e0b",
};

const KNOWN_BADGE_CLASSES: Record<string, string> = {
  PRACTITIONER: "bg-emerald-100 text-emerald-800 border-emerald-200",
  GOVERNMENT_NONPROFIT: "bg-blue-100 text-blue-800 border-blue-200",
  SOLUTION_PROVIDER: "bg-amber-100 text-amber-800 border-amber-200",
};

const DYNAMIC_COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1", "#14b8a6", "#e11d48"];

let categoryLabelCache: Record<string, string> = {};

export function setCategoryLabelCache(labels: Record<string, string>) {
  categoryLabelCache = labels;
}

export function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return "Unmapped";
  if (categoryLabelCache[cat]) return categoryLabelCache[cat];
  if (KNOWN_LABELS[cat]) return KNOWN_LABELS[cat];
  return cat.split("_").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
}

export function categoryChartColor(cat: string): string {
  if (KNOWN_COLORS[cat]) return KNOWN_COLORS[cat];
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash);
  return DYNAMIC_COLORS[Math.abs(hash) % DYNAMIC_COLORS.length];
}

export function categoryBadgeClass(cat: string | null | undefined): string {
  if (!cat) return "bg-gray-100 text-gray-500 border-gray-200";
  if (KNOWN_BADGE_CLASSES[cat]) return KNOWN_BADGE_CLASSES[cat];
  return "bg-purple-100 text-purple-800 border-purple-200";
}
