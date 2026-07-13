import { io, type Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';

/** Origin API servera (API_URL obsahuje /api/v1, socket beží na origin + /chat). */
function apiOrigin(): string {
  return new URL(API_URL).origin;
}

export function connectChatSocket(): Socket {
  return io(`${apiOrigin()}/chat`, {
    auth: { token: getToken() },
    transports: ['websocket'],
  });
}
