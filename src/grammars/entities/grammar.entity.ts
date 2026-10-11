export class GrammarEntity {
  id: string;
  title: string;
  description: string;
  example: string;
  example_uz: string;
  example_ru: string;
  example_en: string;
  /** null for free grammar; set for grammar that belongs to a lesson (enrollment needed) */
  lesson_id: string | null;
  created_at: Date;
  updated_at: Date;
}
