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
import { TodayPage } from './features/today/TodayPage'
import { TimetablePage } from './features/timetable/TimetablePage'
import { WeekPage } from './features/week/WeekPage'
import { applyTheme } from './lib/theme'

applyTheme()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: true } },
})

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/today" replace /> },
      { path: '/today', element: <TodayPage /> },
      { path: '/week', element: <WeekPage /> },
      { path: '/month', element: <MonthPage /> },
      { path: '/exams', element: <ExamsPage /> },
      { path: '/homework', element: <HomeworkPage /> },
      { path: '/timetable', element: <TimetablePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/today" replace /> },
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
