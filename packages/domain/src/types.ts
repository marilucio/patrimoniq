export type CostNature = "fixed" | "variable" | "extraordinary";
export type Essentiality = "essential" | "important" | "superfluous" | "impulse";

export interface GoalProgressInput {
  targetAmount: number;
  currentAmount: number;
}

export interface CategoryCatalogEntry {
  slug: string;
  name: string;
  direction: "expense" | "income" | "saving" | "debt";
  subcategories: Array<{
    slug: string;
    name: string;
    nature?: CostNature;
    essentiality?: Essentiality;
  }>;
}
