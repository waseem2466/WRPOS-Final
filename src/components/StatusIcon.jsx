export default function StatusIcon({ status }) {
  // Baileys status codes: 1 (sent), 2 (delivered), 3 (read)
  // Map them to UI representations
  // Note: Backend should send these numeric statuses. If strings are sent, adjust logic.
  if (status === 3) return <span className="text-blue-500">✔✔</span>; // Read
  if (status === 2) return <span className="text-gray-400">✔✔</span>; // Delivered
  if (status === 1) return <span className="text-gray-400">✔</span>;  // Sent
  // Fallback for unknown or initial statuses
  return <span className="text-gray-300">...</span>;
}
