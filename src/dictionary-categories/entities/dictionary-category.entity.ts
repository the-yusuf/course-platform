import { DictionaryEntity } from '../../dictionaries/entities/dictionary.entity.js';

export class DictionaryCategoryEntity {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  created_at: Date;
  updated_at: Date;
}

export class DictionaryCategoryListItemEntity extends DictionaryCategoryEntity {
  /** Free words only (lesson words need enrollment) */
  dictionaries_count: number;
}

export class DictionaryCategoryDetailEntity extends DictionaryCategoryEntity {
  /** Free words only (lesson words need enrollment) */
  dictionaries: DictionaryEntity[];
}
