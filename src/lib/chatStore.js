/**
 * chatStore — one shared, live copy of the signed-in user's conversations for
 * the app's Messages screens (list + chat). Loaded once, kept fresh by the
 * Supabase realtime subscription, and read with useChat().
 *
 * Everything is normalised to one shape, whatever the backend (real / mock):
 *   Conversation { id, partnerId, partner{username,avatar_url,is_pro}, productId,
 *                  productTitle, productSellerId, iAmSeller, lastMessage, updatedAt,
 *                  unread, messages: Message[] }
 *   Message      { id, mine, content, attachmentUrl, attachmentType, createdAt, read, system, pending, failed }
 */
import { useSyncExternalStore } from 'react';
import {
  getUserMessages, groupMessagesIntoConversations, sendMessage as apiSend,
  markMessagesAsRead as apiMarkRead, subscribeToMessages, uploadChatAttachment,
} from '../api/messageApi';
import { messagingService as mock } from './MessagingService';
import { getAccount, seedFakeConversationsIfEmpty } from './accountStore';
import { MOCK_PRODUCTS } from './seed';

let state = { userId: null, loaded: false, conversations: [] };
let raw = [];           // real mode: raw message rows
let drafts = new Map(); // conversations opened from a product page, not saved until the first message
let pending = [];       // real mode: optimistic messages (sending / failed)
let stop = null;
let mockMode = false;
const listeners = new Set();

function emit() { listeners.forEach((l) => l()); }
function setState(patch) { state = { ...state, ...patch }; emit(); }

export const conversationId = (userId, partnerId, productId) =>
  `${[userId, partnerId].sort().join('_')}_${productId || 'general'}`;

