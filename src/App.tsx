import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';
import ArticleDetailPage from './pages/ArticleDetailPage';
import AskQuestionPage from './pages/AskQuestionPage';
import QueuePage from './pages/QueuePage';
import AnalyticsPage from './pages/AnalyticsPage';
import AdminSettingsPage from './pages/AdminSettingsPage'; import FeedbackPage from './pages/FeedbackPage';
import type { UserRole } from './types';

function ProtectedRoute({ children, allow }: { children: JSX.Element; allow?: UserRole[] }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(profile.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<KnowledgeBasePage />} />
        <Route path="/articles/:id" element={<ArticleDetailPage />} />
        <Route path="/ask" element={<AskQuestionPage />} />
        <Route
          path="/queue"
          element={
            <ProtectedRoute allow={['team_lead', 'admin']}>
              <QueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedRoute allow={['team_lead', 'admin']}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allow={['admin']}>
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />
        </Route> for '/admin' (around line 59, just before </Routes> on line 60), add: <Route path="/feedback" element={ <ProtectedRoute allow={['team_lead', 'admin']}> <FeedbackPage /> </ProtectedRoute> } />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
