import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Search, Send, MessageSquare, ChevronLeft, Check, CheckCheck, Archive, Filter, Image as ImageIcon, Paperclip, MoreVertical, Loader2, Download, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { messagingService as mockMessagingService } from '../lib/MessagingService';
import { getAccount, seedFakeConversationsIfEmpty } from '../lib/accountStore';
import { MOCK_PRODUCTS } from '../lib/seed';
import Input from '../components/ui/Input';
import { getLocalizedString } from '../utils/i18nHelpers';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserPurchases } from '../api/productApi';
import { getUserMessages, groupMessagesIntoConversations, sendMessage as sendRealMessage, markMessagesAsRead as markRealRead, subscribeToMessages, uploadChatAttachment } from '../api/messageApi';
import './MessagesPage.css';

export default function MessagesPage() {
  const { t, i18n } = useTranslation();
  const { user, profile, isMockMode } = useAuth();
  const location = useLocation();
  
  const baseLang = (i18n.language || 'en').split('-')[0];

  const [rawMessages, setRawMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const [isMobileView, setIsMobileView] = useState(false);
  const [showChatMobile, setShowChatMobile] = useState(false);

  const messagesEndRef = useRef(null);

  // Responsive handling
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch messages and subscribe to real-time events
  useEffect(() => {
    if (!user) return;
    
    if (isMockMode) {
      seedFakeConversationsIfEmpty(user.id);
      const fetchMock = () => {
        setConversations(mockMessagingService.getUserConversations(user.id));
      };
      fetchMock();
      const unsub = mockMessagingService.subscribe(fetchMock);
      return unsub;
    }

    let isMounted = true;

    async function fetchMessages() {
      const msgs = await getUserMessages(user.id);
      if (isMounted) {
        setRawMessages(msgs);
        setConversations(groupMessagesIntoConversations(msgs, user.id));
      }
    }
    fetchMessages();

    // Setup realtime subscription
    const unsubscribe = subscribeToMessages(user.id, (payload) => {
      // Re-fetch everything on change for simplicity, or we could patch `rawMessages`
      fetchMessages();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user, isMockMode]);

  // Handle auto-select from location state
  useEffect(() => {
    if (!location.state || !user) return;

    if (location.state.activeChatId && conversations.length > 0) {
      setActiveChatId(location.state.activeChatId);
      window.history.replaceState({}, document.title);
    } else if (location.state.startNewChat) {
      const { sellerId, productId, productTitle, sellerName } = location.state;
      
      const participants = [user.id, sellerId].sort().join('_');
      const expectedId = `${participants}_${productId || 'general'}`;
      
      const existingConv = conversations.find(c => c.id === expectedId);
      
      if (existingConv) {
        setActiveChatId(existingConv.id);
        window.history.replaceState({}, document.title);
      } else {
        // Create draft if it doesn't exist yet, protecting against strict mode duplicate renders
        setConversations(prev => {
          if (prev.some(c => c.id === expectedId)) return prev;
          
          const draftConv = {
            id: expectedId,
            partnerId: sellerId,
            partner: { username: sellerName || 'Seller' },
            productId: productId,
            productTitle: productTitle || 'Product',
            productSellerId: sellerId,
            messages: [],
            unreadCount: 0,
            lastMessage: '',
            updatedAt: new Date().toISOString()
          };
          
          return [draftConv, ...prev];
        });
        setActiveChatId(expectedId);
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, conversations, user]);

  // Handle active chat selection
  useEffect(() => {
    if (activeChatId && user) {
      if (isMockMode) {
        mockMessagingService.markAsRead(activeChatId, user.id);
      } else {
        const activeConv = conversations.find(c => c.id === activeChatId);
        if (activeConv && activeConv.unreadCount > 0) {
          markRealRead(user.id, activeConv.partnerId, activeConv.productId).then(() => {
            // Optimistically clear unread locally
            setConversations(prev => prev.map(c => c.id === activeChatId ? { ...c, unreadCount: 0 } : c));
          });
        }
      }
      if (isMobileView) setShowChatMobile(true);
    }
  }, [activeChatId, user, isMobileView, isMockMode, conversations]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [rawMessages, activeChatId]); // scroll when new messages arrive or chat changes

  const activeChat = conversations.find(c => c.id === activeChatId);
  const activeMessages = isMockMode 
    ? (activeChatId ? mockMessagingService.getMessages(activeChatId) : []) 
    : (activeChat ? activeChat.messages : []);

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeChatId || !user || !activeChat) return;

    // Optional: add some frontend validation
    if (file.size > 25 * 1024 * 1024) {
      alert('File is too large. Maximum size is 25MB.');
      return;
    }

    try {
      setIsUploadingAttachment(true);
      
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      const { publicUrl } = await uploadChatAttachment(file);
      
      // Immediately send as a message
      const tempId = 'temp-' + Date.now();
      const contentFallback = type === 'image' ? '[Image]' : `[File] ${file.name}`;
      
      const tempMsg = {
        id: tempId,
        sender_id: user.id,
        receiver_id: activeChat.partnerId,
        product_id: activeChat.productId,
        content: contentFallback,
        attachment_url: publicUrl,
        attachment_type: type,
        created_at: new Date().toISOString(),
        sender: { username: profile?.username || 'You', avatar_url: profile?.avatar_url },
        receiver: activeChat.partner,
        product: { title: activeChat.productTitle }
      };

      setRawMessages(prev => [...prev, tempMsg]);
      setConversations(prev => groupMessagesIntoConversations([...rawMessages, tempMsg], user.id));

      if (isMockMode) {
        mockMessagingService.sendMessage(activeChatId, user.id, contentFallback); // Doesn't support attachments natively but prevents crash
      } else {
        const res = await sendRealMessage({
          senderId: user.id,
          receiverId: activeChat.partnerId,
          productId: activeChat.productId,
          content: contentFallback,
          attachmentUrl: publicUrl,
          attachmentType: type
        });
        
        if (!res.success) throw new Error('Failed to send attachment message');
      }
    } catch (err) {
      console.error('Attachment upload failed:', err);
      alert(err.message || 'Failed to upload attachment');
    } finally {
      setIsUploadingAttachment(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeChatId || !user) return;
    
    const text = inputText.trim();
    setInputText('');
    
    if (isMockMode) {
      mockMessagingService.sendMessage(activeChatId, user.id, text);
      return;
    }

    if (!activeChat) return;

    // Optimistic UI update
    const tempId = 'temp-' + Date.now();
    const tempMsg = {
      id: tempId,
      sender_id: user.id,
      receiver_id: activeChat.partnerId,
      product_id: activeChat.productId,
      content: text,
      created_at: new Date().toISOString(),
      sender: { username: profile?.username || 'You', avatar_url: profile?.avatar_url },
      receiver: activeChat.partner,
      product: { title: activeChat.productTitle }
    };

    setRawMessages(prev => [...prev, tempMsg]);
    setConversations(prev => groupMessagesIntoConversations([...rawMessages, tempMsg], user.id));

    const res = await sendRealMessage({
      senderId: user.id,
      receiverId: activeChat.partnerId,
      productId: activeChat.productId,
      content: text
    });

    if (!res.success) {
      // Revert optimistic update
      setRawMessages(prev => prev.filter(m => m.id !== tempId));
      setConversations(prev => groupMessagesIntoConversations(rawMessages.filter(m => m.id !== tempId), user.id));
    }
  };

  const getPartnerInfo = (conv) => {
    if (!isMockMode) return conv.partner || { username: 'Unknown User' };
    const isBuyer = conv.buyerId === user.id;
    const partnerId = isBuyer ? conv.sellerId : conv.buyerId;
    return getAccount(partnerId) || { username: 'Unknown User' };
  };

  const getProductInfo = (conv) => {
    if (!isMockMode) return { title: conv.productTitle, seller_id: conv.productSellerId };
    
    let p = MOCK_PRODUCTS.find(p => p.id === conv.productId);
    if (!p) {
      const seller = getAccount(conv.sellerId);
      if (seller) p = seller.products.find(prod => prod.id === conv.productId);
    }
    return p || { title: 'Unknown Product' };
  };

  const activePartner = activeChat ? getPartnerInfo(activeChat) : null;
  const activeProduct = activeChat ? getProductInfo(activeChat) : null;

  const [hasPurchased, setHasPurchased] = useState(true);

  // Verify purchase before allowing chat
  useEffect(() => {
    async function verifyPurchase() {
      if (!activeChat || !user) return;
      
      if (isMockMode) {
        const isBuyer = activeChat.buyerId === user.id;
        if (!isBuyer) return setHasPurchased(true);
        const hasIt = profile?.purchases?.includes(activeChat.productId);
        setHasPurchased(!!hasIt);
        return;
      }

      // Real mode: Check if user is the seller
      const isSeller = activeProduct && (activeProduct.seller_id === profile?.id || activeProduct.creator_id === profile?.id);
      if (isSeller) {
        setHasPurchased(true);
        return;
      }

      // If not the seller, verify purchase
      const purchases = await getUserPurchases(user.id, false);
      const hasBought = purchases.some(p => p.product_id === activeChat.productId);
      setHasPurchased(hasBought);
    }
    verifyPurchase();
  }, [activeChat, activeProduct, user, profile, isMockMode]);

  // Filter conversations
  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const partner = getPartnerInfo(c);
    const product = getProductInfo(c);
    const q = searchQuery.toLowerCase();
    
    const pName = partner.username?.toLowerCase() || '';
    const prodName = typeof product.title === 'string' ? product.title.toLowerCase() : getLocalizedString(product.title, baseLang).toLowerCase();
    const msgText = c.lastMessage?.toLowerCase() || '';

    return pName.includes(q) || prodName.includes(q) || msgText.includes(q);
  });

  return (
    <div className="messages-container h-full">
      <div className="messages-layout glass-card h-full">
        
        {/* Sidebar (Conversation List) */}
        <div className={`messages-sidebar ${isMobileView && showChatMobile ? 'hidden' : 'flex'}`}>
          <div className="messages-header flex-between">
            <h2 className="section-title">Messages</h2>
            <button className="btn btn-icon btn-ghost"><Filter size={18} /></button>
          </div>
          
          <div className="messages-search p-md border-b">
            <Input 
              iconLeft={Search}
              placeholder="Search by name, product, or message..."
              size="sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="empty-state p-xl text-center text-muted">
                <MessageSquare size={48} className="mb-md mx-auto opacity-50 text-accent" />
                <h3 className="text-lg font-medium text-primary mb-xs">No conversations yet</h3>
                <p className="text-sm">When customers contact you after purchasing one of your products, they will appear here.</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="empty-state p-xl text-center text-muted">
                <p>No results found for "{searchQuery}"</p>
              </div>
            ) : (
              filteredConversations.map(chat => {
                const partner = getPartnerInfo(chat);
                const product = getProductInfo(chat);
                const prodTitle = typeof product.title === 'string' ? product.title : getLocalizedString(product.title, baseLang);
                
                const isBuyer = isMockMode 
                  ? chat.buyerId === user.id 
                  : (product.seller_id !== profile?.id && product.creator_id !== profile?.id); // approximation for tag
                
                const unread = isMockMode 
                  ? (chat.buyerId === user.id ? chat.unreadCountBuyer : chat.unreadCountSeller) 
                  : (chat.unreadCount || 0);
                  
                const isActive = activeChatId === chat.id;
                
                return (
                  <div 
                    key={chat.id} 
                    className={`conversation-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveChatId(chat.id)}
                  >
                    <div className="conversation-avatar">
                      {partner.avatar_url ? (
                        <img src={partner.avatar_url} alt={partner.username} className="avatar-img object-cover" />
                      ) : (
                        (partner.username || 'U').charAt(0).toUpperCase()
                      )}
                      {unread > 0 && <span className="unread-dot"></span>}
                    </div>
                    <div className="conversation-info">
                      <div className="conversation-name-row">
                        <span className="font-medium flex items-center gap-xs">
                          {partner.username}
                          {!isBuyer && <span className="badge-buyer text-xs">Buyer</span>}
                        </span>
                        <span className="text-xs text-muted">
                          {chat.updatedAt ? new Date(chat.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="text-xs text-accent font-medium line-clamp-1 mb-1">
                        {prodTitle}
                      </div>
                      <div className={`conversation-preview line-clamp-1 text-sm ${unread > 0 ? 'font-medium text-primary' : 'text-muted'}`}>
                        {chat.lastMessage || 'No messages yet.'}
                      </div>
                    </div>
                    {unread > 0 && (
                      <div className="unread-badge">{unread}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`chat-area ${isMobileView && !showChatMobile ? 'hidden' : 'flex'}`}>
          {activeChat ? (
            <>
              {/* Header Context (Phase 2 & 3) */}
              <div className="chat-header">
                <div className="chat-header-content">
                  {isMobileView && (
                    <button className="btn btn-icon btn-ghost mr-sm" onClick={() => setShowChatMobile(false)}>
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  
                  <div className="partner-details flex-1 flex items-center gap-md">
                    <div className="conversation-avatar relative">
                      {activePartner.avatar_url ? (
                        <img src={activePartner.avatar_url} alt={activePartner.username} className="avatar-img" />
                      ) : (
                        (activePartner.username || 'U').charAt(0).toUpperCase()
                      )}
                      <div className="online-indicator active"></div>
                    </div>
                    <div>
                      <h3 className="font-medium text-lg leading-tight flex items-center gap-xs">
                        {activePartner.username}
                        {activePartner.plan === 'pro' && <span className="pro-badge text-xs">PRO</span>}
                      </h3>
                      <div className="text-xs text-muted flex items-center gap-xs mt-1">
                        <span className="status-text">Online</span>
                      </div>
                    </div>
                  </div>

                  <div className="header-actions">
                    <button className="btn btn-icon btn-ghost" title="Archive Conversation">
                      <Archive size={18} />
                    </button>
                    <button className="btn btn-icon btn-ghost">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>

                {/* Product Context Banner */}
                <div className="chat-product-banner">
                  <div className="product-thumbnail">
                    {activeProduct.images?.[0] ? (
                      <img src={activeProduct.images[0]} alt="Product" />
                    ) : (
                      <div className="placeholder-thumb" />
                    )}
                  </div>
                  <div className="product-banner-info">
                    <span className="text-xs text-muted">Regarding purchase</span>
                    <h4 className="text-sm font-medium line-clamp-1">
                      {typeof activeProduct.title === 'string' ? activeProduct.title : getLocalizedString(activeProduct.title, baseLang)}
                    </h4>
                  </div>
                </div>
              </div>
              
              <div className="chat-messages p-xl flex flex-col gap-md">
                {activeMessages.length === 0 ? (
                  <div className="text-center text-muted my-auto">
                    <p>This is the beginning of your conversation.</p>
                  </div>
                ) : (
                  activeMessages.map(msg => {
                    const isMe = isMockMode ? msg.senderId === user.id : msg.sender_id === user.id;
                    const isSystem = msg.type === 'system';
                    const content = isMockMode ? msg.text : msg.content;
                    const timestamp = isMockMode ? msg.createdAt : msg.created_at;
                    const isRead = isMockMode ? msg.status === 'read' : !!msg.read_at;
                    
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="system-message text-center my-md">
                          <span className="bg-secondary text-muted text-xs px-md py-xs rounded-full">
                            {content}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div key={msg.id} className={`message ${isMe ? 'sent' : 'received'}`}>
                        <div className="message-bubble" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {msg.attachment_type === 'image' && msg.attachment_url && (
                            <img 
                              src={msg.attachment_url} 
                              alt="Attachment" 
                              className="rounded-md"
                              style={{ maxHeight: '250px', maxWidth: '100%', objectFit: 'contain', backgroundColor: 'var(--color-bg)' }}
                            />
                          )}
                          {msg.attachment_type === 'file' && msg.attachment_url && (
                            <a 
                              href={msg.attachment_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-sm p-sm rounded-md border border-border hover:border-primary transition-colors text-sm"
                              style={{ backgroundColor: isMe ? 'rgba(0,0,0,0.1)' : 'var(--color-bg)' }}
                            >
                              <FileText size={16} className={isMe ? '' : 'text-primary'} />
                              <span className="truncate" style={{ maxWidth: '180px' }}>
                                {content.startsWith('[File] ') ? content.replace('[File] ', '') : 'Download File'}
                              </span>
                              <Download size={14} className="ml-auto opacity-70" />
                            </a>
                          )}
                          
                          {/* Only show text if it's not the generic fallback for the attachment */}
                          {(!msg.attachment_type || 
                           (msg.attachment_type === 'image' && content !== '[Image]') || 
                           (msg.attachment_type === 'file' && !content.startsWith('[File] '))) && (
                            <span>{content}</span>
                          )}
                        </div>
                        <div className="message-meta flex items-center gap-xs">
                          <span className="message-time">
                            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isMe && (
                            <span className="message-status">
                              {isRead ? <CheckCheck size={14} className="text-accent" /> : <Check size={14} />}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {!hasPurchased ? (
                <div className="p-xl text-center bg-secondary" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <MessageSquare size={32} className="mx-auto mb-sm text-muted opacity-50" />
                  <h3 className="font-medium text-primary mb-xs">Purchase Required</h3>
                  <p className="text-muted text-sm">You must purchase this product before messaging the seller.</p>
                </div>
              ) : (
                <div className="chat-input-area p-md">
                  <div className="chat-input-wrapper">
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleAttachmentUpload} /><button className="btn btn-icon btn-ghost text-muted" onClick={() => fileInputRef.current?.click()} disabled={isUploadingAttachment}><Paperclip size={20} /></button>
                    
                    <input
                      type="text"
                      className="form-input flex-1"
                      placeholder={isUploadingAttachment ? "Uploading..." : "Type a message..."}
                      value={inputText}
                      disabled={isUploadingAttachment}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    
                    <button 
                      className="btn btn-primary send-btn" 
                      onClick={handleSendMessage}
                      disabled={!inputText.trim()}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-chat flex flex-col items-center justify-center h-full text-muted">
              <MessageSquare size={64} className="mb-md opacity-20" />
              <h3 className="text-xl font-medium text-primary mb-xs">Your Messages</h3>
              <p>Select a conversation from the sidebar to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

