import { supabase, isMockMode, withTimeoutSafety } from '../lib/supabase';

export async function getUserMessages(userId) {
  if (isMockMode) return []; // Fallback handled in component

  // Fetch all messages where user is sender or receiver
  const { data, error } = await supabase
    .from('messages')
    .select(
      '*, sender:public_profiles!sender_id(username, avatar_url), receiver:public_profiles!receiver_id(username, avatar_url), product:public_products!product_id(title, seller_id)'
    )
    .or('sender_id.eq.' + userId + ',receiver_id.eq.' + userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }
  return data;
}

export function groupMessagesIntoConversations(messages, userId) {
  const convMap = new Map();

  messages.forEach(msg => {
    const isSender = msg.sender_id === userId;
    const partnerId = isSender ? msg.receiver_id : msg.sender_id;
    const partnerInfo = isSender ? msg.receiver : msg.sender;
    
    // Create a unique conversation ID based on the two users and the product
    const participants = [userId, partnerId].sort().join('_');
    const convId = participants + '_' + (msg.product_id || 'general');

    const productData = Array.isArray(msg.product) ? msg.product[0] : msg.product;

    if (!convMap.has(convId)) {
      convMap.set(convId, {
        id: convId,
        partnerId,
        partner: partnerInfo,
        productId: msg.product_id,
        productTitle: productData?.title || 'Unknown Product',
        productSellerId: productData?.seller_id,
        messages: [],
        unreadCount: 0,
        lastMessage: '',
        updatedAt: msg.created_at
      });
    }

    const conv = convMap.get(convId);
    conv.messages.push(msg);
    conv.lastMessage = msg.content;
    
    // Update timestamp to the latest message
    if (new Date(msg.created_at) > new Date(conv.updatedAt)) {
      conv.updatedAt = msg.created_at;
    }

    // If I am the receiver and the message has not been read, increment unread count
    if (!isSender && !msg.read_at) {
      conv.unreadCount += 1;
    }
  });

  // Return sorted by most recently updated first
  return Array.from(convMap.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function sendMessage({ senderId, receiverId, productId, content, attachmentUrl, attachmentType }) {
  if (isMockMode) return { success: true };

  const { data, error } = await withTimeoutSafety(() => supabase
    .from('messages')
    .insert([{
      sender_id: senderId,
      receiver_id: receiverId,
      product_id: productId,
      content,
      attachment_url: attachmentUrl || null,
      attachment_type: attachmentType || null
    }])
    .select('*, sender:public_profiles!sender_id(username, avatar_url), receiver:public_profiles!receiver_id(username, avatar_url), product:public_products!product_id(title, seller_id)')
    .single()
  );

  if (error) {
    console.error('Error sending message:', error);
    return { success: false, error };
  }
  return { success: true, message: data };
}

export async function uploadChatAttachment(file) {
  if (isMockMode) {
    // For mock mode, just return a fake URL after a short delay
    await new Promise(r => setTimeout(r, 1000));
    return { publicUrl: URL.createObjectURL(file) };
  }

  // 1. Get presigned URL
  const { data, error: fnError } = await withTimeoutSafety(() =>
    supabase.functions.invoke('generate-upload-url', {
      body: { 
        folder: 'chat-attachments', 
        filename: file.name || 'upload', 
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size
      }
    })
  );

  if (fnError || !data?.uploadUrl) {
    throw new Error(fnError?.message || 'Failed to get upload URL');
  }

  // 2. Upload file to R2
  const uploadRes = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`File upload failed (HTTP ${uploadRes.status})`);
  }

  return { publicUrl: data.publicUrl };
}

export async function markMessagesAsRead(receiverId, partnerId, productId) {
  if (isMockMode) return;

  let query = supabase.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('receiver_id', receiverId)
    .eq('sender_id', partnerId)
    .is('read_at', null);

  if (productId) {
    query = query.eq('product_id', productId);
  } else {
    query = query.is('product_id', null);
  }

  return withTimeoutSafety(() => query);
}

export function subscribeToMessages(userId, onMessageUpdate) {
  if (isMockMode) return () => {};

  const channelTopic = `messages:${userId}:${Math.random().toString(36).substring(2, 9)}`;
  const channel = supabase.channel(channelTopic)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE
        schema: 'public',
        table: 'messages',
        filter: 'receiver_id=eq.' + userId
      },
      (payload) => {
        onMessageUpdate(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*', 
        schema: 'public',
        table: 'messages',
        filter: 'sender_id=eq.' + userId
      },
      (payload) => {
        onMessageUpdate(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
