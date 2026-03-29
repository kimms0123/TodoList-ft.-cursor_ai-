import type { Todo } from "@/components/todo/TodoCard"

export function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

export function startOfWeekMonday(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function endOfWeekSunday(d: Date) {
  const start = startOfWeekMonday(d)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function isDueToday(todo: Todo, now: Date): boolean {
  const today = ymd(now)
  if (todo.due_date) {
    const due = new Date(todo.due_date)
    if (!Number.isNaN(due.getTime())) return ymd(due) === today
  }
  if (todo.created_at) {
    const c = new Date(todo.created_at)
    if (!Number.isNaN(c.getTime())) return ymd(c) === today
  }
  return false
}

export function isInThisWeek(todo: Todo, now: Date): boolean {
  const start = startOfWeekMonday(now).getTime()
  const end = endOfWeekSunday(now).getTime()
  const candidates: Date[] = []
  if (todo.due_date) {
    const due = new Date(todo.due_date)
    if (!Number.isNaN(due.getTime())) candidates.push(due)
  }
  if (todo.created_at) {
    const c = new Date(todo.created_at)
    if (!Number.isNaN(c.getTime())) candidates.push(c)
  }
  return candidates.some((t) => t.getTime() >= start && t.getTime() <= end)
}

export function completionRatePercent(todos: Todo[]): number {
  if (todos.length === 0) return 0
  return Math.round((todos.filter((t) => t.completed).length / todos.length) * 100)
}

export type WeekDayBucket = {
  key: string
  label: string
  total: number
  completed: number
  incomplete: number
  rate: number | null
}

/** 이번 주 각 요일(월~일)에 속한 할 일을 마감일 우선·없으면 생성일 기준으로 집계합니다. */
export function weekDayBuckets(todos: Todo[], now: Date): WeekDayBucket[] {
  const start = startOfWeekMonday(now)
  const labels = ["월", "화", "수", "목", "금", "토", "일"]
  const inWeek = todos.filter((t) => isInThisWeek(t, now))

  const buckets: WeekDayBucket[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dayStr = ymd(d)
    const onDay = inWeek.filter((t) => {
      let ref: Date | null = null
      if (t.due_date) {
        const due = new Date(t.due_date)
        if (!Number.isNaN(due.getTime())) ref = due
      }
      if (!ref && t.created_at) {
        const c = new Date(t.created_at)
        if (!Number.isNaN(c.getTime())) ref = c
      }
      return ref ? ymd(ref) === dayStr : false
    })
    const completed = onDay.filter((t) => t.completed).length
    const total = onDay.length
    const incomplete = total - completed
    buckets.push({
      key: dayStr,
      label: labels[i]!,
      total,
      completed,
      incomplete,
      rate: total > 0 ? Math.round((completed / total) * 100) : null,
    })
  }
  return buckets
}
