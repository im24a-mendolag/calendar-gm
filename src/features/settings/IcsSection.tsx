import { useRef } from 'react'
import { Icon } from '../../components/Icon'
import { useImportIcs } from '../../lib/queries'
import styles from './SettingsPage.module.css'

export function IcsSection() {
  const fileRef = useRef<HTMLInputElement>(null)
  const importIcs = useImportIcs()
  const r = importIcs.data

  async function onFile(file: File | undefined) {
    if (!file) return
    importIcs.mutate(await file.text())
    if (fileRef.current) fileRef.current.value = '' // allow choosing the same file again
  }

  return (
    <section className={styles.section}>
      <h2 className="t-heading">Calendar files (.ics)</h2>
      <p className="t-caption c-secondary">
        Bring in a calendar from your school portal or another app, or put your lessons and events into Google or Apple
        Calendar.
      </p>
      <div className="card">
        <div className="card-row">
          <Icon name="upload" />
          <span className={styles.grow}>
            <span className="t-body-strong">Import .ics file</span>
            <br />
            <span className="t-caption c-tertiary">
              Adds events from the next 12 months. Importing the same file again updates them instead of duplicating.
            </span>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".ics,text/calendar"
            className="sr-only"
            aria-label="Choose .ics file"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <button type="button" className="btn btn-secondary" disabled={importIcs.isPending} onClick={() => fileRef.current?.click()}>
            {importIcs.isPending ? 'Importing…' : 'Choose file'}
          </button>
        </div>
        {(r || importIcs.error) && (
          <div className={`card-row ${styles.note}`} role="status">
            {importIcs.error ? (
              <span className="t-caption c-now">{importIcs.error.message}</span>
            ) : (
              r && (
                <span className="t-caption c-secondary">
                  {r.created} added, {r.updated} updated
                  {r.skippedOwnExport > 0 && ` · ${r.skippedOwnExport} skipped (exported from this app)`}
                  {r.truncated && ' · stopped at 2000 events'}
                </span>
              )
            )}
          </div>
        )}
        <div className="card-row">
          <Icon name="download" />
          <span className={styles.grow}>
            <span className="t-body-strong">Export timetable &amp; events</span>
            <br />
            <span className="t-caption c-tertiary">Lessons as weekly repeats with holidays left out, plus all your events.</span>
          </span>
          <a className="btn btn-secondary" href="/api/export.ics" download="calendar.ics">
            Download
          </a>
        </div>
      </div>
    </section>
  )
}
