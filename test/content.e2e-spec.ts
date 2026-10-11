import { createTestApp, type TestApp } from './utils/app.js';
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
let course: { id: string };
let lesson: { id: string };

beforeAll(async () => {
  t = await createTestApp();
  admin = await newAdmin(t);
  student = await newStudent(t);
  course = data(
    await t.http
      .post('/api/courses')
      .set(bearer(admin.token))
      .send({ title: 'C', description: 'd', price_uzs: 1 }),
  );
  lesson = data(
    await t.http.post('/api/lessons').set(bearer(admin.token)).send({
      title_uz: 'a',
      title_ru: 'b',
      title_en: 'c',
      course_id: course.id,
    }),
  );
});
afterAll(() => t.close());

const as = (s: Session) => bearer(s.token);

async function createCategory(name = 'Animals') {
  const res = await t.http
    .post('/api/dictionary-categories')
    .set(as(admin))
    .send({ name_uz: 'Hayvonlar', name_ru: 'Животные', name_en: name });
  expect(res.status).toBe(201);
  return data(res);
}

const word = (categoryId: string, extra: object = {}) => ({
  word_uz: 'mushuk',
  word_ru: 'кошка',
  word_en: 'cat',
  word_zh: '猫',
  example_uz: 'Bu mushuk',
  example_ru: 'Это кошка',
  example_en: 'This is a cat',
  example_zh: '这是猫',
  pronunciation: 'māo',
  example_pronunciation: 'zhè shì māo',
  category_id: categoryId,
  ...extra,
});

const grammar = (extra: object = {}) => ({
  title: '是 sentences',
  description: 'A 是 B',
  example: '我是学生',
  example_uz: 'Men talabaman',
  example_ru: 'Я студент',
  example_en: 'I am a student',
  ...extra,
});

const story = (extra: object = {}) => ({
  title: '小猫',
  title_uz: 'Mushukcha',
  title_ru: 'Котёнок',
  title_en: 'Kitten',
  content: '有一只小猫。',
  content_uz: 'Bir mushukcha bor edi.',
  content_ru: 'Жил-был котёнок.',
  content_en: 'There was a kitten.',
  level: 'hsk1',
  ...extra,
});

