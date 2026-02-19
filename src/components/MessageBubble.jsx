import StatusIcon from './StatusIcon';

export default function MessageBubble({ msg }) {
  // Determine if the message is from the current user ('mine') based on method
  // 'qr' method implies it's an incoming message from the connected WhatsApp number (not 'mine' in terms of sending)
  // Any other method (e.g., 'sent_by_ui', 'cloud') implies 'mine'
  const mine = msg.method !== 'qr';

  return (
    <div className={`mb-2 flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`px-4 py-2 rounded-lg max-w-xs shadow-sm ${ // Added shadow-sm for subtle depth
          mine
            ? 'bg-green-500 text-white'
            : 'bg-white border border-gray-200' // Slightly lighter border for incoming
        }`}
      >
        <div className="break-words text-sm">
            {msg.text}
        </div> 
        <div className="text-xs flex items-center justify-end mt-1 text-gray-400 ">
          {/* Display timestamp if available and desired */}
          {/* <span className="mr-1">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> */}
          <StatusIcon status={msg.status} />
        </div>
      </div>
    </div>
  );
}
