import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ASSESSED_KINDS, EVENT_KIND_LABELS, PERSONAL_KINDS } from '../../../shared/constants'
import { addDays, daysBetween, eachDay, fromMinutes, isoWeekNumber, isoWeekday, startOfIsoWeek, toMinutes } from '../../../shared/dates'
import type { LessonOccurrence } from '../../../shared/occurrences'
import type { CalendarEvent } from '../../../shared/types'
import { Block } from '../../components/Block'
import { Icon } from '../../components/Icon'
import { WEEKDAYS_SHORT, todayIso, weekTitle } from '../../lib/format'
import { useCalendar, useSaveEvent, useSettings, useSubjects, useUpdateHomework } from '../../lib/queries'
import { useIsPhone } from '../../lib/useMediaQuery'
import { useNow } from '../../lib/useNow'
import { EventPopover, type DraftPreview, type EventDraft } from '../events/EventPopover'
import {
  assignLanes,
  eventItem,
  hideReplacedLessons,
  isMultiDay,
  layoutColumns,
  lessonItem,
  moveTimes,
  resizeEnd,
  selection,
  SNAP_MIN,
  type GridItem,
} from './layout'
import { OccurrencePopover } from './OccurrencePopover'
import styles from './WeekPage.module.css'

const PX_PER_MIN = 1.2
const DEFAULT_START = 7 * 60
const DEFAULT_END = 17 * 60
/** Pointer movement (px) before a press on a card counts as a drag instead of a click. */
const DRAG_THRESHOLD = 4

type Open =
  | { kind: 'edit'; event: CalendarEvent; anchor: HTMLElement }
  | { kind: 'lesson'; lesson: LessonOccurrence; anchor: HTMLElement }
  /** anchor = the New button; without one, the popover anchors to the placeholder card in the grid */
  | { kind: 'new'; draft: EventDraft; anchor?: HTMLElement }

/** Where an event is shown while being dragged or saved. */
type Placement = { date: string; start: number; end: number }

type Drag =
  | { mode: 'move' | 'resize'; event: CalendarEvent; x0: number; y0: number; start: number; end: number; dayIdx: number; moved: boolean; el: HTMLElement }
  | { mode: 'create'; dayIdx: number; anchorMin: number; y0: number; moved: boolean }

const eventToInput = (e: CalendarEvent, p: Placement) => ({
  id: e.id,
  kind: e.kind,
  title: e.title,
  subjectId: e.subjectId,
  date: p.date,
  endDate: e.endDate,
  allDay: e.allDay,
  startTime: fromMinutes(p.start),
  endTime: fromMinutes(p.end),
  location: e.location,
  topics: e.topics,
  notes: e.notes,
  reminderDays: e.reminderDays,
  tagIds: e.tagIds,
})

