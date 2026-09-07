/**
 * accountStore.js — localStorage-backed multi-account CRUD
 * 
 * Storage layout:
 *   digilab-accounts       → { [id]: AccountRecord, ... }
 *   digilab-session         → accountId | null
 *   digilab-oauth-map       → { google: accountId, discord: accountId }
 *   digilab-onboarding-{id} → partial onboarding progress
 * 
 * NOTE: Password "hashing" uses btoa (base64) — this is NOT secure hashing.
 * It's acceptable for a local-only mock with no real user data at risk.
 * When migrating to a real backend, use bcrypt or argon2 server-side.
 */

const ACCOUNTS_KEY = 'digilab-accounts';
const SESSION_KEY = 'digilab-session';
const OAUTH_MAP_KEY = 'digilab-oauth-map';
const REPORTS_KEY = 'digilab-reports';
const CONVERSATIONS_KEY = 'digilab-conversations';
const MESSAGES_KEY = 'digilab-messages';

import { MOCK_CREATORS } from './seed';

// --- Helpers ---

function generateId() {
  return 'acc-' + crypto.randomUUID();
}

/** Simple base64 "hash" — NOT cryptographically secure. See header note. */
function hashPassword(password) {
  return btoa(password);
}

function verifyPassword(password, hash) {
  return btoa(password) === hash;
}

