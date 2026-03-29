"use client"

import * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { TodoCard, type Todo } from "@/components/todo/TodoCard"

/**
 * 할 일 목록을 렌더링하며 로딩/오류/빈 상태 UI를 제공합니다.
 */
export const TodoList = ({ 
  todos,
  isLoading = false,
  error = null,
  onToggleCompleted,
  onEdit,
  onDelete,
  className,
  emptyTitle = "할 일이 아직 없어요",
  emptyDescription = "새로운 할 일을 추가해 시작해보세요.",
}: TodoListProps) => {
  if (error) {
    return (
      <Alert variant="destructive" className={cn("w-full", className)}>
        <AlertTitle>문제가 발생했어요</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className={cn("flex w-full items-center justify-center gap-2 py-10 text-muted-foreground", className)}>
        <Spinner />
        <span>불러오는 중...</span>
      </div>
    )
  }

  if (todos.length === 0) {
    return (
      <Alert className={cn("w-full", className)}>
        <AlertTitle>{emptyTitle}</AlertTitle>
        <AlertDescription>{emptyDescription}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      {todos.map((todo) => (
        <TodoCard
          key={todo.id}
          todo={todo}
          onToggleCompleted={onToggleCompleted}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

export type TodoListProps = {
  /**
   * 표시할 할 일 목록입니다.
   */
  todos: Todo[]
  /**
   * 목록 로딩 여부입니다.
   */
  isLoading?: boolean
  /**
   * 목록 조회/렌더링 오류 메시지입니다.
   */
  error?: string | null
  /**
   * 완료 여부 토글 요청 핸들러입니다.
   */
  onToggleCompleted: (id: string, completed: boolean) => void
  /**
   * 할 일 수정 요청 핸들러입니다.
   */
  onEdit: (todo: Todo) => void
  /**
   * 할 일 삭제 요청 핸들러입니다.
   */
  onDelete: (id: string) => void
  className?: string
  emptyTitle?: string
  emptyDescription?: string
}

