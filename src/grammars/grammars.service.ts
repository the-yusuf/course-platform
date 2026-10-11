import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Database } from '../database/database.js';
import { CreateGrammarDto } from './dto/create-grammar.dto.js';
import { UpdateGrammarDto } from './dto/update-grammar.dto.js';
import { paginate, PaginationQueryDto } from '../common/pagination.js';
import { definedFields } from '../common/query-helpers.js';
import type { AuthUser } from '../auth/auth.types.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';

@Injectable()
export class GrammarsService {
  constructor(
    private readonly db: Database,
    private readonly enrollments: EnrollmentsService,
  ) {}

  /** Students see free grammar plus that of lessons they're enrolled in */
  findAll(user: AuthUser, query: PaginationQueryDto) {
    const list = this.db
      .selectFrom('grammars')
      .selectAll()
      .$if(user.role !== 'admin', (qb) =>
        qb.where((eb) =>
          eb.or([
            eb('lesson_id', 'is', null),
            eb('lesson_id', 'in', this.enrollments.enrolledLessonIds(user.id)),
          ]),
        ),
      )
      .orderBy('created_at')
      .orderBy('id');
    return paginate(list, query);
  }

  async findOne(id: string, user: AuthUser) {
    const grammar = await this.db
      .selectFrom('grammars')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!grammar)
      throw new NotFoundException(`Grammar with this id ${id} not found`);
    if (!(await this.enrollments.canAccessLesson(user, grammar.lesson_id)))
      throw new ForbiddenException('You must be enrolled in this course');

    return grammar;
  }

  async create(dto: CreateGrammarDto) {
    const grammar = await this.db
      .insertInto('grammars')
      .values(dto)
      .returningAll()
      .executeTakeFirst();

    return grammar;
  }

  async update(id: string, dto: UpdateGrammarDto) {
    const grammar = await this.db
      .updateTable('grammars')
      .set({ ...definedFields(dto), updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!grammar)
      throw new NotFoundException(`Grammar with this id ${id} not found`);

    return grammar;
  }

  async remove(id: string) {
    const grammar = await this.db
      .deleteFrom('grammars')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
    if (!grammar)
      throw new NotFoundException(`Grammar with this id ${id} not found`);

    return grammar;
  }
}
