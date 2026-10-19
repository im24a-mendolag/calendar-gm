import { isRouteErrorResponse, useRouteError } from 'react-router'
import { ApiError } from '../../lib/api'
import { NotFoundPage } from './NotFoundPage'
import { StatusPage } from './StatusPage'
import styles from './StatusPage.module.css'

/**
 * Route error fallback: a page threw while rendering, or its data failed to load
 * (queries throw here when there's nothing cached to show — see main.tsx).
 */
export function ErrorPage() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  if (error instanceof ApiError && error.status === 401) {
    return (
      <StatusPage
        code="401"
        title="You've been signed out"
        actions={
          <a href="/login" className="btn btn-primary">
            Sign in
          </a>
        }
      >
        <p>Your session ended. Sign in again to pick up where you left off.</p>
      </StatusPage>
    )
  }

  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  const details = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? (import.meta.env.DEV && error.stack) || error.message
      : String(error)

  return (
    <StatusPage
      code={error instanceof ApiError ? String(error.status) : 'Error'}
      title={offline ? "You're offline" : 'Something went wrong'}
      actions={
        <>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          {/* A full page load, so a broken app state doesn't come along. */}
          <a href="/today" className="btn btn-secondary">
            Go to Today
          </a>
        </>
      }
    >
      <p>
        {offline
          ? 'Check your connection and reload.'
          : "This page hit a problem it couldn't recover from. Reloading usually fixes it — anything you already saved is safe."}
      </p>
      <details className={`t-mono-small ${styles.details}`}>
        <summary>Details</summary>
        <pre>{details}</pre>
      </details>
    </StatusPage>
  )
}
