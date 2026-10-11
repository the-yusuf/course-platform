export class StoryEntity {
  id: string;
  title: string;
  title_uz: string;
  title_ru: string;
  title_en: string;
  content: string;
  content_uz: string;
  content_ru: string;
  content_en: string;
  level: 'hsk1' | 'hsk2' | 'hsk3' | 'hsk4' | 'hsk5' | 'hsk6';
  created_at: Date;
  updated_at: Date;
}
