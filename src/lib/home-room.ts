import type { FunctionReturnType } from 'convex/server';
import type { api } from '../convex/_generated/api';

export const homeRoomKey = Symbol('home-room');
export type HomeRoomState = {
	roomId: string | null;
	room: FunctionReturnType<typeof api.games.get> | null;
};
