export type Candidate = { title: string; price?: number | null; currency?: string | null; url?: string | null; in_stock?: boolean | null; seller?: string | null; seller_count?: number | null };
export type ProductInfo = { name?: string; model?: string; brand?: string; search_term?: string };
export function isSpecLike(model: unknown): boolean;
export function norm(s: unknown): string;
export function compact(s: unknown): string;
export function productSignals(p: ProductInfo): { type: string[] | null; model: string; brands: string[][]; editions: string[]; tokens: string[]; qualifiers: { words: string[]; strong: boolean }[] };
export function score(c: Candidate, p: ProductInfo, signals?: ReturnType<typeof productSignals>): { score: number; reasons: string[] };
export function matchLevel(score: number, signals: ReturnType<typeof productSignals>): "exact" | "partial" | "weak";
export function pickBest<T extends Candidate>(candidates: T[], p: ProductInfo): (T & { match: "exact" | "partial" | "weak"; score: number; reasons: string[] }) | null;
