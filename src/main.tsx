// Global styles first, so component CSS modules (imported below) win on equal specificity.
import './styles/base.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navigate, createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppShell } from './components/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { ExamsPage } from './features/exams/ExamsPage'
import { HomeworkPage } from './features/homework/HomeworkPage'
import { MonthPage } from './features/month/MonthPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { ErrorPage } from './features/status/ErrorPage'
import { NotFoundPage } from './features/status/NotFoundPage'
import { TodayPage } from './features/today/TodayPage'
import { TimetablePage } from './features/timetable/TimetablePage'
import { WeekPage } from './features/week/WeekPage'
import { applyTheme } from './lib/theme'

applyTheme()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // A failed load with nothing cached goes to the route's error page instead of a blank page;
      // a failed background refresh keeps showing the cached data.
      throwOnError: (_error, query) => query.state.data === undefined,
    },
  },
})

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  {
    element: <AppShell />,
    // The shell itself failed: full-screen error.
    errorElement: <ErrorPage />,
    children: [
      {
        // A page failed: error inside the shell, so the sidebar keeps working.
        errorElement: <ErrorPage />,
        children: [
          { index: true, element: <Navigate to="/today" replace /> },
          { path: '/today', element: <TodayPage /> },
          { path: '/week', element: <WeekPage /> },
          { path: '/month', element: <MonthPage /> },
          { path: '/exams', element: <ExamsPage /> },
          { path: '/homework', element: <HomeworkPage /> },
          { path: '/timetable', element: <TimetablePage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