describe('dictionary categories', () => {
  it('are admin-only to write, with validation', async () => {
    const body = { name_uz: 'a', name_ru: 'b', name_en: 'c' };
    expect(
      (await t.http.post('/api/dictionary-categories').send(body)).status,
    ).toBe(401);
    expect(
      (
        await t.http
          .post('/api/dictionary-categories')
          .set(as(student))
          .send(body)
      ).status,
    ).toBe(403);
    expect(
      (
        await t.http
          .post('/api/dictionary-categories')
          .set(as(admin))
          .send({ name_uz: 'a', name_ru: 'b' })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.http
          .post('/api/dictionary-categories')
          .set(as(admin))
          .send({ name_uz: '', name_ru: '', name_en: '' })
      ).status,
    ).toBe(400);
  });

  it('list and detail are public', async () => {
    const category = await createCategory();
    const list = await t.http.get('/api/dictionary-categories?limit=100');
    expect(list.status).toBe(200);
    expect(data(list).find((c: any) => c.id === category.id)).toMatchObject({
      dictionaries_count: 0,
    });

    const detail = await t.http.get(
      `/api/dictionary-categories/${category.id}`,
    );
    expect(detail.status).toBe(200);
    expect(data(detail).dictionaries).toEqual([]);

    expect(
      (await t.http.get(`/api/dictionary-categories/${unknownId()}`)).status,
    ).toBe(404);
    expect((await t.http.get('/api/dictionary-categories/1')).status).toBe(400);
  });

  it('update and delete: admin only, 404 when missing', async () => {
    const category = await createCategory();
    const res = await t.http
      .patch(`/api/dictionary-categories/${category.id}`)
      .set(as(admin))
      .send({ name_en: 'Animals!' });
    expect(res.status).toBe(200);
    expect(data(res).name_en).toBe('Animals!');

    expect(
      (
        await t.http
          .patch(`/api/dictionary-categories/${category.id}`)
          .set(as(student))
          .send({ name_en: 'x' })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.http
          .patch(`/api/dictionary-categories/${category.id}`)
          .set(as(admin))
          .send({ name_zh: 'x' })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.http
          .patch(`/api/dictionary-categories/${unknownId()}`)
          .set(as(admin))
          .send({ name_en: 'x' })
      ).status,
    ).toBe(404);
    expect(
      (
        await t.http
          .delete(`/api/dictionary-categories/${category.id}`)
          .set(as(student))
      ).status,
    ).toBe(403);
    expect(
      (
        await t.http
          .delete(`/api/dictionary-categories/${unknownId()}`)
          .set(as(admin))
      ).status,
    ).toBe(404);
  });

  it('deleting a category deletes its words', async () => {
    const category = await createCategory();
    const entry = data(
      await t.http
        .post('/api/dictionaries')
        .set(as(admin))
        .send(word(category.id)),
    );
    expect(
      (
        await t.http
          .delete(`/api/dictionary-categories/${category.id}`)
          .set(as(admin))
      ).status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/dictionaries/${entry.id}`).set(as(admin))).status,
    ).toBe(404);
  });
});

describe('dictionaries', () => {
  let category: { id: string };
  beforeAll(async () => {
    category = await createCategory('Words');
  });

  it('creates words with and without a lesson', async () => {
    let res = await t.http
      .post('/api/dictionaries')
      .set(as(admin))
      .send(word(category.id, { lesson_id: lesson.id }));
    expect(res.status).toBe(201);
    expect(data(res)).toMatchObject({ word_zh: '猫', lesson_id: lesson.id });

    res = await t.http
      .post('/api/dictionaries')
      .set(as(admin))
      .send(word(category.id, { word_en: 'red', word_zh: '红' }));
    expect(res.status).toBe(201);
    expect(data(res).lesson_id).toBeNull();
  });

  it.each([
    ['a student', 'student', {}, 403],
    ['missing fields', 'admin', { word_en: 'x' }, 400],
    [
      'a missing example (required, NOT NULL in DB)',
      'admin',
      { example_zh: undefined },
      400,
    ],
    ['a non-UUID category', 'admin', { category_id: 'cats' }, 400],
    ['an unknown category', 'admin', { category_id: 'UNKNOWN' }, 404],
    ['an unknown lesson', 'admin', { lesson_id: 'UNKNOWN' }, 404],
  ])('rejects %s', async (_, who, override, status) => {
    const payload: any = Object.keys(override).includes('word_en')
      ? override
      : word(category.id, override);
    for (const key of Object.keys(payload)) {
      if (payload[key] === 'UNKNOWN') payload[key] = unknownId();
      if (payload[key] === undefined) delete payload[key];
    }
    const res = await t.http
      .post('/api/dictionaries')
      .set(as(who === 'admin' ? admin : student))
      .send(payload);
    expect(res.status).toBe(status);
  });

  it('reads words (logged-in only)', async () => {
    const entry = data(
      await t.http
        .post('/api/dictionaries')
        .set(as(admin))
        .send(word(category.id)),
    );
    expect((await t.http.get('/api/dictionaries')).status).toBe(401);
    expect(
      (await t.http.get('/api/dictionaries').set(as(student))).status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/dictionaries/${entry.id}`).set(as(student)))
        .status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/dictionaries/${unknownId()}`).set(as(student)))
        .status,
    ).toBe(404);
  });

  it('updates words: links/unlinks lessons, rejects nulls and unknown references', async () => {
    const entry = data(
      await t.http
        .post('/api/dictionaries')
        .set(as(admin))
        .send(word(category.id)),
    );
    const patch = (id: string, body: object, who = admin) =>
      t.http.patch(`/api/dictionaries/${id}`).set(as(who)).send(body);

    let res = await patch(entry.id, { word_en: 'kitty' });
    expect(data(res).word_en).toBe('kitty');

    res = await patch(entry.id, { lesson_id: lesson.id });
    expect(data(res).lesson_id).toBe(lesson.id);
    res = await patch(entry.id, { lesson_id: null });
    expect(data(res).lesson_id).toBeNull();

    expect((await patch(entry.id, { example_zh: null })).status).toBe(400);
    expect((await patch(entry.id, { category_id: unknownId() })).status).toBe(
      404,
    );
    expect((await patch(entry.id, { word_en: 'x' }, student)).status).toBe(403);
    expect((await patch(unknownId(), { word_en: 'x' })).status).toBe(404);
    expect(
      (await t.http.delete(`/api/dictionaries/${entry.id}`).set(as(student)))
        .status,
    ).toBe(403);
    expect(
      (await t.http.delete(`/api/dictionaries/${unknownId()}`).set(as(admin)))
        .status,
    ).toBe(404);
  });
});

describe('grammars', () => {
  it('creates, reads, updates and deletes', async () => {
    let res = await t.http
      .post('/api/grammars')
      .set(as(admin))
      .send(grammar({ lesson_id: lesson.id }));
    expect(res.status).toBe(201);
    const item = data(res);
    expect(item.lesson_id).toBe(lesson.id);

    expect(
      (await t.http.post('/api/grammars').set(as(admin)).send(grammar()))
        .status,
    ).toBe(201);
    expect((await t.http.get('/api/grammars')).status).toBe(401);
    expect((await t.http.get('/api/grammars').set(as(student))).status).toBe(
      200,
    );
    expect(
      (await t.http.get(`/api/grammars/${item.id}`).set(as(admin))).status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/grammars/${unknownId()}`).set(as(student)))
        .status,
    ).toBe(404);

    res = await t.http
      .patch(`/api/grammars/${item.id}`)
      .set(as(admin))
      .send({ title: 'edited' });
    expect(data(res).title).toBe('edited');
    expect(
      (
        await t.http
          .patch(`/api/grammars/${unknownId()}`)
          .set(as(admin))
          .send({ title: 'x' })
      ).status,
    ).toBe(404);

    expect(
      (await t.http.delete(`/api/grammars/${item.id}`).set(as(student))).status,
    ).toBe(403);
    expect(
      (await t.http.delete(`/api/grammars/${item.id}`).set(as(admin))).status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/grammars/${item.id}`).set(as(admin))).status,
    ).toBe(404);
    expect(
      (await t.http.delete(`/api/grammars/${unknownId()}`).set(as(admin)))
        .status,
    ).toBe(404);
  });

  it.each([
    ['a student', 'student', grammar(), 403],
    ['missing fields', 'admin', { title: 'x' }, 400],
    ['a non-UUID lesson', 'admin', grammar({ lesson_id: 'one' }), 400],
    [
      'an unknown lesson',
      'admin',
      grammar({ lesson_id: '00000000-0000-4000-8000-000000000000' }),
      404,
    ],
  ])('rejects %s', async (_, who, body, status) => {
    expect(
      (
        await t.http
          .post('/api/grammars')
          .set(as(who === 'admin' ? admin : student))
          .send(body)
      ).status,
    ).toBe(status);
  });
});

describe('stories', () => {
  it('creates, reads, updates and deletes', async () => {
    let res = await t.http.post('/api/stories').set(as(admin)).send(story());
    expect(res.status).toBe(201);
    const item = data(res);
    expect(
      (
        await t.http
          .post('/api/stories')
          .set(as(admin))
          .send(story({ level: 'hsk6' }))
      ).status,
    ).toBe(201);

    expect((await t.http.get('/api/stories')).status).toBe(401);
    expect((await t.http.get('/api/stories').set(as(student))).status).toBe(
      200,
    );
    expect(
      (await t.http.get(`/api/stories/${item.id}`).set(as(student))).status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/stories/${unknownId()}`).set(as(student))).status,
    ).toBe(404);

    res = await t.http
      .patch(`/api/stories/${item.id}`)
      .set(as(admin))
      .send({ level: 'hsk2' });
    expect(data(res).level).toBe('hsk2');
    expect(
      (
        await t.http
          .patch(`/api/stories/${item.id}`)
          .set(as(admin))
          .send({ level: 'expert' })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.http
          .patch(`/api/stories/${item.id}`)
          .set(as(student))
          .send({ title: 'x' })
      ).status,
    ).toBe(403);
    expect(
      (
        await t.http
          .patch(`/api/stories/${unknownId()}`)
          .set(as(admin))
          .send({ title: 'x' })
      ).status,
    ).toBe(404);

    expect(
      (await t.http.delete(`/api/stories/${item.id}`).set(as(student))).status,
    ).toBe(403);
    expect(
      (await t.http.delete(`/api/stories/${item.id}`).set(as(admin))).status,
    ).toBe(200);
    expect(
      (await t.http.delete(`/api/stories/${item.id}`).set(as(admin))).status,
    ).toBe(404);
  });

  it.each([
    ['a student', 'student', story(), 403],
    ['missing fields', 'admin', { title: 'x' }, 400],
    ['level hsk9', 'admin', story({ level: 'hsk9' }), 400],
    ['level HSK1 (case)', 'admin', story({ level: 'HSK1' }), 400],
  ])('rejects %s', async (_, who, body, status) => {
    expect(
      (
        await t.http
          .post('/api/stories')
          .set(as(who === 'admin' ? admin : student))
          .send(body)
      ).status,
    ).toBe(status);
  });
});

