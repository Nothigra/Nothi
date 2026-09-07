import { 
  getConversationsForUser, 
  getMessagesForConversation, 
  createConversation, 
  createMessage, 
  markMessagesAsRead,
  updateConversation
} from './accountStore';

class MessagingService {
  constructor() {
    this.listeners = new Set();
    
    // Listen to storage events to simulate cross-tab realtime
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageEvent.bind(this));
    }
  }

  // --- Pub/Sub ---
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(cb => cb());
  }

  handleStorageEvent(e) {
    if (e.key === 'digilab-messages' || e.key === 'digilab-conversations') {
      this.notify();
    }
  }

  // --- API Methods ---
  getUserConversations(userId) {
    return getConversationsForUser(userId).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getMessages(conversationId) {
    return getMessagesForConversation(conversationId);
  }

  getOrCreateConversation(buyerId, sellerId, productId, orderId = 'mock-order-id') {
    const existing = getConversationsForUser(buyerId).find(c => c.productId === productId);
    if (existing) return existing;

    const newConv = createConversation({
      buyerId,
      sellerId,
      productId,
      orderId
    });
    this.notify();
    return newConv;
  }

  sendMessage(conversationId, senderId, text, type = 'text') {
    const msg = createMessage({ conversationId, senderId, text, type });
    this.notify();
    return msg;
  }

  markAsRead(conversationId, userId) {
    markMessagesAsRead(conversationId, userId);
    this.notify();
  }

  setTypingStatus(conversationId, userId, isTyping) {
    const conv = getConversationsForUser(userId).find(c => c.id === conversationId);
    if (!conv) return;

    const isBuyer = conv.buyerId === userId;
    const typing = { ...conv.typing };
    if (isBuyer) typing.buyer = isTyping;
    else typing.seller = isTyping;

    updateConversation(conversationId, { typing });
    this.notify();
  }
}

// Singleton instance
export const messagingService = new MessagingService();
