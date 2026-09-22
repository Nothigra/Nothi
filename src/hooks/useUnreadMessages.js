import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { seedFakeConversationsIfEmpty } from '../lib/accountStore';
import { messagingService as mockMessagingService } from '../lib/MessagingService';
import { getUserMessages, groupMessagesIntoConversations, subscribeToMessages } from '../api/messageApi';

/**
 * Shared unread-message count, used by both the desktop Navbar and the
 * mobile bottom nav so the badge logic lives in exactly one place.
 */
export function useUnreadMessages() {
  const { profile, isMockMode } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!profile) {
      setUnreadMessages(0);
      return;
    }

    if (isMockMode) {
      seedFakeConversationsIfEmpty(profile.id);
      const updateUnread = () => {
        const convs = mockMessagingService.getUserConversations(profile.id);
        const count = convs.reduce((acc, c) => {
          const isBuyer = c.buyerId === profile.id;
          return acc + (isBuyer ? (c.unreadCountBuyer || 0) : (c.unreadCountSeller || 0));
        }, 0);
        setUnreadMessages(count);
      };
      updateUnread();
      return mockMessagingService.subscribe(updateUnread);
    }

    let isMounted = true;
    const fetchUnread = async () => {
      const msgs = await getUserMessages(profile.id);
      if (isMounted) {
        const convs = groupMessagesIntoConversations(msgs, profile.id);
        const count = convs.reduce((acc, c) => acc + (c.unreadCount || 0), 0);
        setUnreadMessages(count);
      }
    };

    fetchUnread();
    const unsub = subscribeToMessages(profile.id, fetchUnread);
    return () => {
      isMounted = false;
      unsub();
    };
  }, [profile, isMockMode]);

  return unreadMessages;
}
