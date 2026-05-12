import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DemoPage } from './pages/DemoPage';
import { DashboardPage } from './pages/DashboardPage';
import { IngredientsPage } from './pages/IngredientsPage';
import { RecipesPage } from './pages/RecipesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { AdvisorPage } from './pages/AdvisorPage';
import { AlertsPage } from './pages/AlertsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { TechSheetPage } from './pages/TechSheetPage';
import { SettingsPage } from './pages/SettingsPage';

export const router = createBrowserRouter([
  // Public routes
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/demo', element: <DemoPage /> },

  // Protected routes
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/ingredients', element: <IngredientsPage /> },
          { path: '/recipes', element: <RecipesPage /> },
          { path: '/invoices', element: <InvoicesPage /> },
          { path: '/advisor', element: <AdvisorPage /> },
          { path: '/alerts', element: <AlertsPage /> },
          { path: '/analytics', element: <AnalyticsPage /> },
          { path: '/tech-sheets', element: <TechSheetPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
]);