function normaliseReal(userId) {
  const grouped = groupMessagesIntoConversations(raw, userId);
  const byId = new Map(grouped.map((c) => [c.id, c]));
  // optimistic messages
  for (const p of pending) {
    const id = conversationId(userId, p.receiver_id, p.product_id);
    let c = byId.get(id);
    if (!c) {
      const d = drafts.get(id);
      if (!d) continue;
      c = { ...d, messages: [], unreadCount: 0 };
      byId.set(id, c);
    }
    c.messages = [...c.messages, p];
    c.lastMessage = p.content;
    c.updatedAt = p.created_at;
  }
  for (const [id, d] of drafts) if (!byId.has(id)) byId.set(id, { ...d, messages: [], unreadCount: 0, lastMessage: '', updatedAt: d.updatedAt });
  return [...byId.values()]
    .map((c) => ({
      id: c.id,
      partnerId: c.partnerId,
      partner: c.partner || { username: 'Nothi user' },
      productId: c.productId,
      productTitle: c.productTitle,
      productSellerId: c.productSellerId,
      iAmSeller: c.productSellerId === userId,
      lastMessage: c.lastMessage || '',
      updatedAt: c.updatedAt,
      unread: c.unreadCount || 0,
      messages: c.messages.map((m) => ({
        id: m.id,
        mine: m.sender_id === userId,
        content: m.content || '',
        attachmentUrl: m.attachment_url || null,
        attachmentType: m.attachment_type || null,
        createdAt: m.created_at,
        read: !!m.read_at,
        pending: !!m.pending,
        failed: !!m.failed,
      })),
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function normaliseMock(userId) {
  return mock.getUserConversations(userId).map((c) => {
    const iAmBuyer = c.buyerId === userId;
    const partnerId = iAmBuyer ? c.sellerId : c.buyerId;
    const partner = getAccount(partnerId) || { username: 'Nothi user' };
    let product = MOCK_PRODUCTS.find((p) => p.id === c.productId);
    if (!product) product = getAccount(c.sellerId)?.products?.find((p) => p.id === c.productId);
    const messages = mock.getMessages(c.id).map((m) => ({
      id: m.id, mine: m.senderId === userId, content: m.text || '', attachmentUrl: null, attachmentType: null,
      createdAt: m.createdAt, read: m.status === 'read', system: m.type === 'system',
    }));
    const last = messages[messages.length - 1];
    return {
      id: c.id, partnerId, partner, productId: c.productId, productTitle: product?.title || 'Product',
      productSellerId: c.sellerId, iAmSeller: !iAmBuyer, lastMessage: last?.content || '',
      updatedAt: last?.createdAt || c.updatedAt, unread: iAmBuyer ? (c.unreadCountBuyer || 0) : (c.unreadCountSeller || 0), messages,
    };
  }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function refresh() {
  const { userId } = state;
  if (!userId) return;
  setState({ conversations: mockMode ? normaliseMock(userId) : normaliseReal(userId) });
}

async function fetchReal() {
  const userId = state.userId;
  const msgs = await getUserMessages(userId);
  if (state.userId !== userId) return;
  raw = msgs || [];
  // a draft becomes a real conversation once it has messages
  for (const id of [...drafts.keys()]) if (raw.some((m) => conversationId(userId, m.sender_id === userId ? m.receiver_id : m.sender_id, m.product_id) === id)) drafts.delete(id);
  state = { ...state, loaded: true };
  refresh();
}

/** Start (or switch) the store for a user. Safe to call on every render. */
export function startChat(userId, isMock) {
  if (state.userId === userId) return;
  stop?.();
  stop = null;
  raw = []; pending = []; drafts = new Map();
  mockMode = isMock;
  state = { userId, loaded: false, conversations: [] };
  if (!userId) { emit(); return; }
  if (isMock) {
    seedFakeConversationsIfEmpty(userId);
    state = { ...state, loaded: true };
    refresh();
    stop = mock.subscribe(refresh);
    return;
  }
  fetchReal();
  stop = subscribeToMessages(userId, () => { fetchReal(); });
}

export function useChat() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state,
  );
}

/** Open a conversation that may not exist yet (from a product or the library). Returns its id. */
export function openConversation({ partnerId, partner, productId, productTitle, productSellerId }) {
  const userId = state.userId;
  if (!userId || !partnerId) return null;
  if (mockMode) {
    const conv = mock.getOrCreateConversation(userId, partnerId, productId);
    refresh();
    return conv.id;
  }
  const id = conversationId(userId, partnerId, productId);
  if (!state.conversations.some((c) => c.id === id)) {
    drafts.set(id, {
      id, partnerId, partner: partner || { username: 'Creator' }, productId, productTitle: productTitle || 'Product',
      productSellerId: productSellerId ?? partnerId, updatedAt: new Date().toISOString(),
    });
    refresh();
  }
  return id;
}

export function markRead(conv) {
  const userId = state.userId;
  if (!conv || !userId || !conv.unread) return;
  if (mockMode) { mock.markAsRead(conv.id, userId); return; }
  raw = raw.map((m) => (m.receiver_id === userId && m.sender_id === conv.partnerId && (m.product_id || null) === (conv.productId || null) && !m.read_at
    ? { ...m, read_at: new Date().toISOString() } : m));
  refresh();
  apiMarkRead(userId, conv.partnerId, conv.productId);
}

export async function sendText(conv, text, extra = {}) {
  const userId = state.userId;
  const content = text.trim();
  if (!userId || !conv || (!content && !extra.attachmentUrl)) return false;
  if (mockMode) { mock.sendMessage(conv.id, userId, content || '[Attachment]'); return true; }
  const temp = {
    id: 'temp-' + Date.now() + Math.random().toString(36).slice(2, 6), pending: true,
    sender_id: userId, receiver_id: conv.partnerId, product_id: conv.productId, content,
    attachment_url: extra.attachmentUrl || null, attachment_type: extra.attachmentType || null,
    created_at: new Date().toISOString(),
  };
  pending = [...pending, temp];
  refresh();
  const res = await apiSend({
    senderId: userId, receiverId: conv.partnerId, productId: conv.productId, content,
    attachmentUrl: extra.attachmentUrl, attachmentType: extra.attachmentType,
  });
  if (res.success && res.message) {
    pending = pending.filter((p) => p.id !== temp.id);
    if (!raw.some((m) => m.id === res.message.id)) raw = [...raw, res.message];
    drafts.delete(conv.id);
  } else {
    pending = pending.map((p) => (p.id === temp.id ? { ...p, pending: false, failed: true } : p));
  }
  refresh();
  return !!res.success;
}

/** Retry or drop a message that failed to send. */
export function retryFailed(conv, messageId) {
  const p = pending.find((m) => m.id === messageId);
  pending = pending.filter((m) => m.id !== messageId);
  refresh();
  if (p) sendText(conv, p.content, { attachmentUrl: p.attachment_url, attachmentType: p.attachment_type });
}
export function dropFailed(messageId) {
  pending = pending.filter((m) => m.id !== messageId);
  refresh();
}

export async function sendAttachment(conv, file) {
  if (file.size > 25 * 1024 * 1024) throw new Error('This file is too large (max 25 MB).');
  const type = file.type.startsWith('image/') ? 'image' : 'file';
  const { publicUrl } = await uploadChatAttachment(file);
  return sendText(conv, type === 'image' ? '[Image]' : `[File] ${file.name}`, { attachmentUrl: publicUrl, attachmentType: type });
}
