import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp, 
  query, 
  where, 
  getDocs 
} from './rmatchFirebase';
import { db, auth } from './rmatchFirebase';

export interface GameRoom {
  id: string;
  roomId: string;
  hostId: string;
  hostName: string;
  guestId?: string;
  guestName?: string;
  status: 'waiting' | 'active' | 'finished';
  isPrivate: boolean;
  gameState?: any;
  createdAt: any;
  updatedAt: any;
}

export const gameService = {
  async createRoom(roomId: string, hostName: string, isPrivate: boolean = true) {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    const roomDoc = doc(db, 'game_rooms', roomId);
    const roomData: Partial<GameRoom> = {
      roomId,
      hostId: auth.currentUser.uid,
      hostName,
      status: 'waiting',
      isPrivate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(roomDoc, roomData);
    return roomId;
  },

  async joinRoom(roomId: string, guestName: string) {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    const roomDoc = doc(db, 'game_rooms', roomId);
    const snap = await getDoc(roomDoc);
    
    if (!snap.exists()) throw new Error('Room not found');
    const room = snap.data() as GameRoom;
    
    if (room.hostId === auth.currentUser.uid) throw new Error('Cannot join your own room');
    if (room.status !== 'waiting' || room.guestId) throw new Error('Room is full or already started');

    await updateDoc(roomDoc, {
      guestId: auth.currentUser.uid,
      guestName,
      status: 'active',
      updatedAt: serverTimestamp()
    });
  },

  async updateGameState(roomId: string, gameState: any) {
    const roomDoc = doc(db, 'private_rooms', roomId);
    await updateDoc(roomDoc, {
      gameState,
      updatedAt: serverTimestamp()
    });
  },

  async sendReaction(roomId: string, reaction: string, senderId: string) {
    const roomDoc = doc(db, 'private_rooms', roomId);
    await updateDoc(roomDoc, {
      lastReaction: {
        type: reaction,
        senderId,
        timestamp: Date.now()
      },
      updatedAt: serverTimestamp()
    });
  },

  async requestRematch(roomId: string, userId: string) {
    const roomDoc = doc(db, 'private_rooms', roomId);
    const snap = await getDoc(roomDoc);
    const data = snap.data();
    const rematchRequests = data?.rematchRequests || {};
    rematchRequests[userId] = true;

    await updateDoc(roomDoc, {
      rematchRequests,
      updatedAt: serverTimestamp()
    });
  },

  async finishGame(roomId: string) {
    const roomDoc = doc(db, 'private_rooms', roomId);
    await updateDoc(roomDoc, {
      status: 'finished',
      updatedAt: serverTimestamp()
    });
  },

  subscribeToRoom(roomId: string, callback: (room: GameRoom) => void) {
    return onSnapshot(doc(db, 'game_rooms', roomId), (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() } as GameRoom);
      }
    });
  }
};
