import { Body, Controller, Delete, Post } from '@nestjs/common';
import { z } from 'zod';
import { PushService } from './push.service';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/zod.pipe';

const registerTokenSchema = z.object({
  token: z.string().min(10).max(200),
  platform: z.enum(['ios', 'android']),
});

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly pushService: PushService) {}

  /** Mobilná appka zaregistruje Expo push token po prihlásení. */
  @Post('token')
  register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(registerTokenSchema)) body: z.infer<typeof registerTokenSchema>,
  ) {
    return this.pushService.registerToken(user.id, body.token, body.platform);
  }

  /** Odhlásenie zariadenia (logout). */
  @Delete('token')
  remove(@Body() body: { token: string }) {
    return this.pushService.removeToken(body.token);
  }
}
