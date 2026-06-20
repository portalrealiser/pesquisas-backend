import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './components/RequireAuth.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import BuilderPage from './pages/BuilderPage.jsx';
import ResultsPage from './pages/ResultsPage.jsx';
import PublicPage from './pages/PublicPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/pesquisa/nova" element={<RequireAuth><BuilderPage /></RequireAuth>} />
      <Route path="/pesquisa/:id" element={<RequireAuth><BuilderPage /></RequireAuth>} />
      <Route path="/resultados/:id" element={<RequireAuth><ResultsPage /></RequireAuth>} />
      <Route path="/r/:slug" element={<PublicPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
