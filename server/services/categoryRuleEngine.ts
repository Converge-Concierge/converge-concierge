import type { CategoryMatchingRule, AttendeeCategoryDef } from "@shared/schema";

export interface RuleMatchResult {
  matched: boolean;
  categoryKey: string | null;
  matchedRule: CategoryMatchingRule | null;
  label: string | null;
}

export function evaluateRules(
  sourceValues: Record<string, string | null | undefined>,
  rules: CategoryMatchingRule[],
  categories: AttendeeCategoryDef[],
): RuleMatchResult {
  const activeRules = rules
    .filter(r => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  const activeCategoryKeys = new Set(categories.filter(c => c.isActive).map(c => c.key));

  for (const rule of activeRules) {
    if (!activeCategoryKeys.has(rule.categoryKey)) continue;
    const sourceValue = sourceValues[rule.sourceField];
    if (!sourceValue) continue;

    if (matchRule(sourceValue, rule.matchType, rule.searchTerm)) {
      const cat = categories.find(c => c.key === rule.categoryKey);
      return {
        matched: true,
        categoryKey: rule.categoryKey,
        matchedRule: rule,
        label: cat?.label ?? rule.categoryKey,
      };
    }
  }

  return { matched: false, categoryKey: null, matchedRule: null, label: null };
}

export function matchRule(value: string, matchType: string, searchTerm: string): boolean {
  const v = value.toLowerCase();
  const s = searchTerm.toLowerCase();

  switch (matchType) {
    case "contains":
      return v.includes(s);
    case "equals":
      return v === s;
    case "starts_with":
      return v.startsWith(s);
    case "ends_with":
      return v.endsWith(s);
    default:
      return v.includes(s);
  }
}

export function testRulesAgainstValue(
  testValue: string,
  sourceField: string,
  rules: CategoryMatchingRule[],
  categories: AttendeeCategoryDef[],
): { results: Array<{ rule: CategoryMatchingRule; matched: boolean; categoryLabel: string }>, winner: RuleMatchResult } {
  const activeRules = rules
    .filter(r => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  const results = activeRules.map(rule => {
    const ruleMatches = rule.sourceField === sourceField && matchRule(testValue, rule.matchType, rule.searchTerm);
    const cat = categories.find(c => c.key === rule.categoryKey);
    return {
      rule,
      matched: ruleMatches,
      categoryLabel: cat?.label ?? rule.categoryKey,
    };
  });

  const winner = evaluateRules({ [sourceField]: testValue }, rules, categories);

  return { results, winner };
}
