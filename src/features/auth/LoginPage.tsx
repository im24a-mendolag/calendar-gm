import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { signIn, signUp, useSession } from '../../lib/auth-client'
import styles from './LoginPage.module.css'

type Mode = 'sign-in' | 'sign-up'

export function LoginPage() {
  const { data } = useSession()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (data) return <Navigate to="/today" replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const email = String(form.get('email'))
    const password = String(form.get('password'))
    setBusy(true)
    setError(null)
    const result =
      mode === 'sign-in'
        ? await signIn.email({ email, password })
        : await signUp.email({ email, password, name: String(form.get('name')) })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong')
      return
    }
    navigate('/today', { replace: true })
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={onSubmit}>
        <div className={styles.head}>
          <h1 className="t-title">{mode === 'sign-in' ? 'Sign in' : 'Create account'}</h1>
          <p className="t-caption c-tertiary">Your timetable, exams and appointments in one place.</p>
        </div>

        {mode === 'sign-up' && (
          <label className={styles.field}>
            <span className="t-caption c-tertiary">Name</span>
            <input name="name" required autoComplete="name" />
          </label>
        )}
        <label className={styles.field}>
          <span className="t-caption c-tertiary">Email</span>
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label className={styles.field}>
          <span className="t-caption c-tertiary">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && (
          <p className="t-caption c-now" role="alert">
            {error}
          </p>
        )}

        <button className={styles.primary} type="submit" disabled={busy}>
          {busy ? '…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className={styles.switch}
          onClick={() => {
            setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')
            setError(null)
          }}
        >
          {mode === 'sign-in' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
