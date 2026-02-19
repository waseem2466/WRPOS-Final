import { useEffect, useState } from 'react';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';

const { ipcRenderer } = window.electron;

export default function Inbox() {
  const [chats, setChats] = useState({});
  const [messages, setMessages] = useState({});
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    // Fetch initial chats and messages from DB/IPC if available
    // For now, we'll rely on real-time updates

    const messageListener = (_, msg) => {
      setMessages(prev => {
        const updatedMessages = {
          ...prev,
          [msg.from]: [...(prev[msg.from] || []), msg]
        };
        // If the incoming message is not from the active chat, increment unread count
        setChats(prevChats => {
          const currentChat = prevChats[msg.from] || { unread: 0 };
          return {
            ...prevChats,
            [msg.from]: {
              jid: msg.from,
              lastMessage: msg.text,
              unread: activeChat === msg.from ? 0 : currentChat.unread + 1
            }
          };
        });
        return updatedMessages;
      });
    };

    const statusListener = (_, update) => {
      setMessages(prev => {
        let chatToUpdate = null;
        // Find which chat this message belongs to
        for (const jid in prev) {
          if (prev[jid].some(m => m.id === update.id)) {
            chatToUpdate = jid;
            break;
          }
        }

        if (!chatToUpdate) return prev; // Message not found?

        return {
          ...prev,
          [chatToUpdate]: prev[chatToUpdate].map(m =>
            m.id === update.id ? { ...m, status: update.status } : m
          )
        };
      });
    };

    ipcRenderer.on('wa-message', messageListener);
    ipcRenderer.on('wa-message-status', statusListener);

    // Clean up listeners on component unmount
    return () => {
      ipcRenderer.removeListener('wa-message', messageListener);
      ipcRenderer.removeListener('wa-message-status', statusListener);
    };
  }, [activeChat]); // Re-run effect if activeChat changes to adjust unread logic

  // Fetch initial chat list from DB/IPC if available (e.g., from wa-cloud-get-history)
  useEffect(() => {
    const fetchInitialChats = async () => {
      try {
        const history = await ipcRenderer.invoke('wa-cloud-get-history', { limit: 50 }); // Adjust limit as needed
        const initialChats = {};
        const initialMessages = {};

        history.forEach(msg => {
          initialChats[msg.from] = {
            jid: msg.from,
            lastMessage: msg.text,
            unread: 0 // Assuming history doesn't track unread, or it's handled elsewhere
          };
          initialMessages[msg.from] = [...(initialMessages[msg.from] || []), msg];
        });
        setChats(initialChats);
        setMessages(initialMessages);
      } catch (error) {
        console.error('Failed to fetch initial chat history:', error);
      }
    };
    fetchInitialChats();
  }, []);

  return (
    <div className="h-screen flex bg-gray-100">
      <ChatList
        chats={Object.values(chats)}
        active={activeChat}
        onSelect={jid => {
          setActiveChat(jid);
          // Reset unread count when a chat is selected
          setChats(p => ({
            ...p,
            [jid]: { ...p[jid], unread: 0 }
          }));
        }}
      />

      <ChatWindow
        jid={activeChat}
        messages={messages[activeChat] || []}
      />
    </div>
  );
}
