/** The stored enrollment, returned by create/delete */
export class EnrollmentEntity {
  id: string;
  user_id: string;
  course_id: string;
  created_at: Date;
}

export class EnrollmentUserEntity {
  id: string;
  username: string;
  email: string;
  /** Absolute URL of the avatar image */
  avatar: string | null;
}

export class EnrollmentCourseEntity {
  id: string;
  title: string;
  /** Absolute URL of the course image */
  image: string | null;
  price_uzs: number;
}

/** An enrollment as listed, with its user and course */
export class EnrollmentViewEntity {
  id: string;
  created_at: Date;
  user: EnrollmentUserEntity;
  course: EnrollmentCourseEntity;
}
