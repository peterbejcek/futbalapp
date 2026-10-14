import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CLUB_DOCUMENT_MAX_BYTES,
  createClubDocumentSchema,
  createClubPageSchema,
  createClubPersonSchema,
  updateClubDocumentSchema,
  updateClubPageSchema,
  updateClubPersonSchema,
  type CreateClubDocumentInput,
  type CreateClubPageInput,
  type CreateClubPersonInput,
  type UpdateClubDocumentInput,
  type UpdateClubPageInput,
  type UpdateClubPersonInput,
} from '@fkknv/shared';
import { ClubContentService, type UploadedDocumentFile } from './club-content.service';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

/** multer: limit veľkosti + UTF-8 názvy súborov (inak by sa diakritika poškodila ako latin1). */
const UPLOAD_OPTIONS = {
  limits: { fileSize: CLUB_DOCUMENT_MAX_BYTES, files: 1 },
  defParamCharset: 'utf8',
} as Parameters<typeof FileInterceptor>[1];

/**
 * Správa klubového obsahu verejného webu (stránky, funkcionári/tréneri, dokumenty).
 * Každá metóda MUSÍ mať @Roles — RolesGuard bez nej pustí každého prihláseného.
 */
@Controller('club-content')
export class ClubContentController {
  constructor(private readonly content: ClubContentService) {}

  // ---- stránky
  @Get('pages')
  @Roles('ADMIN', 'MANAGER')
  listPages() {
    return this.content.listPages();
  }

  @Post('pages')
  @Roles('ADMIN', 'MANAGER')
  createPage(@Body(new ZodValidationPipe(createClubPageSchema)) body: CreateClubPageInput, @CurrentUser() user: AuthUser) {
    return this.content.createPage(body, user.id);
  }

  @Get('pages/:id')
  @Roles('ADMIN', 'MANAGER')
  getPage(@Param('id') id: string) {
    return this.content.getPage(id);
  }

  @Patch('pages/:id')
  @Roles('ADMIN', 'MANAGER')
  updatePage(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClubPageSchema)) body: UpdateClubPageInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.content.updatePage(id, body, user.id);
  }

  @Delete('pages/:id')
  @Roles('ADMIN', 'MANAGER')
  removePage(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.content.removePage(id, user.id);
  }

  // ---- osoby
  @Get('people')
  @Roles('ADMIN', 'MANAGER')
  listPeople() {
    return this.content.listPeople();
  }

  @Post('people')
  @Roles('ADMIN', 'MANAGER')
  createPerson(
    @Body(new ZodValidationPipe(createClubPersonSchema)) body: CreateClubPersonInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.content.createPerson(body, user.id);
  }

  @Get('people/:id')
  @Roles('ADMIN', 'MANAGER')
  getPerson(@Param('id') id: string) {
    return this.content.getPerson(id);
  }

  @Patch('people/:id')
  @Roles('ADMIN', 'MANAGER')
  updatePerson(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClubPersonSchema)) body: UpdateClubPersonInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.content.updatePerson(id, body, user.id);
  }

  @Delete('people/:id')
  @Roles('ADMIN', 'MANAGER')
  removePerson(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.content.removePerson(id, user.id);
  }

  // ---- dokumenty
  @Get('documents')
  @Roles('ADMIN', 'MANAGER')
  listDocuments() {
    return this.content.listDocuments();
  }

  @Post('documents')
  @Roles('ADMIN', 'MANAGER')
  createDocument(
    @Body(new ZodValidationPipe(createClubDocumentSchema)) body: CreateClubDocumentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.content.createDocument(body, user.id);
  }

  @Get('documents/:id')
  @Roles('ADMIN', 'MANAGER')
  getDocument(@Param('id') id: string) {
    return this.content.getDocument(id);
  }

  @Patch('documents/:id')
  @Roles('ADMIN', 'MANAGER')
  updateDocument(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClubDocumentSchema)) body: UpdateClubDocumentInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.content.updateDocument(id, body, user.id);
  }

  @Delete('documents/:id')
  @Roles('ADMIN', 'MANAGER')
  removeDocument(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.content.removeDocument(id, user.id);
  }

  @Post('documents/:id/file')
  @Roles('ADMIN', 'MANAGER')
  @UseInterceptors(FileInterceptor('file', UPLOAD_OPTIONS))
  uploadDocumentFile(
    @Param('id') id: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.content.uploadDocumentFile(id, file, user.id);
  }

  @Delete('documents/:id/file')
  @Roles('ADMIN', 'MANAGER')
  removeDocumentFile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.content.removeDocumentFile(id, user.id);
  }
}
