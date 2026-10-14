import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  createArticleSchema,
  updateArticleSchema,
  type CreateArticleInput,
  type UpdateArticleInput,
} from '@fkknv/shared';
import { ArticlesService } from './articles.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

/** Správa článkov verejného webu — len vedenie klubu (RolesGuard bez @Roles by pustil každého). */
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  list() {
    return this.articles.list();
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  get(@Param('id') id: string) {
    return this.articles.get(id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body(new ZodValidationPipe(createArticleSchema)) body: CreateArticleInput, @CurrentUser() user: AuthUser) {
    return this.articles.create(body, user.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateArticleSchema)) body: UpdateArticleInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.articles.update(id, body, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.articles.remove(id, user.id);
  }
}
