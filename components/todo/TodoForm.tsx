"use client"

import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

import { type TodoPriority } from "@/components/todo/TodoCard"

/**
 * 할 일의 추가/편집을 위한 입력 폼 컴포넌트입니다.
 */
export const TodoForm = ({
  mode,
  initialValues,
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}: TodoFormProps) => {
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  const [values, setValues] = React.useState<TodoFormValues>(() => {
    const initial = initialValues ?? {}
    return {
      title: initial.title ?? "",
      description: initial.description ?? null,
      due_date: initial.due_date ?? null,
      priority: (initial.priority ?? "medium") as TodoPriority,
      category: initial.category ?? "업무",
      completed: Boolean(initial.completed),
    }
  })

  React.useEffect(() => {
    const next = initialValues ?? {}
    setValues({
      title: next.title ?? "",
      description: next.description ?? null,
      due_date: next.due_date ?? null,
      priority: (next.priority ?? "medium") as TodoPriority,
      category: next.category ?? "업무",
      completed: Boolean(next.completed),
    })
    setSubmitError(null)
  }, [initialValues, mode])

  const dueDateInputValue = toDateTimeLocalValue(values.due_date)

  const handleChangeDueDate = (value: string) => {
    setValues((prev) => ({ ...prev, due_date: toIsoFromDateTimeLocalValue(value) }))
    setSubmitError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting) return

    setSubmitError(null)

    const title = values.title.trim()
    if (!title) {
      setSubmitError("제목을 입력해주세요.")
      return
    }

    const category = values.category.trim() || "업무"
    const description = values.description?.trim() ? values.description.trim() : null

    try {
      await onSubmit({
        title,
        category,
        description,
        due_date: values.due_date ?? null,
        priority: values.priority,
        completed: values.completed,
      })
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[TodoForm] 제출 실패", err)
      }
      setSubmitError("요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.")
    }
  }

  const submitDisabled = submitting

  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{mode === "create" ? "할 일 추가" : "할 일 편집"}</CardTitle>
            <CardDescription>
              AI가 할 일을 구조화해 저장하는 흐름을 고려해, 필요한 정보를 빠르게 입력할 수 있게 구성했어요.
            </CardDescription>
          </div>
          <Badge variant="outline">{mode === "create" ? "추가" : "편집"}</Badge>
        </div>
      </CardHeader>

      <CardContent>
        {error || submitError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{error ?? submitError}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="todo-title">제목</Label>
            <Input
              id="todo-title"
              value={values.title}
              placeholder="예: 내일 오전 10시에 팀 회의 준비"
              onChange={(e) => {
                setValues((prev) => ({ ...prev, title: e.target.value }))
                setSubmitError(null)
              }}
              disabled={submitDisabled}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="todo-description">설명</Label>
            <Textarea
              id="todo-description"
              value={values.description ?? ""}
              placeholder="예: 회의 자료와 체크리스트를 정리해두기"
              onChange={(e) => {
                const next = e.target.value
                setValues((prev) => ({ ...prev, description: next }))
                setSubmitError(null)
              }}
              disabled={submitDisabled}
              rows={4}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="todo-due-date">마감일</Label>
              <Input
                id="todo-due-date"
                type="datetime-local"
                value={dueDateInputValue}
                onChange={(e) => handleChangeDueDate(e.target.value)}
                disabled={submitDisabled}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="todo-category">카테고리</Label>
              <Input
                id="todo-category"
                value={values.category}
                placeholder="업무 / 개인 / 학습"
                onChange={(e) => {
                  setValues((prev) => ({ ...prev, category: e.target.value }))
                  setSubmitError(null)
                }}
                disabled={submitDisabled}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>우선순위</Label>
            <Select
              value={values.priority}
              onValueChange={(value) => {
                setValues((prev) => ({ ...prev, priority: value as TodoPriority }))
                setSubmitError(null)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="우선순위를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">높음</SelectItem>
                <SelectItem value="medium">중간</SelectItem>
                <SelectItem value="low">낮음</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="todo-completed"
              checked={values.completed}
              disabled={submitDisabled}
              onCheckedChange={(checked) => {
                setValues((prev) => ({ ...prev, completed: checked }))
                setSubmitError(null)
              }}
            />
            <Label htmlFor="todo-completed">완료됨</Label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            {onCancel ? (
              <Button type="button" variant="outline" onClick={onCancel} disabled={submitDisabled}>
                취소
              </Button>
            ) : null}

            <Button type="submit" disabled={submitDisabled}>
              {submitting ? <Spinner className="mr-2" /> : null}
              {mode === "create" ? "추가하기" : "저장하기"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export type TodoFormValues = {
  title: string
  description?: string | null
  created_at?: string | Date
  due_date?: string | null
  priority: TodoPriority
  category: string
  completed: boolean
}

export type TodoFormProps = {
  mode: "create" | "edit"
  initialValues?: Partial<TodoFormValues> | null
  submitting?: boolean
  error?: string | null
  onSubmit: (values: TodoFormValues) => void | Promise<void>
  onCancel?: () => void
}

/**
 * ISO/Date 값을 `datetime-local` 입력 형식으로 변환합니다.
 */
const toDateTimeLocalValue = (value?: string | Date | null): string => {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ""

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

/**
 * `datetime-local` 값에서 ISO 문자열을 생성합니다.
 */
const toIsoFromDateTimeLocalValue = (value: string): string | null => {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

