import { DictionaryEntity } from '../../dictionaries/entities/dictionary.entity.js';
import { GrammarEntity } from '../../grammars/entities/grammar.entity.js';

export class LessonEntity {
  id: string;
  title_uz: string;
  title_ru: string;
  title_en: string;
  video: string | null;
  course_id: string;
  /** Order within the course, starting at 1 */
  position: number;
  created_at: Date;
  updated_at: Date;
}

export class LessonListItemEntity extends LessonEntity {
  dictionaries_count: number;
  grammars_count: number;
}

export class LessonDetailEntity extends LessonEntity {
  dictionaries: DictionaryEntity[];
  grammars: GrammarEntity[];
}

/** What the public course page shows: no video link */
export class LessonOutlineEntity {
  id: string;
  title_uz: string;
  title_ru: string;
  title_en: string;
  position: number;
  created_at: Date;
}
