import { useEffect } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import './index.css';
import Inbox from './pages/Inbox';
import Products from './pages/Products';

const { ipcRenderer } = window.electron;

function App() {
  useEffect(() => {
    const handleAppError = (event, errorInfo) => {
      console.error('App Error from Main Process:', errorInfo);
    };
    const handleAppClose = () => {
      console.log('App closing, performing cleanup...');
    };
    ipcRenderer.on('app-error', handleAppError);
    return () => {
      ipcRenderer.removeListener('app-error', handleAppError);
    };
  }, []);

  return (
    <div className="App h-screen flex flex-col">
      <nav className="bg-gray-800 text-white flex gap-4 px-6 py-3 border-b border-gray-700">
        <NavLink to="/" className={({ isActive }) => isActive ? 'text-blue-400 font-bold' : 'hover:text-blue-300'}>Chat</NavLink>
        <NavLink to="/products" className={({ isActive }) => isActive ? 'text-blue-400 font-bold' : 'hover:text-blue-300'}>Products</NavLink>
      </nav>
      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Inbox />} />
          <Route path="/products" element={<Products />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
