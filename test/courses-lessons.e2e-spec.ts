import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { createTestApp, type TestApp } from './utils/app.js';
import { makeFixtures, type Fixtures } from './utils/fixtures.js';
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
let student: Session;
let img: Fixtures;

beforeAll(async () => {
  t = await createTestApp();
  admin = await newAdmin(t);
  student = await newStudent(t);
  img = await makeFixtures();
});
afterAll(() => t.close());

const urlPath = (url: string) => new URL(url).pathname;
const onDisk = (url: string) =>
  existsSync(path.join(t.uploadDir, urlPath(url).replace(/^\/uploads\//, '')));
const courseFiles = async () =>
  existsSync(path.join(t.uploadDir, 'courses'))
    ? (await readdir(path.join(t.uploadDir, 'courses'))).length
    : 0;

async function createCourse(body: object = {}) {
  const res = await t.http
    .post('/api/courses')
    .set(bearer(admin.token))
    .send({ title: 'Course', description: 'desc', price_uzs: 100000, ...body });
  expect(res.status).toBe(201);
  return data(res);
}

async function createLesson(courseId: string, body: object = {}) {
  const res = await t.http
    .post('/api/lessons')
    .set(bearer(admin.token))
    .send({
      title_uz: 'Dars',
      title_ru: 'Урок',
      title_en: 'Lesson',
      course_id: courseId,
      ...body,
    });
  expect(res.status).toBe(201);
  return data(res);
}

describe('courses', () => {
  it('creates a course from JSON', async () => {
    const course = await createCourse({ title: 'JSON course', price_uzs: 0 });
    expect(course).toMatchObject({
      title: 'JSON course',
      price_uzs: 0,
      image: null,
    });
  });

  it('creates a course from multipart with an image, converting the price', async () => {
    const res = await t.http
      .post('/api/courses')
      .set(bearer(admin.token))
      .field('title', 'With image')
      .field('description', 'desc')
      .field('price_uzs', '250000')
      .attach('image', img.png, 'c.png');
    expect(res.status).toBe(201);
    const course = data(res);
    expect(course.price_uzs).toBe(250000);
    const served = await t.http.get(urlPath(course.image));
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');
  });

  it('requires admin', async () => {
    const body = { title: 'x', description: 'x', price_uzs: 1 };
    expect((await t.http.post('/api/courses').send(body)).status).toBe(401);
    expect(
      (await t.http.post('/api/courses').set(bearer(student.token)).send(body))
        .status,
    ).toBe(403);
  });

  it.each([
    ['missing title', { description: 'x', price_uzs: 1 }],
    ['missing price', { title: 'x', description: 'x' }],
    ['negative price', { title: 'x', description: 'x', price_uzs: -1 }],
    ['fractional price', { title: 'x', description: 'x', price_uzs: 12.5 }],
    ['non-numeric price', { title: 'x', description: 'x', price_uzs: 'abc' }],
    ['price over int32', { title: 'x', description: 'x', price_uzs: 2 ** 31 }],
    [
      'whitespace-only title',
      { title: '   ', description: '   ', price_uzs: 1 },
    ],
    [
      'unknown field',
      { title: 'x', description: 'x', price_uzs: 1, owner: 'me' },
    ],
  ])('rejects %s with 400', async (_, body) => {
    expect(
      (await t.http.post('/api/courses').set(bearer(admin.token)).send(body))
        .status,
    ).toBe(400);
  });

  it.each([
    ['an empty multipart price', (r: any) => r.field('price_uzs', ''), 400],
    [
      'image sent as text',
      (r: any) => r.field('price_uzs', '1').field('image', 'not-a-file'),
      400,
    ],
    [
      'a fake image',
      (r: any) => r.field('price_uzs', '1').attach('image', img.fake, 'f.png'),
      400,
    ],
    [
      'a 6 MB image',
      (r: any) => r.field('price_uzs', '1').attach('image', img.big, 'b.png'),
      413,
    ],
  ])('rejects %s', async (_, build, status) => {
    const req = t.http
      .post('/api/courses')
      .set(bearer(admin.token))
      .field('title', 'x')
      .field('description', 'x');
    expect((await build(req)).status).toBe(status);
  });

  it('lists courses publicly with lesson and review counts', async () => {
    const course = await createCourse();
    await createLesson(course.id);
    const res = await t.http.get('/api/courses?limit=100');
    expect(res.status).toBe(200);
    const listed = data(res).find((c: any) => c.id === course.id);
    expect(listed).toMatchObject({ lessons_count: 1, reviews_count: 0 });
  });

  it('shows a public course outline: lessons in order, without video links', async () => {
    const course = await createCourse();
    await createLesson(course.id, {
      title_en: 'First',
      video: 'https://example.com/1.mp4',
    });
    await createLesson(course.id, { title_en: 'Second' });

    const res = await t.http.get(`/api/courses/${course.id}`);
    expect(res.status).toBe(200);
    const outline = data(res);
    expect(outline.lessons.map((l: any) => l.title_en)).toEqual([
      'First',
      'Second',
    ]);
    expect(outline.lessons.map((l: any) => l.position)).toEqual([1, 2]);
    expect(outline.lessons.every((l: any) => !('video' in l))).toBe(true);
    expect(outline.reviews).toEqual([]);

    expect((await t.http.get(`/api/courses/${unknownId()}`)).status).toBe(404);
    expect((await t.http.get('/api/courses/not-a-uuid')).status).toBe(400);
  });

  it('updates fields, including falsy ones', async () => {
    const course = await createCourse({ title: 'Old', description: 'keep' });
    let res = await t.http
      .patch(`/api/courses/${course.id}`)
      .set(bearer(admin.token))
      .send({ title: 'New', price_uzs: 120000 });
    expect(res.status).toBe(200);
    expect(data(res)).toMatchObject({
      title: 'New',
      description: 'keep',
      price_uzs: 120000,
    });

    res = await t.http
      .patch(`/api/courses/${course.id}`)
      .set(bearer(admin.token))
      .send({ price_uzs: 0 });
    expect(data(res).price_uzs).toBe(0);

    expect(
      (
        await t.http
          .patch(`/api/courses/${course.id}`)
          .set(bearer(admin.token))
          .send({ price_uzs: -5 })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.http
          .patch(`/api/courses/${course.id}`)
          .set(bearer(student.token))
          .send({ title: 'x' })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.http
          .patch(`/api/courses/${unknownId()}`)
          .set(bearer(admin.token))
          .send({ title: 'x' })
      ).status,
    ).toBe(404);
  });

  it('replaces the image file, and leaves no orphan on a 404', async () => {
    const created = await t.http
      .post('/api/courses')
      .set(bearer(admin.token))
      .field('title', 'Img')
      .field('description', 'd')
      .field('price_uzs', '1')
      .attach('image', img.png, 'c.png');
    const course = data(created);

    const res = await t.http
      .patch(`/api/courses/${course.id}`)
      .set(bearer(admin.token))
      .attach('image', img.jpg, 'n.jpg');
    expect(res.status).toBe(200);
    expect(data(res).image).not.toBe(course.image);
    expect((await t.http.get(urlPath(course.image))).status).toBe(404);

    const before = await courseFiles();
    const missing = await t.http
      .patch(`/api/courses/${unknownId()}`)
      .set(bearer(admin.token))
      .attach('image', img.png, 'n.png');
    expect(missing.status).toBe(404);
    expect(await courseFiles()).toBe(before);
  });

  it('deletes a course and its image', async () => {
    const created = await t.http
      .post('/api/courses')
      .set(bearer(admin.token))
      .field('title', 'Del')
      .field('description', 'd')
      .field('price_uzs', '1')
      .attach('image', img.png, 'c.png');
    const course = data(created);

    expect(
      (
        await t.http
          .delete(`/api/courses/${course.id}`)
          .set(bearer(student.token))
      ).status,
    ).toBe(403);
    const res = await t.http
      .delete(`/api/courses/${course.id}`)
      .set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(data(res).image).toBeNull();
    expect(onDisk(course.image)).toBe(false);
    expect(
      (
        await t.http
          .delete(`/api/courses/${course.id}`)
          .set(bearer(admin.token))
      ).status,
    ).toBe(404);
  });
});

describe('lessons', () => {
  let course: { id: string };
  beforeAll(async () => {
    course = await createCourse({ title: 'Lessons course' });
  });

  it('are admin-only to write', async () => {
    const body = {
      title_uz: 'a',
      title_ru: 'b',
      title_en: 'c',
      course_id: course.id,
    };
    expect((await t.http.post('/api/lessons').send(body)).status).toBe(401);
    expect(
      (await t.http.post('/api/lessons').set(bearer(student.token)).send(body))
        .status,
    ).toBe(403);

    const lesson = await createLesson(course.id);
    expect(
      (
        await t.http
          .patch(`/api/lessons/${lesson.id}`)
          .set(bearer(student.token))
          .send({ title_en: 'x' })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.http
          .delete(`/api/lessons/${lesson.id}`)
          .set(bearer(student.token))
      ).status,
    ).toBe(403);
  });

  it.each([
    ['missing titles', { course_id: 'COURSE' }, 400],
    [
      'a numeric video',
      {
        title_uz: 'a',
        title_ru: 'b',
        title_en: 'c',
        video: 123,
        course_id: 'COURSE',
      },
      400,
    ],
    [
      'a non-https video',
      {
        title_uz: 'a',
        title_ru: 'b',
        title_en: 'c',
        video: 'http://example.com/v.mp4',
        course_id: 'COURSE',
      },
      400,
    ],
    [
      'a video that is not a URL',
      {
        title_uz: 'a',
        title_ru: 'b',
        title_en: 'c',
        video: 'my video',
        course_id: 'COURSE',
      },
      400,
    ],
    [
      'a 201 character title',
      {
        title_uz: 'x'.repeat(201),
        title_ru: 'b',
        title_en: 'c',
        course_id: 'COURSE',
      },
      400,
    ],
    [
      'a non-UUID course_id',
      { title_uz: 'a', title_ru: 'b', title_en: 'c', course_id: 'abc' },
      400,
    ],
    [
      'an unknown course',
      { title_uz: 'a', title_ru: 'b', title_en: 'c', course_id: 'UNKNOWN' },
      404,
    ],
  ])('rejects %s', async (_, body, status) => {
    const payload = JSON.parse(
      JSON.stringify(body)
        .replace('COURSE', course.id)
        .replace('UNKNOWN', unknownId()),
    );
    expect(
      (await t.http.post('/api/lessons').set(bearer(admin.token)).send(payload))
        .status,
    ).toBe(status);
  });

  it('appends new lessons at the end of their course', async () => {
    const own = await createCourse();
    const a = await createLesson(own.id);
    const b = await createLesson(own.id);
    expect([a.position, b.position]).toEqual([1, 2]);
  });

  it('lists all lessons for admins only', async () => {
    await createLesson(course.id);
    const res = await t.http.get('/api/lessons').set(bearer(admin.token));
    expect(res.status).toBe(200);
    expect(data(res)[0]).toMatchObject({
      dictionaries_count: expect.any(Number),
      grammars_count: expect.any(Number),
    });
    expect(
      (await t.http.get('/api/lessons').set(bearer(student.token))).status,
    ).toBe(403);
    expect((await t.http.get('/api/lessons')).status).toBe(401);
  });

  it('shows a lesson to admins and enrolled students only', async () => {
    const lesson = await createLesson(course.id, {
      video: 'https://example.com/v.mp4',
    });

    const asAdmin = await t.http
      .get(`/api/lessons/${lesson.id}`)
      .set(bearer(admin.token));
    expect(asAdmin.status).toBe(200);
    expect(data(asAdmin)).toMatchObject({
      video: 'https://example.com/v.mp4',
      dictionaries: [],
      grammars: [],
    });

    const notEnrolled = await t.http
      .get(`/api/lessons/${lesson.id}`)
      .set(bearer(student.token));
    expect(notEnrolled.status).toBe(403);

    await t.db
      .insertInto('enrollments')
      .values({ user_id: student.user.id, course_id: course.id })
      .execute();
    expect(
      (await t.http.get(`/api/lessons/${lesson.id}`).set(bearer(student.token)))
        .status,
    ).toBe(200);

    expect(
      (
        await t.http
          .get(`/api/lessons/${unknownId()}`)
          .set(bearer(student.token))
      ).status,
    ).toBe(404);
    expect(
      (await t.http.get('/api/lessons/xyz').set(bearer(student.token))).status,
    ).toBe(400);
  });

  it('updates a lesson; "" clears the video; null on a required field is a 400', async () => {
    const lesson = await createLesson(course.id, {
      video: 'https://example.com/v.mp4',
    });
    const patch = (id: string, body: object) =>
      t.http.patch(`/api/lessons/${id}`).set(bearer(admin.token)).send(body);

    let res = await patch(lesson.id, { title_en: 'Edited' });
    expect(res.status).toBe(200);
    expect(data(res).title_en).toBe('Edited');

    res = await patch(lesson.id, { video: '' });
    expect(data(res).video).toBeNull();

    expect((await patch(lesson.id, { title_en: '' })).status).toBe(400);
    expect((await patch(lesson.id, { title_en: null })).status).toBe(400);
    expect((await patch(unknownId(), { title_en: 'x' })).status).toBe(404);
  });

  it('appends a lesson moved to another course, and keeps its place otherwise', async () => {
    const from = await createCourse();
    const to = await createCourse();
    await createLesson(to.id);
    await createLesson(to.id);
    const lesson = await createLesson(from.id);

    let res = await t.http
      .patch(`/api/lessons/${lesson.id}`)
      .set(bearer(admin.token))
      .send({ course_id: from.id });
    expect(data(res).position).toBe(1);

    res = await t.http
      .patch(`/api/lessons/${lesson.id}`)
      .set(bearer(admin.token))
      .send({ course_id: to.id });
    expect(data(res)).toMatchObject({ course_id: to.id, position: 3 });
  });

  it('deletes a lesson', async () => {
    const lesson = await createLesson(course.id);
    expect(
      (
        await t.http
          .delete(`/api/lessons/${lesson.id}`)
          .set(bearer(admin.token))
      ).status,
    ).toBe(200);
    expect(
      (
        await t.http
          .delete(`/api/lessons/${lesson.id}`)
          .set(bearer(admin.token))
      ).status,
    ).toBe(404);
  });
});

describe('missing references', () => {
  it('name the missing reference outside production', async () => {
    const res = await t.http
      .post('/api/lessons')
      .set(bearer(admin.token))
      .send({
        title_uz: 'a',
        title_ru: 'b',
        title_en: 'c',
        course_id: unknownId(),
      });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/^course_id .+ not found$/);
  });
});

describe('PUT /api/courses/:id/lessons/order', () => {
  const reorder = (
    courseId: string,
    lessonIds: string[],
    token = admin.token,
  ) =>
    t.http
      .put(`/api/courses/${courseId}/lessons/order`)
      .set(bearer(token))
      .send({ lesson_ids: lessonIds });

  it('sets the order and returns the new outline', async () => {
    const course = await createCourse();
    const a = await createLesson(course.id, { title_en: 'A' });
    const b = await createLesson(course.id, { title_en: 'B' });
    const c = await createLesson(course.id, { title_en: 'C' });

    const res = await reorder(course.id, [c.id, a.id, b.id]);
    expect(res.status).toBe(200);
    expect(data(res).map((l: any) => [l.title_en, l.position])).toEqual([
      ['C', 1],
      ['A', 2],
      ['B', 3],
    ]);

    // the public outline follows the new order
    const outline = data(await t.http.get(`/api/courses/${course.id}`));
    expect(outline.lessons.map((l: any) => l.title_en)).toEqual([
      'C',
      'A',
      'B',
    ]);
  });

  it('requires exactly the course’s lessons, once each', async () => {
    const course = await createCourse();
    const a = await createLesson(course.id);
    const b = await createLesson(course.id);
    const elsewhere = await createLesson((await createCourse()).id);

    expect((await reorder(course.id, [a.id])).status).toBe(400); // missing one
    expect((await reorder(course.id, [a.id, b.id, elsewhere.id])).status).toBe(
      400,
    ); // foreign lesson
    expect((await reorder(course.id, [a.id, a.id])).status).toBe(400); // duplicate
    expect((await reorder(course.id, [a.id, 'nope'])).status).toBe(400); // not a uuid
  });

  it('404s for an unknown course, accepts [] for an empty one, and is admin-only', async () => {
    expect((await reorder(unknownId(), [])).status).toBe(404);
    const empty = await createCourse();
    const res = await reorder(empty.id, []);
    expect(res.status).toBe(200);
    expect(data(res)).toEqual([]);
    expect((await reorder(empty.id, [], student.token)).status).toBe(403);
  });
});
