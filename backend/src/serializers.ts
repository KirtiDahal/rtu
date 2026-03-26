import type { CommunityMessage, User } from "@prisma/client";

export function serializeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    roleLabel: user.roleLabel,
    isGuest: user.isGuest
  };
}

export function serializeMessage(message: CommunityMessage) {
  return {
    id: message.id,
    channelId: message.channelId,
    senderName: message.senderName,
    roleLabel: message.roleLabel,
    body: message.body,
    createdAt: message.createdAt.toISOString()
  };
}
