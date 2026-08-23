// Default merchant mappings (Seeded)
import { storage } from '@/src/utils/storage';

export type MerchantMapping = {
  category: string;
  match_count: number;
  last_used: number;
  is_seeded: boolean;
};

export type MappingStore = Record<string, MerchantMapping>;

export const SEEDED_MAPPINGS: MappingStore = {
  'gojek': { category: 'Transportasi', match_count: 1, last_used: 0, is_seeded: true },
  'grab': { category: 'Transportasi', match_count: 1, last_used: 0, is_seeded: true },
  'indomaret': { category: 'Groceries', match_count: 1, last_used: 0, is_seeded: true },
  'alfamart': { category: 'Groceries', match_count: 1, last_used: 0, is_seeded: true },
  'netflix': { category: 'Entertainment', match_count: 1, last_used: 0, is_seeded: true },
  'spotify': { category: 'Entertainment', match_count: 1, last_used: 0, is_seeded: true },
};

export function normalize(input: string): string {
  // Lowercase, replace non-alphanumeric with space, collapse spaces, trim
  return input.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function findMatch(input: string, store: MappingStore): string | null {
  const normalized = normalize(input);
  if (!normalized) return null;

  // 1. Exact Match (O(1))
  if (store[normalized]) return store[normalized].category;

  // 2. Fallback: Word-boundary/Containment Match (O(N))
  const candidates: { key: string; mapping: MerchantMapping }[] = [];
  for (const [key, mapping] of Object.entries(store)) {
    // Regex \b ensures word boundary, preventing "go" from matching "gojek"
    const regex = new RegExp(`\\b${key}\\b`);
    if (regex.test(normalized)) {
      candidates.push({ key, mapping });
    }
  }

  if (candidates.length === 0) return null;

  // 3. Sort by priority rules:
  candidates.sort((a, b) => {
    // Rule (a): Learned (is_seeded: false) > Seeded (is_seeded: true)
    if (a.mapping.is_seeded !== b.mapping.is_seeded) {
      return a.mapping.is_seeded ? 1 : -1;
    }
    // Rule (b): match_count (descending)
    if (a.mapping.match_count !== b.mapping.match_count) {
      return b.mapping.match_count - a.mapping.match_count;
    }
    // Rule (c): last_used (descending)
    return b.mapping.last_used - a.mapping.last_used;
  });

  return candidates[0].mapping.category;
}

// Persistence: the storage layer only accepts scalars, so the store is
// serialized to a JSON string. All reads/writes must go through these two
// helpers so the format stays consistent.
export const MAPPING_STORE_KEY = 'mf.merchant.mappings';

export async function loadStore(): Promise<MappingStore> {
  const raw = await storage.getItem(MAPPING_STORE_KEY, '{}');
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as MappingStore) : {};
  } catch {
    return {};
  }
}

export async function saveStore(store: MappingStore): Promise<boolean> {
  return storage.setItem(MAPPING_STORE_KEY, JSON.stringify(store));
}
