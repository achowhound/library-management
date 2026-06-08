import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import BookSearch from './pages/BookSearch';
import HomePage from './pages/HomePage';
import MyHistory from './reader/MyHistory';
import UnifiedLogin from './pages/UnifiedLogin';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import SystemLogs from './adminLogs/SystemLogs';
import LibrarianApp from './librarian/LibrarianApp';
import Announcements from './pages/Announcements';
import AdminAnnouncements from './pages/AdminAnnouncements';
import UserManagement from './pages/UserManagement';
import Messages from './pages/Messages';
import SystemConfig from './pages/SystemConfig';
import AdminBackupPage from './pages/AdminBackupPage';
import AdminBlocklist from './pages/AdminBlocklist';
import AdminFineStats from './pages/AdminFineStats';


function App() {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('search');

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('librarianToken');
    if (token) {
      setIsLoggedIn(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('librarianToken');
    localStorage.removeItem('librarianInfo');
    setIsLoggedIn(false);
    setActiveTab('search');
    navigate('/login');
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<UnifiedLogin />} />
      <Route path="/librarian-login" element={<LibrarianApp />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/admin-logs" element={<SystemLogs />} />
      <Route path="/admin/users" element={<UserManagement />} />
      <Route path="/announcements" element={<Announcements />} />
      <Route path="/admin/announcements" element={<AdminAnnouncements />} />
      <Route path="/history" element={<MyHistory />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/search" element={<BookSearch />} />
      <Route path="/" element={
        isLoggedIn ? (
          <HomePage />
        ) : (
          <UnifiedLogin />
        )
      } />
      <Route path="/admin/config" element={<SystemConfig />} />
      <Route path="/admin/backups" element={<AdminBackupPage />} />
      <Route path="/admin/blocklist" element={<AdminBlocklist />} />
      <Route path="/admin/fine-stats" element={<AdminFineStats />} />
    </Routes>
  );
}

export default App;
