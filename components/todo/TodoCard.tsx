"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

/**
 * 개별 할 일을 카드 형태로 표시하고 완료/수정/삭제 액션을 제공합니다.
 */
export const TodoCard = ({
  todo,
  onToggleCompleted,
  onEdit,
  onDelete,
  disabled = false,
}: TodoCardProps) => {
  const checkboxId = `todo-completed-${todo.id}`
  const isOverdue = (() => {
    if (todo.completed) return false
    const dueDate = todo.due_date
    if (!dueDate) return false
    const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
    return !Number.isNaN(d.getTime()) && d.getTime() < Date.now()
  })()

  const priorityVariant = getPriorityBadgeVariant(todo.priority)
  const dueLabel = formatDueDate(todo.due_date)

  return (
    <Card className={todo.completed ? "opacity-80" : undefined}>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className={todo.completed ? "line-through" : undefined}>{todo.title}</CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={priorityVariant}>{priorityLabel(todo.priority)}</Badge>
              <Badge variant="outline">{todo.category}</Badge>
              {isOverdue ? <Badge variant="destructive">지연</Badge> : null}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{todo.description || "설명 없음"}</p>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">마감:</span> {dueLabel}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id={checkboxId}
              checked={todo.completed}
              disabled={disabled}
              onCheckedChange={(checked) => onToggleCompleted(todo.id, checked)}
            />
            <Label htmlFor={checkboxId}>완료</Label>
          </div>
        </div>
      </CardContent>

      <CardFooter className="justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onEdit(todo)}>
          수정
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={disabled} onClick={() => onDelete(todo.id)}>
          삭제
        </Button>
      </CardFooter>
    </Card>
  )
}

export type TodoPriority = "high" | "medium" | "low"

export type Todo = {
  id: string
  user_id?: string
  title: string
  description?: string | null
  created_at?: string | Date
  due_date?: string | Date | null
  priority: TodoPriority
  category: string
  completed: boolean
}

export type TodoCardProps = {
  todo: Todo
  onToggleCompleted: (id: string, completed: boolean) => void
  onEdit: (todo: Todo) => void
  onDelete: (id: string) => void
  disabled?: boolean
}

/**
 * 우선순위 값에 맞는 배지 variant를 반환합니다.
 */
const getPriorityBadgeVariant = (priority: TodoPriority): "default" | "secondary" | "destructive" | "outline" => {
  if (priority === "high") return "destructive"
  if (priority === "medium") return "secondary"
  return "outline"
}

/**
 * 우선순위를 사람이 읽을 수 있는 한글 라벨로 변환합니다.
 */
const priorityLabel = (priority: TodoPriority): string => {
  if (priority === "high") return "높음"
  if (priority === "medium") return "중간"
  return "낮음"
}

/**
 * 마감일 데이터를 보기 좋은 한글 포맷 문자열로 변환합니다.
 */
const formatDueDate = (dueDate?: string | Date | null): string => {
  if (!dueDate) return "마감 없음"
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate)
  if (Number.isNaN(d.getTime())) return "마감일(형식 오류)"

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  const hh = String(d.getHours()).padStart(2, "0")
  const min = String(d.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

