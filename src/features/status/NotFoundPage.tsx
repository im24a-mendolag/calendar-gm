import { Link, useLocation, useNavigate } from 'react-router'
import { StatusPage } from './StatusPage'

/** Any URL that isn't a page. Shown inside the app shell, so the sidebar still works. */
export function NotFoundPage() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <StatusPage
      code="404"
      title="Page not found"
      actions={
        <>
          <Link to="/today" className="btn btn-primary">
            Go to Today
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(-1)}>
            Go back
          </button>
        </>
      }
    >
      <p>
        There's nothing at <span className="t-mono">{pathname}</span>. The link may be old or mistyped.
      </p>
    </StatusPage>
  )
}
