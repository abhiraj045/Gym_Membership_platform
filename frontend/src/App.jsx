import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Protected from './components/Protected';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import MemberDetail from './pages/MemberDetail';
import Plans from './pages/Plans';
import Staff from './pages/Staff';
import Reminders from './pages/Reminders';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/members" element={<Members />} />
        <Route path="/members/:id" element={<MemberDetail />} />
        <Route path="/plans" element={<Protected role="owner"><Plans /></Protected>} />
        <Route path="/staff" element={<Protected role="owner"><Staff /></Protected>} />
        <Route path="/reminders" element={<Protected role="owner"><Reminders /></Protected>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
