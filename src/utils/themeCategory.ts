export const DEFAULT_BANK_CATEGORIES = [
  'família',
  'discipulado',
  'oração',
  'santidade',
  'sofrimento',
  'evangelismo',
  'liderança',
  'juventude',
  'missões',
  'esperança',
  'avivamento',
] as const;

export const CUSTOM_CATEGORY_OPTION = '__custom__';

const BANK_CATEGORY_LOOKUP: Record<string, string> = {
  familia: 'família',
  'família': 'família',
  discipulado: 'discipulado',
  oracao: 'oração',
  'oração': 'oração',
  santidade: 'santidade',
  sofrimento: 'sofrimento',
  evangelismo: 'evangelismo',
  lideranca: 'liderança',
  'liderança': 'liderança',
  juventude: 'juventude',
  missoes: 'missões',
  'missões': 'missões',
  esperanca: 'esperança',
  'esperança': 'esperança',
  avivamento: 'avivamento',
};

const PT_LOWERCASE_CONNECTORS = new Set([
  'a',
  'ao',
  'aos',
  'as',
  'com',
  'da',
  'das',
  'de',
  'do',
  'dos',
  'e',
  'em',
  'na',
  'nas',
  'no',
  'nos',
  'o',
  'os',
  'para',
  'por',
  'sem',
  'sob',
]);

export function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeCategoryKey(value?: string): string {
  const collapsed = collapseWhitespace(value || '').toLowerCase();
  if (!collapsed) return '';
  if (BANK_CATEGORY_LOOKUP[collapsed]) return BANK_CATEGORY_LOOKUP[collapsed];
  const ascii = collapsed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (BANK_CATEGORY_LOOKUP[ascii]) return BANK_CATEGORY_LOOKUP[ascii];
  return collapsed;
}

export function formatCustomCategoryName(raw: string): string {
  const collapsed = collapseWhitespace(raw);
  if (!collapsed) return '';
  const words = collapsed.split(' ');
  const formatted = words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && PT_LOWERCASE_CONNECTORS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
  return formatted.slice(0, 60);
}

export function normalizeThemeCategory(raw?: string, fallbackCat = 'esperança'): string {
  const collapsed = collapseWhitespace(raw || '');
  if (!collapsed) return fallbackCat;
  const lower = collapsed.toLowerCase();
  if (lower === CUSTOM_CATEGORY_OPTION || lower === 'nova categoria') {
    return fallbackCat;
  }

  if (BANK_CATEGORY_LOOKUP[lower]) {
    return BANK_CATEGORY_LOOKUP[lower];
  }
  const ascii = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (BANK_CATEGORY_LOOKUP[ascii]) {
    return BANK_CATEGORY_LOOKUP[ascii];
  }

  return formatCustomCategoryName(collapsed) || fallbackCat;
}

export function isStandardBankCategory(category: string): boolean {
  const key = normalizeCategoryKey(category);
  return DEFAULT_BANK_CATEGORIES.includes(
    key as (typeof DEFAULT_BANK_CATEGORIES)[number]
  );
}
