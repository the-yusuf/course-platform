/** The stored review, returned by create/update/delete */
export class ReviewEntity {
  id: string;
  comment: string;
  user_id: string;
  course_id: string;
  created_at: Date;
  updated_at: Date;
}

export class ReviewAuthorEntity {
  id: string;
  username: string;
  /** Absolute URL of the avatar image */
  avatar: string | null;
}

export class ReviewCourseEntity {
  id: string;
  title: string;
}

/** A review as listed, with its author and course */
export class ReviewViewEntity {
  id: string;
  comment: string;
  created_at: Date;
  user: ReviewAuthorEntity;
  course: ReviewCourseEntity;
}