describe('lesson content gating', () => {
  it('lesson words and grammar are visible only after enrolling; free ones always', async () => {
    const reader = await newStudent(t, 'reader');
    const category = await createCategory('Gated');
    const free = data(
      await t.http
        .post('/api/dictionaries')
        .set(as(admin))
        .send(word(category.id)),
    );
    const paid = data(
      await t.http
        .post('/api/dictionaries')
        .set(as(admin))
        .send(word(category.id, { lesson_id: lesson.id })),
    );
    const freeRule = data(
      await t.http.post('/api/grammars').set(as(admin)).send(grammar()),
    );
    const paidRule = data(
      await t.http
        .post('/api/grammars')
        .set(as(admin))
        .send(grammar({ lesson_id: lesson.id })),
    );
    const ids = (res: { body: unknown }) =>
      (data(res as never) as { id: string }[]).map((x) => x.id);

    // not enrolled
    let words = ids(
      await t.http.get('/api/dictionaries?limit=100').set(as(reader)),
    );
    expect(words).toContain(free.id);
    expect(words).not.toContain(paid.id);
    let rules = ids(
      await t.http.get('/api/grammars?limit=100').set(as(reader)),
    );
    expect(rules).toContain(freeRule.id);
    expect(rules).not.toContain(paidRule.id);
    expect(
      (await t.http.get(`/api/dictionaries/${paid.id}`).set(as(reader))).status,
    ).toBe(403);
    expect(
      (await t.http.get(`/api/grammars/${paidRule.id}`).set(as(reader))).status,
    ).toBe(403);

    // the public category page only shows free words
    const detail = data(
      await t.http.get(`/api/dictionary-categories/${category.id}`),
    );
    expect(detail.dictionaries.map((d: { id: string }) => d.id)).toEqual([
      free.id,
    ]);
    const listed = data(
      await t.http.get('/api/dictionary-categories?limit=100'),
    ).find((c: { id: string }) => c.id === category.id);
    expect(listed.dictionaries_count).toBe(1);

    // admins see everything
    expect(
      ids(await t.http.get('/api/dictionaries?limit=100').set(as(admin))),
    ).toContain(paid.id);

    // enrolled
    await t.db
      .insertInto('enrollments')
      .values({ user_id: reader.user.id, course_id: course.id })
      .execute();
    words = ids(
      await t.http.get('/api/dictionaries?limit=100').set(as(reader)),
    );
    expect(words).toEqual(expect.arrayContaining([free.id, paid.id]));
    rules = ids(await t.http.get('/api/grammars?limit=100').set(as(reader)));
    expect(rules).toEqual(expect.arrayContaining([freeRule.id, paidRule.id]));
    expect(
      (await t.http.get(`/api/dictionaries/${paid.id}`).set(as(reader))).status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/grammars/${paidRule.id}`).set(as(reader))).status,
    ).toBe(200);
  });
});

describe('input limits', () => {
  it.each([
    [
      'a 201 character category name',
      '/api/dictionary-categories',
      () => ({ name_uz: 'a', name_ru: 'b', name_en: 'x'.repeat(201) }),
    ],
    [
      'a 1001 character example',
      '/api/dictionaries',
      (c: string) => word(c, { example_en: 'x'.repeat(1001) }),
    ],
    [
      'a 20001 character story',
      '/api/stories',
      () => story({ content: 'x'.repeat(20001) }),
    ],
  ])('rejects %s', async (_, url, body) => {
    const category = await createCategory();
    const res = await t.http.post(url).set(as(admin)).send(body(category.id));
    expect(res.status).toBe(400);
  });
});

describe('lesson cascades', () => {
  it('deleting a lesson deletes its words and grammar', async () => {
    const own = data(
      await t.http.post('/api/lessons').set(as(admin)).send({
        title_uz: 'a',
        title_ru: 'b',
        title_en: 'c',
        course_id: course.id,
      }),
    );
    const category = await createCategory();
    const entry = data(
      await t.http
        .post('/api/dictionaries')
        .set(as(admin))
        .send(word(category.id, { lesson_id: own.id })),
    );
    const rule = data(
      await t.http
        .post('/api/grammars')
        .set(as(admin))
        .send(grammar({ lesson_id: own.id })),
    );

    const detail = await t.http.get(`/api/lessons/${own.id}`).set(as(admin));
    expect(data(detail).dictionaries.map((d: any) => d.id)).toEqual([entry.id]);
    expect(data(detail).grammars.map((g: any) => g.id)).toEqual([rule.id]);

    expect(
      (await t.http.delete(`/api/lessons/${own.id}`).set(as(admin))).status,
    ).toBe(200);
    expect(
      (await t.http.get(`/api/dictionaries/${entry.id}`).set(as(admin))).status,
    ).toBe(404);
    expect(
      (await t.http.get(`/api/grammars/${rule.id}`).set(as(admin))).status,
    ).toBe(404);
  });
});
