import React from 'react';

export default function ChatList({ chats, active, onSelect }) {
  // Sort chats by last message timestamp, most recent first
  const sortedChats = React.useMemo(() => {
    return Object.values(chats).sort((a, b) => {
      // Assume messages have a timestamp, sort by it descending
      // If no timestamp, put them at the end
      const timeA = a.lastMessageTimestamp || 0;
      const timeB = b.lastMessageTimestamp || 0;
      return timeB - timeA;
    });
  }, [chats]);

  return (
    <div className="w-80 bg-white border-r overflow-y-auto flex flex-col">
      <div className="p-4 font-bold text-lg border-b sticky top-0 bg-white z-10">
        WhatsApp Inbox
      </div>

      {sortedChats.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          No chats yet.
        </div>
      )}

      {sortedChats.map(chat => (
        <div
          key={chat.jid}
          onClick={() => onSelect(chat.jid)}
          className={`p-4 cursor-pointer border-b flex items-center justify-between transition-colors duration-150 ${ active === chat.jid ? 'bg-blue-100 hover:bg-blue-200' : 'hover:bg-gray-100' }`}
        >
          <div className="flex-1 min-w-0 mr-4">
            <div className="font-semibold truncate w-full max-w-xs">
              {chat.name || chat.jid.replace('@s.whatsapp.net', '')}
            </div>

            <div className="text-sm text-gray-600 truncate w-full max-w-xs">
              {chat.lastMessage}
            </div>
          </div>

          <div className="flex flex-col items-end">
            {chat.unread > 0 && (
              <span className="text-xs bg-green-500 text-white rounded-full px-2 py-1 min-w-[20px] text-center mb-1">
                {chat.unread}
              </span>
            )}
            {/* Display timestamp if available */}
            {chat.lastMessageTimestamp && (
              <div className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(chat.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