export function WeekPage() {
  const now = useNow()
  const [params] = useSearchParams()
  const linked = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : null
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(linked ?? todayIso()))
  const [pickedDay, setPickedDay] = useState(() => linked ?? todayIso())
  const settings = useSettings()
  const subjects = useSubjects()
  const isPhone = useIsPhone()
  const dayCount = settings.data?.showWeekends ? 7 : 5
  const weekDays = useMemo(() => eachDay(weekStart, addDays(weekStart, dayCount - 1)), [weekStart, dayCount])
  // Phones show one day at a time; the strip under the header picks it.
  const phoneDay = weekDays.includes(pickedDay) ? pickedDay : weekDays[0]
  const days = useMemo(() => (isPhone ? [phoneDay] : weekDays), [isPhone, phoneDay, weekDays])
  const columnCount = days.length
  const calendar = useCalendar(weekStart, addDays(weekStart, 6))
  const updateHomework = useUpdateHomework()
  const saveEvent = useSaveEvent()

  const [open, setOpen] = useState<Open | null>(null)
  const [ghostEl, setGhostEl] = useState<HTMLElement | null>(null)
  const [preview, setPreview] = useState<DraftPreview | null>(null)
  const [dragPreview, setDragPreview] = useState<(Placement & { eventId?: string }) | null>(null)
  const [pending, setPending] = useState<Record<string, Placement>>({})
  const dragRef = useRef<Drag | null>(null)
  const colsRef = useRef<HTMLDivElement>(null)
  /** Last press came from a finger: cards open on tap and never drag (so the page can scroll). */
  const touchRef = useRef(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement).matches('input, textarea, select')) return
      if (e.key === 'ArrowLeft') setWeekStart((w) => addDays(w, -7))
      if (e.key === 'ArrowRight') setWeekStart((w) => addDays(w, 7))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const subjectById = useMemo(() => new Map((subjects.data ?? []).map((s) => [s.id, s])), [subjects.data])
  const data = calendar.data

  // Events with drag/save overrides applied, so a moved card stays put while it saves.
  const events = useMemo(() => {
    const overrides: Record<string, Placement> = { ...pending }
    if (dragPreview?.eventId) overrides[dragPreview.eventId] = dragPreview
    return (data?.events ?? []).map((e) => {
      const o = overrides[e.id]
      return o ? { ...e, date: o.date, startTime: fromMinutes(o.start), endTime: fromMinutes(o.end) } : e
    })
  }, [data, pending, dragPreview])

  const itemsByDay = useMemo(() => {
    const map = new Map<string, GridItem[]>()
    if (!data) return map
    const lessons = hideReplacedLessons(data.lessons, events).map((l) => lessonItem(l, subjectById.get(l.subjectId)))
    const timed = events.flatMap((e) => eventItem(e, e.subjectId ? subjectById.get(e.subjectId) : undefined) ?? [])
    for (const item of [...lessons, ...timed]) map.set(item.date, [...(map.get(item.date) ?? []), item])
    for (const [date, items] of map) map.set(date, layoutColumns(items))
    return map
  }, [data, events, subjectById])

  // Visible hours: from the earliest wake-up/item to the latest end, rounded to whole hours.
  const { start, end } = useMemo(() => {
    const visible = days.flatMap((d) => itemsByDay.get(d) ?? [])
    const wakes = (data?.days ?? []).filter((d) => days.includes(d.date) && d.wakeTime).map((d) => toMinutes(d.wakeTime!))
    const s = Math.min(DEFAULT_START, ...visible.map((i) => i.start), ...wakes.map((w) => w - 15))
    const e = Math.max(DEFAULT_END, ...visible.map((i) => i.end))
    return { start: Math.floor(s / 60) * 60, end: Math.ceil(e / 60) * 60 }
  }, [days, itemsByDay, data])

  const y = (minutes: number) => (minutes - start) * PX_PER_MIN
  const hours = Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start + i * 60)
  const isEmpty = data && data.lessons.length === 0 && data.events.length === 0
  const nowInView = days.includes(now.date) && now.minutes >= start && now.minutes <= end

  // ---------------------------------------------------------------- pointer helpers
  const minutesAt = (clientY: number) => start + (clientY - colsRef.current!.getBoundingClientRect().top) / PX_PER_MIN
  const dayIdxAt = (clientX: number) => {
    const r = colsRef.current!.getBoundingClientRect()
    return Math.min(Math.max(Math.floor(((clientX - r.left) / r.width) * columnCount), 0), columnCount - 1)
  }

  function startDrag(d: Drag) {
    dragRef.current = d
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      if (!drag.moved && Math.hypot(ev.clientX - ('x0' in drag ? drag.x0 : ev.clientX), ev.clientY - drag.y0) < DRAG_THRESHOLD) return
      drag.moved = true
      if (drag.mode === 'create') {
        const s = selection(drag.anchorMin, minutesAt(ev.clientY))
        setDragPreview({ date: days[drag.dayIdx], ...s })
        return
      }
      const delta = (ev.clientY - drag.y0) / PX_PER_MIN
      const times = drag.mode === 'move' ? moveTimes(drag.start, drag.end, delta) : resizeEnd(drag.start, drag.end, delta)
      const date = drag.mode === 'move' ? days[dayIdxAt(ev.clientX)] : days[drag.dayIdx]
      setDragPreview({ eventId: drag.event.id, date, ...times })
    }
    const finish = (commit: boolean) => (ev?: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('pointercancel', cancel)
      const drag = dragRef.current
      dragRef.current = null
      setDragPreview(null)
      if (!drag || !commit || !ev) return
      if (drag.mode === 'create') {
        const s = drag.moved
          ? selection(drag.anchorMin, minutesAt(ev.clientY))
          : { start: Math.floor(drag.anchorMin / SNAP_MIN) * SNAP_MIN, end: Math.floor(drag.anchorMin / SNAP_MIN) * SNAP_MIN + 60 }
        setPreview(null)
        setOpen({
          kind: 'new',
          draft: { kind: 'appointment', date: days[drag.dayIdx], startTime: fromMinutes(s.start), endTime: fromMinutes(Math.min(s.end, 24 * 60 - 1)) },
        })
        return
      }
      if (!drag.moved) {
        setOpen({ kind: 'edit', event: drag.event, anchor: drag.el })
        return
      }
      const delta = (ev.clientY - drag.y0) / PX_PER_MIN
      const times = drag.mode === 'move' ? moveTimes(drag.start, drag.end, delta) : resizeEnd(drag.start, drag.end, delta)
      const placement = { date: drag.mode === 'move' ? days[dayIdxAt(ev.clientX)] : days[drag.dayIdx], ...times }
      const id = drag.event.id
      setPending((p) => ({ ...p, [id]: placement }))
      saveEvent.mutate(eventToInput(drag.event, placement), {
        onSettled: () =>
          setPending((p) => {
            const rest = { ...p }
            delete rest[id]
            return rest
          }),
      })
    }
    const up = finish(true)
    const esc = (ev: KeyboardEvent) => ev.key === 'Escape' && finish(false)()
    const cancel = () => finish(false)() // e.g. the browser took over the touch to scroll
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', up)
    window.addEventListener('keydown', esc)
    window.addEventListener('pointercancel', cancel)
  }

  function onCardPointerDown(e: ReactPointerEvent<HTMLElement>, event: CalendarEvent, item: GridItem) {
    if (e.button !== 0) return
    touchRef.current = e.pointerType === 'touch'
    if (touchRef.current) return // tap → onClick opens the editor
    e.stopPropagation()
    e.preventDefault() // no text selection while dragging
    const resize = (e.target as HTMLElement).dataset.resize !== undefined
    startDrag({
      mode: resize ? 'resize' : 'move',
      event,
      x0: e.clientX,
      y0: e.clientY,
      start: item.start,
      end: item.end,
      dayIdx: days.indexOf(item.date),
      moved: false,
      el: e.currentTarget,
    })
  }

  function onColumnPointerDown(e: ReactPointerEvent<HTMLDivElement>, dayIdx: number) {
    if (e.button !== 0 || e.target !== e.currentTarget) return
    if (open) return // this press just closes the open popover
    if (e.pointerType !== 'touch') e.preventDefault() // keep touch scrolling working
    startDrag({ mode: 'create', dayIdx, anchorMin: minutesAt(e.clientY), y0: e.clientY, moved: false })
  }

  // ---------------------------------------------------------------- all-day row
  const withSubject = (subjectId: string | null, text: string) => {
    const name = subjectId ? subjectById.get(subjectId)?.name : undefined
    return name ? `${name} · ${text}` : text
  }
  const firstDay = days[0]
  const lastDay = days.at(-1)!
  const allDayItems = assignLanes([
    ...events
      .filter((e) => isMultiDay(e) || e.allDay || !e.startTime)
      .filter((e) => e.date <= lastDay && (e.endDate ?? e.date) >= firstDay)
      .map((e) => ({
        key: `e:${e.id}`,
        from: Math.max(daysBetween(firstDay, e.date), 0),
        to: Math.min(daysBetween(firstDay, e.endDate ?? e.date), columnCount - 1),
        event: e,
        continuesBefore: e.date < firstDay,
        continuesAfter: (e.endDate ?? e.date) > lastDay,
      })),
    ...(data?.homework ?? [])
      .filter((h) => days.includes(h.dueDate))
      .map((h) => ({ key: `h:${h.id}`, from: days.indexOf(h.dueDate), to: days.indexOf(h.dueDate), homework: h })),
  ])
  const allDayLanes = Math.max(1, ...allDayItems.map((i) => i.lane + 1))

  // ---------------------------------------------------------------- placeholder card (new event from the grid)
  const fromGrid = open?.kind === 'new' && !open.anchor
  const ghost: { date: string; start: number; end: number; title: string } | null =
    dragPreview && !dragPreview.eventId
      ? { ...dragPreview, title: 'New event' }
      : fromGrid && open.kind === 'new'
        ? {
            date: preview?.date && days.includes(preview.date) ? preview.date : open.draft.date,
            start: toMinutes(preview?.startTime ?? open.draft.startTime!),
            end: toMinutes(preview?.endTime ?? open.draft.endTime!),
            title: preview?.title ?? 'New event',
          }
        : null

  const closePopover = () => {
    setOpen(null)
    setPreview(null)
  }

  return (
    <div className={styles.page}>
      <header className="page-header">
        <div className="titles">
          <h1 className="t-title">{weekTitle(weekDays[0], weekDays.at(-1)!)}</h1>
          <p className="t-caption c-tertiary">Week {isoWeekNumber(weekStart)}</p>
        </div>
        <div className={`segmented ${styles.viewSwitch}`} role="group" aria-label="View">
          <button type="button" aria-pressed="true">
            Week
          </button>
          <Link to={`/month?date=${weekStart}`} role="button" aria-pressed="false">
            Month
          </Link>
        </div>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <Icon name="chevron-left" />
        </button>
        <button type="button" className="btn btn-secondary btn-icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <Icon name="chevron-right" />
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setWeekStart(startOfIsoWeek(todayIso()))}>
          Today
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={(e) => setOpen({ kind: 'new', anchor: e.currentTarget, draft: { date: days.includes(now.date) ? now.date : firstDay, startTime: '08:00' } })}
        >
          New
        </button>
      </header>

      {isPhone && (
        <div className={styles.strip} role="tablist" aria-label="Day">
          {weekDays.map((d) => {
            const hasAssessed = data?.events.some((e) => e.date === d && ASSESSED_KINDS.includes(e.kind))
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === phoneDay}
                className={`${styles.stripDay} ${d === phoneDay ? styles.stripSelected : ''}`}
                onClick={() => setPickedDay(d)}
              >
                <span className="t-label">{WEEKDAYS_SHORT[isoWeekday(d) - 1]}</span>
                <span className="t-body-strong">{Number(d.slice(8))}</span>
                <span className={styles.stripDot} style={{ opacity: hasAssessed ? 1 : 0 }} />
              </button>
            )
          })}
        </div>
      )}

      <div className={`card ${styles.grid}`} style={{ '--days': columnCount } as CSSProperties}>
        <div className={styles.headRow} hidden={isPhone /* the day strip above already shows the day */}>
          <div className={styles.gutter} />
          {days.map((d, i) => (
            <div key={d} className={styles.dayHead}>
              <span className={`t-label ${d === now.date ? '' : 'c-tertiary'}`}>{WEEKDAYS_SHORT[isoWeekday(d) - 1] ?? WEEKDAYS_SHORT[i]}</span>
              <span className={`t-body-strong ${d === now.date ? styles.todayDate : ''}`}>{Number(d.slice(8))}</span>
              {data?.days.find((x) => x.date === d)?.isHoliday && <span className="t-caption c-tertiary">Holiday</span>}
            </div>
          ))}
        </div>

        <div className={styles.allDayRow} style={{ gridTemplateRows: `repeat(${allDayLanes}, 24px)` }}>
          <div className={`t-mono-small c-tertiary ${styles.allDayLabel}`} style={{ gridRow: `1 / span ${allDayLanes}` }}>
            All day
          </div>
          {days.map((d, i) => (
            <div key={d} className={styles.allDayCell} style={{ gridColumn: i + 2, gridRow: `1 / span ${allDayLanes}` }} />
          ))}
          {allDayItems.map((item) => {
            const pos = { gridColumn: `${item.from + 2} / ${item.to + 3}`, gridRow: item.lane + 1 }
            if ('homework' in item) {
              const h = item.homework!
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`t-caption ${styles.dueChip} ${h.done ? styles.done : ''}`}
                  style={pos}
                  data-subject={h.subjectId ? subjectById.get(h.subjectId)?.color : undefined}
                  title={h.done ? 'Mark as not done' : 'Mark as done'}
                  aria-pressed={h.done}
                  onClick={() => updateHomework.mutate({ id: h.id, done: !h.done })}
                >
                  <span className={styles.dueBox} />
                  <span className={styles.dueText}>{withSubject(h.subjectId, h.title)}</span>
                </button>
              )
            }
            const e = item.event!
            const personal = PERSONAL_KINDS.includes(e.kind) || !e.subjectId
            const times = !e.allDay && e.startTime ? `${e.startTime}${isMultiDay(e) && e.endTime ? ` → ${e.endTime}` : ''}` : ''
            return (
              <button
                key={item.key}
                type="button"
                className={`t-caption ${styles.bar} ${personal ? styles.barPersonal : ''} ${item.continuesBefore ? styles.barCutStart : ''} ${item.continuesAfter ? styles.barCutEnd : ''}`}
                style={pos}
                data-subject={e.subjectId ? subjectById.get(e.subjectId)?.color : undefined}
                onClick={(ev) => setOpen({ kind: 'edit', event: data!.events.find((x) => x.id === e.id) ?? e, anchor: ev.currentTarget })}
              >
                <span className={`t-body-strong ${styles.barTitle}`}>{e.title}</span>
                {times && <span className="t-mono-small">{times}</span>}
                {e.kind !== 'other' && <span className={`t-label ${styles.barTag}`}>{EVENT_KIND_LABELS[e.kind]}</span>}
              </button>
            )
          })}
        </div>

        <div className={styles.timeArea} style={{ height: y(end) + 12 }}>
          {hours.map((h) => (
            <div key={h} className={styles.hourLine} style={{ top: y(h) }}>
              {h > start && <span className="t-mono-small c-tertiary">{String(h / 60).padStart(2, '0')}:00</span>}
            </div>
          ))}

          <div ref={colsRef} className={`${styles.columns} ${dragPreview ? styles.dragging : ''}`}>
            {days.map((d, dayIdx) => {
              const wake = data?.days.find((x) => x.date === d)?.wakeTime
              return (
                <div key={d} className={styles.dayColumn} onPointerDown={(e) => onColumnPointerDown(e, dayIdx)}>
                  {wake && (
                    <div className={styles.alarm} style={{ top: y(toMinutes(wake)) - 8 }}>
                      <Icon name="bell" size={12} />
                      <span className="t-mono-small">{wake}</span>
                      <span className={styles.alarmRule} />
                    </div>
                  )}
                  {(itemsByDay.get(d) ?? []).map((item) => {
                    const box: CSSProperties = {
                      position: 'absolute',
                      top: y(item.start) + 1,
                      height: Math.max(y(item.end) - y(item.start) - 2, 22),
                      left: `calc(${(item.col / item.cols) * 100}% + 4px)`,
                      width: `calc(${100 / item.cols}% - 8px)`,
                    }
                    const blockProps = { variant: item.variant, color: item.color, title: item.title, meta: item.meta, tags: item.tags }
                    if (item.lesson) {
                      const lesson = item.lesson
                      return (
                        <Block
                          key={item.key}
                          {...blockProps}
                          style={box}
                          selected={open?.kind === 'lesson' && open.lesson.slotId === lesson.slotId && open.lesson.date === lesson.date}
                          onClick={(e) => setOpen({ kind: 'lesson', lesson, anchor: e.currentTarget })}
                        />
                      )
                    }
                    const event = data?.events.find((x) => x.id === item.eventId)
                    if (!event) return null
                    const isDragged = dragPreview?.eventId === event.id
                    return (
                      <div
                        key={item.key}
                        role="button"
                        tabIndex={0}
                        aria-label={`${item.title}, ${item.meta}. Drag to move, drag the bottom edge to resize.`}
                        className={`${styles.card} ${isDragged ? styles.cardDragging : ''} ${event.id in pending ? styles.cardSaving : ''}`}
                        style={box}
                        onPointerDown={(e) => onCardPointerDown(e, event, item)}
                        onClick={(e) => touchRef.current && setOpen({ kind: 'edit', event, anchor: e.currentTarget })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setOpen({ kind: 'edit', event, anchor: e.currentTarget })
                          }
                        }}
                      >
                        <Block {...blockProps} style={{ height: '100%' }} selected={open?.kind === 'edit' && open.event.id === event.id} />
                        <span className={styles.resizeHandle} data-resize="" aria-hidden="true" />
                      </div>
                    )
                  })}
                  {ghost && ghost.date === d && (
                    <div
                      ref={fromGrid ? setGhostEl : undefined}
                      className={styles.ghost}
                      style={{ top: y(ghost.start) + 1, height: Math.max(y(ghost.end) - y(ghost.start) - 2, 22) }}
                    >
                      <span className={`t-body-strong ${styles.ghostTitle}`}>{ghost.title}</span>
                      <span className="t-mono-small c-secondary">
                        {fromMinutes(ghost.start)}–{fromMinutes(Math.min(ghost.end, 24 * 60 - 1))}
                      </span>
                    </div>
                  )}
                  {nowInView && d === now.date && (
                    <div className={styles.nowLine} style={{ top: y(now.minutes) }}>
                      <span className={styles.nowDot} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {nowInView && (
            <span className={`t-mono-small c-now ${styles.nowLabel}`} style={{ top: y(now.minutes) - 7 }}>
              {fromMinutes(now.minutes)}
            </span>
          )}

          {isEmpty && (
            <div className={styles.emptyOverlay}>
              <div className={`card ${styles.emptyCard}`}>
                <div className="empty">
                  <h2 className="t-heading">Nothing this week</h2>
                  <p className="t-body c-secondary">Set up your timetable once and your lessons show up here every week.</p>
                  <Link to="/timetable" className="btn btn-primary">
                    Set up timetable
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {open?.kind === 'edit' && <EventPopover anchor={open.anchor} event={open.event} onClose={closePopover} />}
      {open?.kind === 'lesson' && (
        <OccurrencePopover anchor={open.anchor} lesson={open.lesson} subject={subjectById.get(open.lesson.subjectId)} onClose={closePopover} />
      )}
      {open?.kind === 'new' && (open.anchor ?? ghostEl) && (
        <EventPopover
          anchor={(open.anchor ?? ghostEl)!}
          draft={open.draft}
          compact={!open.anchor}
          onPreview={open.anchor ? undefined : setPreview}
          onClose={closePopover}
        />
      )}
    </div>
  )
}
