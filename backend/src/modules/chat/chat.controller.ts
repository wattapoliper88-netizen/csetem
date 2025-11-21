import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations/me')
  async myConversation(@Req() req: any) {
    return this.chatService.getMyConversation(req.user.userId, req.user.isAdmin);
  }

  @Get('conversations')
  async listConversations(@Req() req: any) {
    if (!req.user.isAdmin) return [];
    return this.chatService.listConversationsForAdmin(req.user.userId);
  }

  @Get('messages/:conversationId')
  async getMessages(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit = 50,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getMessages(
      conversationId,
      req.user.userId,
      req.user.isAdmin,
      Number(limit),
      cursor,
    );
  }

  @Post('messages')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 3 * 1024 * 1024 * 1024, // 3GB
      },
    }),
  )
  async sendMessage(
    @Req() req: any, 
    @Body() body: { conversationId: string; content?: string; audioThumbnail?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.chatService.createMessage(
      body.conversationId,
      req.user.userId,
      body.content || '',
      req.user.isAdmin,
      file,
      body.audioThumbnail,
    );
  }

  @Get('link-preview')
  async getLinkPreview(@Query('url') url: string) {
    return this.chatService.getLinkPreview(url);
  }

  @Get('folders/:conversationId')
  async getFolders(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
  ) {
    return this.chatService.getFolders(conversationId, req.user.userId);
  }

  @Post('folders/:folderId/close')
  async closeFolder(
    @Req() req: any,
    @Param('folderId') folderId: string,
  ) {
    return this.chatService.closeFolder(folderId, req.user.userId);
  }

  @Post('messages/delete')
  async deleteMessages(
    @Req() req: any,
    @Body() body: { messageIds: string[] },
  ) {
    return this.chatService.deleteMessages(body.messageIds, req.user.userId, req.user.isAdmin);
  }
}