function createDefaultAccount(overrides = {}) {
  return {
    id: generateId(),
    email: '',
    passwordHash: '',
    username: '',
    avatar_url: null,
    bio: '',
    software: [],
    theme: 'dark',
    currency: 'USD',
    plan: 'free', // "free" | "pro"
    onboarding_completed: false,
    shop_settings: {
      bg_color: 'var(--color-bg)',
      banner_url: null,
      profile_image_url: null,
      card_radius: '16px',
      shadow_intensity: '0.05',
      show_follower_count: false,
    },
    products: [],
    purchases: [],
    wishlist_collections: [
      { id: 'default', name: 'Saved Items', isPublic: false, items: [] }
    ],
    following: [],
    balance: 0,       // in USD cents
    sales_count: 0,
    revenue: 0,        // in USD cents
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Account CRUD ---

export function getAllAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAllAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function getAccount(id) {
  const accounts = getAllAccounts();
  return accounts[id] || null;
}

export function createAccount(overrides = {}) {
  const accounts = getAllAccounts();
  const account = createDefaultAccount(overrides);
  accounts[account.id] = account;
  saveAllAccounts(accounts);
  return account;
}

export function updateAccount(id, updates) {
  const accounts = getAllAccounts();
  if (!accounts[id]) return null;
  
  // Deep merge for nested objects like shop_settings
  const current = accounts[id];
  const merged = { ...current };
  
  for (const [key, value] of Object.entries(updates)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && current[key] && typeof current[key] === 'object' && !Array.isArray(current[key])) {
      merged[key] = { ...current[key], ...value };
    } else {
      merged[key] = value;
    }
  }
  
  accounts[id] = merged;
  saveAllAccounts(accounts);
  return merged;
}

export function deleteProduct(accountId, productId) {
  const accounts = getAllAccounts();
  if (!accounts[accountId]) return null;
  accounts[accountId].products = accounts[accountId].products.filter(p => p.id !== productId);
  saveAllAccounts(accounts);
  return accounts[accountId];
}

// --- Lookup ---

export function findAccountByEmail(email) {
  const accounts = getAllAccounts();
  return Object.values(accounts).find(
    a => a.email.toLowerCase() === email.toLowerCase()
  ) || null;
}

export function findAccountByUsername(username) {
  const accounts = getAllAccounts();
  return Object.values(accounts).find(
    a => a.username.toLowerCase() === username.toLowerCase()
  ) || null;
}

export function isUsernameTaken(username, excludeId = null) {
  if (!username) return false;
  const accounts = getAllAccounts();
  const lowerName = username.toLowerCase();
  
  const inStore = Object.values(accounts).some(
    a => a.username && a.username.toLowerCase() === lowerName && a.id !== excludeId
  );
  if (inStore) return true;
  
  return MOCK_CREATORS.some(
    c => c.username && c.username.toLowerCase() === lowerName && c.id !== excludeId
  );
}

export function isShopNameTaken(shopName, excludeId = null) {
  if (!shopName) return false;
  const accounts = getAllAccounts();
  const lowerName = shopName.toLowerCase();
  
  const inStore = Object.values(accounts).some(a => {
    if (a.id === excludeId) return false;
    const name = a.shop_settings?.name || a.name || a.username;
    return name && name.toLowerCase() === lowerName;
  });
  if (inStore) return true;
  
  return MOCK_CREATORS.some(c => {
    if (c.id === excludeId) return false;
    const name = c.shop_settings?.name || c.name || c.username;
    return name && name.toLowerCase() === lowerName;
  });
}

// --- Session ---

export function getSession() {
  return localStorage.getItem(SESSION_KEY) || null;
}

export function setSession(accountId) {
  localStorage.setItem(SESSION_KEY, accountId);
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// --- OAuth Identity Mapping ---

function getOAuthMap() {
  try {
    const raw = localStorage.getItem(OAUTH_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOAuthMap(map) {
  localStorage.setItem(OAUTH_MAP_KEY, JSON.stringify(map));
}

export function getOAuthAccountId(provider) {
  const map = getOAuthMap();
  return map[provider] || null;
}

export function setOAuthAccountId(provider, accountId) {
  const map = getOAuthMap();
  map[provider] = accountId;
  saveOAuthMap(map);
}

// --- Auth Actions ---

export function signUp(email, password) {
  // Check if email already exists
  const existing = findAccountByEmail(email);
  if (existing) {
    return { account: null, error: 'An account with this email already exists.' };
  }

  const account = createAccount({
    email,
    passwordHash: hashPassword(password),
  });

  setSession(account.id);
  return { account, error: null };
}

export function signIn(email, password) {
  const account = findAccountByEmail(email);
  if (!account) {
    return { account: null, error: 'No account found with this email address.' };
  }
  if (!verifyPassword(password, account.passwordHash)) {
    return { account: null, error: 'Incorrect password. Please try again.' };
  }

  setSession(account.id);
  return { account, error: null };
}

export function signInWithOAuth(provider) {
  // Check if this browser already has an account linked to this provider
  const existingId = getOAuthAccountId(provider);
  if (existingId) {
    const account = getAccount(existingId);
    if (account) {
      setSession(account.id);
      return { account, isNewUser: false, error: null };
    }
    // Account was deleted but mapping remains — clean up and create new
  }

  // First time using this provider — create a new account
  const mockEmail = `${provider}_user@mock.Nothi.io`;
  const account = createAccount({
    email: mockEmail,
    passwordHash: '', // OAuth accounts don't have passwords
  });

  // Record the mapping so future clicks find this same account
  setOAuthAccountId(provider, account.id);
  setSession(account.id);
  return { account, isNewUser: true, error: null };
}

export function signOut() {
  clearSession();
}

// --- Onboarding Progress ---

export function getOnboardingProgress(accountId) {
  try {
    const raw = localStorage.getItem(`digilab-onboarding-${accountId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveOnboardingProgress(accountId, progress) {
  localStorage.setItem(`digilab-onboarding-${accountId}`, JSON.stringify(progress));
}

export function clearOnboardingProgress(accountId) {
  localStorage.removeItem(`digilab-onboarding-${accountId}`);
}

// --- Reports ---

export function getAllReports() {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveReport(report) {
  const reports = getAllReports();
  reports.push({
    ...report,
    id: generateId(),
    created_at: new Date().toISOString(),
    status: 'pending'
  });
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
}

// --- Conversations CRUD ---
export function getAllConversations() {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function seedFakeConversationsIfEmpty(currentUserId) {
  if (localStorage.getItem('digilab-seeded-conversations')) return;
  
  const conversations = getAllConversations();
  if (Object.keys(conversations).length === 0) {
    const fakeConv1 = createConversation({
      orderId: 'mock-order-1',
      productId: 'p1',
      buyerId: currentUserId,
      sellerId: 'mock-user-1'
    });
    
    // Simulate someone bought current user's product (if they have one, fallback to p3)
    const fakeConv2 = createConversation({
      orderId: 'mock-order-2',
      productId: 'p3',
      buyerId: 'mock-user-2',
      sellerId: currentUserId
    });
    
    // Create messages for fakeConv1
    createMessage({
      conversationId: fakeConv1.id,
      senderId: 'mock-user-1',
      text: 'Thanks for purchasing my Cinematic Pack! Let me know if you need any help installing the LUTs.'
    });
    createMessage({
      conversationId: fakeConv1.id,
      senderId: currentUserId,
      text: 'Hi! Yes, they are amazing. Quick question, are they compatible with the latest DaVinci Resolve update?'
    });
    createMessage({
      conversationId: fakeConv1.id,
      senderId: 'mock-user-1',
      text: 'Yes! Fully compatible with Studio 19.'
    });

    // Create messages for fakeConv2
    createMessage({
      conversationId: fakeConv2.id,
      senderId: 'mock-user-2',
      text: 'Hi, I just bought your product. Could you tell me if it works on Mac?'
    });

    localStorage.setItem('digilab-seeded-conversations', 'true');
  }
}

function saveAllConversations(conversations) {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export function getConversationsForUser(userId) {
  const all = getAllConversations();
  return Object.values(all).filter(c => c.buyerId === userId || c.sellerId === userId);
}

export function getConversation(id) {
  return getAllConversations()[id] || null;
}

export function createConversation(data) {
  const conversations = getAllConversations();
  const id = 'conv-' + crypto.randomUUID();
  const newConv = {
    id,
    orderId: data.orderId,
    productId: data.productId,
    buyerId: data.buyerId,
    sellerId: data.sellerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastMessage: null,
    unreadCountBuyer: 0,
    unreadCountSeller: 0,
    status: 'active', // active, archived, resolved
    typing: { buyer: false, seller: false }
  };
  conversations[id] = newConv;
  saveAllConversations(conversations);
  return newConv;
}

export function updateConversation(id, updates) {
  const conversations = getAllConversations();
  if (!conversations[id]) return null;
  conversations[id] = { ...conversations[id], ...updates, updatedAt: new Date().toISOString() };
  saveAllConversations(conversations);
  return conversations[id];
}

// --- Messages CRUD ---
export function getAllMessages() {
  try {
    const raw = localStorage.getItem(MESSAGES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveAllMessages(messages) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

export function getMessagesForConversation(conversationId) {
  const all = getAllMessages();
  return Object.values(all)
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function createMessage(data) {
  const messages = getAllMessages();
  const id = 'msg-' + crypto.randomUUID();
  const newMsg = {
    id,
    conversationId: data.conversationId,
    senderId: data.senderId,
    type: data.type || 'text',
    text: data.text,
    createdAt: new Date().toISOString(),
    edited: false,
    status: 'sent' // sent, delivered, read
  };
  messages[id] = newMsg;
  saveAllMessages(messages);
  
  // Update conversation lastMessage and unread counts
  const conv = getConversation(data.conversationId);
  if (conv) {
    const isBuyer = conv.buyerId === data.senderId;
    updateConversation(data.conversationId, {
      lastMessage: data.text,
      unreadCountBuyer: isBuyer ? conv.unreadCountBuyer : conv.unreadCountBuyer + 1,
      unreadCountSeller: !isBuyer ? conv.unreadCountSeller : conv.unreadCountSeller + 1
    });
  }
  return newMsg;
}

export function markMessagesAsRead(conversationId, userId) {
  const conv = getConversation(conversationId);
  if (!conv) return;
  
  const isBuyer = conv.buyerId === userId;
  updateConversation(conversationId, {
    unreadCountBuyer: isBuyer ? 0 : conv.unreadCountBuyer,
    unreadCountSeller: !isBuyer ? 0 : conv.unreadCountSeller
  });

  const messages = getAllMessages();
  let changed = false;
  Object.values(messages).forEach(m => {
    if (m.conversationId === conversationId && m.senderId !== userId && m.status !== 'read') {
      messages[m.id].status = 'read';
      changed = true;
    }
  });
  if (changed) saveAllMessages(messages);
}

// --- Contact Messages ---
const CONTACT_MESSAGES_KEY = 'digilab-contact-messages';

export function getContactMessages() {
  try {
    const raw = localStorage.getItem(CONTACT_MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function submitContactMessage(messageData) {
  const messages = getContactMessages();
  const newMessage = {
    id: 'msg-' + crypto.randomUUID(),
    created_at: new Date().toISOString(),
    status: 'unread',
    ...messageData
  };
  messages.push(newMessage);
  localStorage.setItem(CONTACT_MESSAGES_KEY, JSON.stringify(messages));
  return newMessage;
}
