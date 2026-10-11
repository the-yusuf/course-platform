import { createTestApp, type TestApp } from './utils/app.js';
import { makeFixtures } from './utils/fixtures.js';
import {
  bearer,
  data,
  newAdmin,
  newStudent,
  unknownId,
  type Session,
} from './utils/helpers.js';

let t: TestApp;
let admin: Session;
const as = (s: Session) => bearer(s.token);
const isUploadUrl = (v: unknown) =>
  typeof v === 'string' && v.startsWith('http://e2e.test/uploads/');

beforeAll(async () => {
  t = await createTestApp();
  admin = await newAdmin(t);
});
afterAll(() => t.close());

async function createCourse(title = 'Course') {
  const res = await t.http
    .post('/api/courses')
    .set(as(admin))
    .send({ title, description: 'd', price_uzs: 1 });
  return data(res) as { id: string };
}
async function enroll(student: Session, courseId: string) {
  const res = await t.http
    .post('/api/enrollments')
    .set(as(admin))
    .send({ user_id: student.user.id, course_id: courseId });
  expect(res.status).toBe(201);
  return data(res) as { id: string };
}

describe('enrollments', () => {
  it('are created by admins, once per user and course', async () => {
    const student = await newStudent(t);
    const course = await createCourse();
    const body = { user_id: student.user.id, course_id: course.id };

    const res = await t.http.post('/api/enrollments').set(as(admin)).send(body);
    expect(res.status).toBe(201);
    expect(data(res)).toMatchObject(body);

    const again = await t.http
      .post('/api/enrollments')
      .set(as(admin))
      .send(body);
    expect(again.status).toBe(409);
    expect(again.body.message).toMatch(/already enrolled/);
  });

  it.each([
    ['an unknown user', { user_id: 'UNKNOWN', course_id: 'COURSE' }, 404],
    ['an unknown course', { user_id: 'USER', course_id: 'UNKNOWN' }, 404],
    ['non-UUID ids', { user_id: 'me', course_id: 'that' }, 400],
    ['missing fields', {}, 400],
  ])('rejects %s', async (_, template, status) => {
    const student = await newStudent(t);
    const course = await createCourse();
    const body = JSON.parse(
      JSON.stringify(template)
        .replace('UNKNOWN', unknownId())
        .replace('USER', student.user.id)
        .replace('COURSE', course.id),
    );
    expect(
      (await t.http.post('/api/enrollments').set(as(admin)).send(body)).status,
    ).toBe(status);
  });

  it('are admin-only, except GET /me', async () => {
    const student = await newStudent(t);
    const course = await createCourse();
    const body = { user_id: student.user.id, course_id: course.id };
    expect((await t.http.post('/api/enrollments').send(body)).status).toBe(401);
    expect(
      (await t.http.post('/api/enrollments').set(as(student)).send(body))
        .status,
    ).toBe(403);
    expect((await t.http.get('/api/enrollments').set(as(student))).status).toBe(
      403,
    );
    expect((await t.http.get('/api/enrollments/me')).status).toBe(401);
  });

  it('show the nested user and course, with absolute file URLs', async () => {
    const student = await newStudent(t);
    const img = await makeFixtures();
    await t.http
      .put(`/api/users/${student.user.id}/update-photo`)
      .set(as(admin))
      .attach('avatar', img.png, 'a.png');
    const course = await createCourse('Nested');
    const enrollment = await enroll(student, course.id);

    const list = await t.http.get('/api/enrollments').set(as(admin));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toMatch(/password|hash/i);

    const res = await t.http
      .get(`/api/enrollments/${enrollment.id}`)
      .set(as(admin));
    expect(res.status).toBe(200);
    const view = data(res);
    expect(view.user).toMatchObject({
      id: student.user.id,
      username: student.username,
    });
    expect(isUploadUrl(view.user.avatar)).toBe(true);
    expect(view.course).toMatchObject({
      id: course.id,
      title: 'Nested',
      image: null,
      price_uzs: 1,
    });

    expect(
      (await t.http.get(`/api/enrollments/${unknownId()}`).set(as(admin)))
        .status,
    ).toBe(404);
    expect((await t.http.get('/api/enrollments/1').set(as(admin))).status).toBe(
      400,
    );
  });

  it('GET /me lists only the caller’s enrollments', async () => {
    const student = await newStudent(t);
    const other = await newStudent(t);
    const course = await createCourse();
    await enroll(student, course.id);

    const mine = data(await t.http.get('/api/enrollments/me').set(as(student)));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      user: { id: student.user.id },
      course: { id: course.id },
    });
    expect(
      data(await t.http.get('/api/enrollments/me').set(as(other))),
    ).toEqual([]);
  });

  it('are deleted by admins', async () => {
    const student = await newStudent(t);
    const enrollment = await enroll(student, (await createCourse()).id);
    expect(
      (
        await t.http
          .delete(`/api/enrollments/${enrollment.id}`)
          .set(as(student))
      ).status,
    ).toBe(403);
    expect(
      (await t.http.delete(`/api/enrollments/${enrollment.id}`).set(as(admin)))
        .status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/enrollments/${enrollment.id}`).set(as(admin)))
        .status,
    ).toBe(404);
    expect(
      (await t.http.delete(`/api/enrollments/${unknownId()}`).set(as(admin)))
        .status,
    ).toBe(404);
  });
});

describe('reviews', () => {
  let author: Session;
  let other: Session;
  let course: { id: string };
  let otherCourse: { id: string };
  let review: { id: string };

  beforeAll(async () => {
    author = await newStudent(t, 'author');
    other = await newStudent(t, 'other');
    course = await createCourse('Reviewed');
    otherCourse = await createCourse('Other');
    await enroll(author, course.id);
    const img = await makeFixtures();
    await t.http
      .put(`/api/users/${author.user.id}/update-photo`)
      .set(as(admin))
      .attach('avatar', img.png, 'a.png');
  });

  it('are written by enrolled students, as themselves, once per course', async () => {
    const res = await t.http
      .post('/api/reviews')
      .set(as(author))
      .send({ comment: '  Great course  ', course_id: course.id });
    expect(res.status).toBe(201);
    review = data(res);
    expect(data(res)).toMatchObject({
      user_id: author.user.id,
      course_id: course.id,
      comment: 'Great course',
    });

    const again = await t.http
      .post('/api/reviews')
      .set(as(author))
      .send({ comment: 'again', course_id: course.id });
    expect(again.status).toBe(409);
  });

  it.each([
    [
      'a user_id in the body (forging the author)',
      'author',
      { comment: 'x', user_id: 'OTHER', course_id: 'COURSE' },
      400,
    ],
    [
      'a course the user is not enrolled in',
      'other',
      { comment: 'x', course_id: 'COURSE' },
      403,
    ],
    ['a missing comment', 'author', { course_id: 'COURSE' }, 400],
    ['an empty comment', 'author', { comment: '', course_id: 'COURSE' }, 400],
    [
      'a whitespace-only comment',
      'author',
      { comment: '   ', course_id: 'COURSE' },
      400,
    ],
    [
      'an unknown course',
      'author',
      { comment: 'x', course_id: 'UNKNOWN' },
      404,
    ],
    ['a non-UUID course', 'author', { comment: 'x', course_id: 'abc' }, 400],
    [
      'a rating field (not supported)',
      'author',
      { comment: 'x', rating: 5, course_id: 'COURSE' },
      400,
    ],
  ])('rejects %s', async (_, who, template, status) => {
    const body = JSON.parse(
      JSON.stringify(template)
        .replace('COURSE', course.id)
        .replace('OTHER', other.user.id)
        .replace('UNKNOWN', unknownId()),
    );
    const res = await t.http
      .post('/api/reviews')
      .set(as(who === 'author' ? author : other))
      .send(body);
    expect(res.status).toBe(status);
  });

  it('need a login; admins may review without enrolling', async () => {
    expect(
      (
        await t.http
          .post('/api/reviews')
          .send({ comment: 'x', course_id: course.id })
      ).status,
    ).toBe(401);
    const res = await t.http
      .post('/api/reviews')
      .set(as(admin))
      .send({ comment: 'Staff note', course_id: otherCourse.id });
    expect(res.status).toBe(201);
    expect(data(res).user_id).toBe(admin.user.id);
  });

  it('are listed with the nested author (avatar URL) and course', async () => {
    expect((await t.http.get('/api/reviews')).status).toBe(401);
    const list = await t.http.get('/api/reviews').set(as(other));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toMatch(/password|hash/i);

    const one = data(
      await t.http.get(`/api/reviews/${review.id}`).set(as(other)),
    );
    expect(one.user.id).toBe(author.user.id);
    expect(isUploadUrl(one.user.avatar)).toBe(true);
    expect(one.course).toMatchObject({ id: course.id, title: 'Reviewed' });
    expect(
      (await t.http.get(`/api/reviews/${unknownId()}`).set(as(other))).status,
    ).toBe(404);

    const outline = data(await t.http.get(`/api/courses/${course.id}`));
    expect(outline.reviews).toEqual([
      expect.objectContaining({
        id: review.id,
        user: expect.objectContaining({ id: author.user.id }),
      }),
    ]);
  });

  it('can only be edited by their author (or an admin), and only the comment', async () => {
    const patch = (who: Session, body: object, id = review.id) =>
      t.http.patch(`/api/reviews/${id}`).set(as(who)).send(body);
    const res = await patch(author, { comment: 'Edited' });
    expect(res.status).toBe(200);
    expect(data(res).comment).toBe('Edited');

    expect((await patch(other, { comment: 'Hijacked' })).status).toBe(403);
    expect((await patch(author, { user_id: other.user.id })).status).toBe(400);
    expect((await patch(author, { course_id: otherCourse.id })).status).toBe(
      400,
    );
    expect((await patch(admin, { comment: 'Moderated' })).status).toBe(200);
    expect((await patch(author, { comment: 'x' }, unknownId())).status).toBe(
      404,
    );
  });

  it('are deleted by admins only', async () => {
    expect(
      (await t.http.delete(`/api/reviews/${review.id}`).set(as(author))).status,
    ).toBe(403);
    expect(
      (await t.http.delete(`/api/reviews/${unknownId()}`).set(as(admin)))
        .status,
    ).toBe(404);
    expect(
      (await t.http.delete(`/api/reviews/${review.id}`).set(as(admin))).status,
    ).toBe(200);
  });
});

describe('cascades', () => {
  it('a course with enrollments cannot be deleted; without, it takes its lessons and reviews', async () => {
    const student = await newStudent(t);
    const course = await createCourse();
    const lesson = data(
      await t.http.post('/api/lessons').set(as(admin)).send({
        title_uz: 'a',
        title_ru: 'b',
        title_en: 'c',
        course_id: course.id,
      }),
    );
    const enrollment = await enroll(student, course.id);
    const review = data(
      await t.http
        .post('/api/reviews')
        .set(as(student))
        .send({ comment: 'ok', course_id: course.id }),
    );

    expect(
      (await t.http.delete(`/api/courses/${course.id}`).set(as(admin))).status,
    ).toBe(409);
    await t.http.delete(`/api/enrollments/${enrollment.id}`).set(as(admin));
    expect(
      (await t.http.delete(`/api/courses/${course.id}`).set(as(admin))).status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/lessons/${lesson.id}`).set(as(admin))).status,
    ).toBe(404);
    expect(
      (await t.http.get(`/api/reviews/${review.id}`).set(as(admin))).status,
    ).toBe(404);
  });

  it('deleting a user removes their enrollments, reviews and session', async () => {
    const student = await newStudent(t);
    const course = await createCourse();
    const enrollment = await enroll(student, course.id);
    const review = data(
      await t.http
        .post('/api/reviews')
        .set(as(student))
        .send({ comment: 'bye', course_id: course.id }),
    );

    expect(
      (await t.http.delete(`/api/users/${student.user.id}`).set(as(admin)))
        .status,
    ).toBe(204);
    expect(
      (await t.http.get(`/api/enrollments/${enrollment.id}`).set(as(admin)))
        .status,
    ).toBe(404);
    expect(
      (await t.http.get(`/api/reviews/${review.id}`).set(as(admin))).status,
    ).toBe(404);
    expect((await t.http.get('/api/auth/me').set(as(student))).status).toBe(
      401,
    );
  });
});
