export class DictionaryEntity {
  id: string;
  word_uz: string;
  word_ru: string;
  word_en: string;
  word_zh: string;
  example_uz: string;
  example_ru: string;
  example_en: string;
  example_zh: string;
  pronunciation: string;
  example_pronunciation: string;
  category_id: string;
  /** null for free words; set for words that belong to a lesson (enrollment needed) */
  lesson_id: string | null;
  created_at: Date;
  updated_at: Date;
}
