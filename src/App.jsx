import { useEffect } from 'react';
import './index.css'; // Import Tailwind CSS
import Inbox from './pages/Inbox';

const { ipcRenderer } = window.electron;

function App() {

  // Optional: Handle global errors or lifecycle events from main process
  useEffect(() => {
    const handleAppError = (event, errorInfo) => {
      console.error('App Error from Main Process:', errorInfo);
      // Implement UI notification for errors if desired
    };

    const handleAppClose = () => {
      console.log('App closing, performing cleanup...');
      // You might send an IPC message here if main process needs to know
    };

    ipcRenderer.on('app-error', handleAppError);
    // Example for window close event if needed, though usually handled by main process
    // window.addEventListener('beforeunload', handleAppClose);

    // Clean up listeners
    return () => {
      ipcRenderer.removeListener('app-error', handleAppError);
      // window.removeEventListener('beforeunload', handleAppClose);
    };
  }, []);

  return (
    <div className="App h-screen flex flex-col">
      <Inbox />
    </div>
  );
}

export default App;
