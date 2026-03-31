import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { DashboardLayout } from './layouts/DashboardLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { IngredientsPage } from './pages/IngredientsPage';
import { RecipesPage } from './pages/RecipesPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { AdvisorPage } from './pages/AdvisorPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'ingredients', element: <IngredientsPage /> },
          { path: 'recipes', element: <RecipesPage /> },
          { path: 'invoices', element: <InvoicesPage /> },
          { path: 'advisor', element: <AdvisorPage /> },
        ],
      },
    ],
  },
]);
