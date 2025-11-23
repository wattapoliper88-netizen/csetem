import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateUserConversation(userId: string, adminId: string) {
    let conv = await this.prisma.conversation.findFirst({
      where: { userId, adminId },
    });
    if (!conv) {
      conv = await this.prisma.conversation.create({
        data: { userId, adminId },
      });
    }
    return conv;
  }

  async getMyConversation(userId: string, isAdmin: boolean) {
    if (isAdmin) {
      throw new ForbiddenException('Use GET /conversations for admin');
    }

    // Próbálunk admin usert keresni
    let admin = await this.prisma.user.findFirst({ where: { isAdmin: true } });

    // Ha nincs admin, akkor a jelenlegi usert kinevezzük adminnak
    if (!admin) {
      admin = await this.prisma.user.update({
        where: { id: userId },
        data: { isAdmin: true },
      });
      console.log('⚠️ No admin found, promoted current user to admin:', {
        userId,
      });
    }

    const conv = await this.getOrCreateUserConversation(userId, admin.id);
    console.log('getMyConversation:', {
      userId,
      adminId: admin.id,
      conversationId: conv.id,
    });

    return conv;
  }

  async listConversationsForAdmin(adminId: string) {
    console.log('listConversationsForAdmin called with adminId:', adminId);
    const conversations = await this.prisma.conversation.findMany({
      where: { adminId },
      include: { 
        user: { 
          select: { 
            id: true, 
            email: true, 
            username: true, 
            isAdmin: true, 
            verified: true, 
            lastSeen: true,
            avatarImage: true
          } 
        } 
      },
      orderBy: { createdAt: 'desc' },
    });
    // Avoid logging full base64 avatar blobs – just lengths for diagnostics
    console.log('Found conversations (sanitized):', conversations.map(c => ({
      id: c.id,
      userId: c.userId,
      adminId: c.adminId,
      createdAt: c.createdAt,
      user: {
        id: c.user.id,
        email: c.user.email,
        username: c.user.username,
        isAdmin: c.user.isAdmin,
        verified: c.user.verified,
        lastSeen: c.user.lastSeen,
        avatarImageLength: c.user.avatarImage ? c.user.avatarImage.length : 0
      }
    })));
    return conversations;
  }

  async getMessages(conversationId: string, userId: string, isAdmin: boolean, limit = 50, cursor?: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();

    if (!isAdmin && conv.userId !== userId) {
      throw new ForbiddenException();
    }
    if (isAdmin && conv.adminId !== userId) {
      throw new ForbiddenException();
    }

    return this.prisma.message.findMany({
      where: { 
        conversationId
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        sender: {
          select: { id: true, username: true, email: true, avatarImage: true, lastSeen: true }
        }
      }
    });
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    content: string,
    isAdmin: boolean,
    file?: Express.Multer.File,
    audioThumbnail?: string,
    fileUrl?: string,
    fileName?: string,
    fileType?: string,
  ) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException();

    if (!isAdmin && conv.userId !== senderId) {
      throw new ForbiddenException();
    }
    if (isAdmin && conv.adminId !== senderId) {
      throw new ForbiddenException();
    }

    // Ellenőrizzük, hogy a user tiltva van-e
    const sender = await this.prisma.user.findUnique({ where: { id: senderId } });
    if (sender && !sender.verified && !sender.isAdmin) {
      // Csak az engedély kérő üzenetet engedjük
      const isPermissionRequest = content?.includes('Engedélyt kérek a csetfalra íráshoz');
      if (!isPermissionRequest) {
        throw new ForbiddenException('Nincs jogosultságod üzenetet küldeni. Kérj engedélyt az adminisztrátoroktól!');
      }
    }

    const messageData: any = { 
      conversationId, 
      senderId, 
      content: content || (file ? `📎 ${file.originalname}` : '')
    };

    if (file) {
      messageData.fileUrl = `/uploads/${file.filename}`;
      messageData.fileName = file.originalname;
      messageData.fileType = file.mimetype;

      // Save audio thumbnail if provided
      if (audioThumbnail && file.mimetype.startsWith('audio/')) {
        messageData.audioThumbnail = audioThumbnail;
      }
    } else if (fileUrl) {
      // If frontend uploaded to external storage (e.g. Firebase), record provided metadata
      messageData.fileUrl = fileUrl;
      if (fileName) messageData.fileName = fileName;
      if (fileType) messageData.fileType = fileType;
      if (audioThumbnail && fileType && fileType.startsWith('audio/')) {
        messageData.audioThumbnail = audioThumbnail;
      }
    }

    return this.prisma.message.create({
      data: messageData,
      include: {
        sender: {
          select: { id: true, username: true, email: true, avatarImage: true, lastSeen: true }
        }
      }
    });
  }

  async getLinkPreview(url: string) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      const html = await response.text();
      
      // Extract meta tags with more flexible patterns
      const titleMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:title|twitter:title)["']\s+content=["']([^"']+)["']/i) 
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:title|twitter:title)["']/i)
        || html.match(/<title>([^<]+)<\/title>/i);
      
      const descriptionMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:description|description|twitter:description)["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:description|description|twitter:description)["']/i);
      
      const imageMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image|og:image:url)["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:image|twitter:image|og:image:url)["']/i);
      
      const siteNameMatch = html.match(/<meta\s+(?:property|name)=["'](?:og:site_name|twitter:site)["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:site_name|twitter:site)["']/i);
      
      return {
        url,
        title: titleMatch ? titleMatch[1] : new URL(url).hostname,
        description: descriptionMatch ? descriptionMatch[1] : null,
        image: imageMatch ? imageMatch[1] : null,
        siteName: siteNameMatch ? siteNameMatch[1] : new URL(url).hostname,
      };
    } catch (error) {
      return {
        url,
        title: new URL(url).hostname,
        description: null,
        image: null,
        siteName: new URL(url).hostname,
      };
    }
  }

  async getFolders(conversationId: string, userId: string) {
    const folders = await this.prisma.folder.findMany({
      where: { conversationId },
      include: {
        messages: {
          select: { messageId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform to match frontend structure
    return folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      icon: folder.icon,
      visibility: folder.visibility,
      createdBy: folder.createdBy,
      closedBy: JSON.parse(folder.closedBy || '[]'),
      messageIds: folder.messages.map(m => m.messageId),
    }));
  }

  async closeFolder(folderId: string, userId: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId }
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    const closedBy = JSON.parse(folder.closedBy || '[]');
    if (!closedBy.includes(userId)) {
      closedBy.push(userId);
    }

    return this.prisma.folder.update({
      where: { id: folderId },
      data: { closedBy: JSON.stringify(closedBy) }
    });
  }

  async deleteMessages(messageIds: string[], userId: string, isAdmin: boolean) {
    // Verify user has permission to delete these messages
    const messages = await this.prisma.message.findMany({
      where: { id: { in: messageIds } },
      include: { conversation: true }
    });

    // Check permissions
    for (const msg of messages) {
      if (!isAdmin && msg.conversation.userId !== userId) {
        throw new ForbiddenException('Not authorized to delete these messages');
      }
      if (isAdmin && msg.conversation.adminId !== userId) {
        throw new ForbiddenException('Not authorized to delete these messages');
      }
    }

    // Add userId to deletedBy array for each message
    const updates = await Promise.all(messageIds.map(async (messageId) => {
      const message = messages.find(m => m.id === messageId);
      if (!message) return null;
      
      const deletedBy = JSON.parse(message.deletedBy || '[]');
      if (!deletedBy.includes(userId)) {
        deletedBy.push(userId);
      }
      
      // Get conversation to check both user IDs
      const conversation = message.conversation;
      const bothUserIds = [conversation.userId, conversation.adminId];
      
      // If both users have deleted this message, permanently delete it
      if (deletedBy.length >= 2 && bothUserIds.every(id => deletedBy.includes(id))) {
        return this.prisma.message.delete({
          where: { id: messageId }
        });
      }
      
      // Otherwise just update deletedBy
      return this.prisma.message.update({
        where: { id: messageId },
        data: { deletedBy: JSON.stringify(deletedBy) }
      });
    }));

    return updates.filter(Boolean);
  }
}
