"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bot, LogOut, Search, User } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

import { AiSummarySection, type AiSummaryResult } from "@/components/todo/AiSummarySection"
import { TodoForm, type TodoFormValues } from "@/components/todo/TodoForm"
import { TodoList } from "@/components/todo/TodoList"
import { type Todo, type TodoPriority } from "@/components/todo/TodoCard"
import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

type StatusFilter = "all" | "completed" | "incomplete"
type PriorityFilter = "all" | TodoPriority
type SortBy = "created_at_desc" | "due_date_asc" | "priority_desc" | "title_asc"

const normalizeCategory = (value?: string | null): string => {
  const raw = (value ?? "").trim().toLowerCase()
  if (["업무", "work"].includes(raw)) return "work"
  if (["개인", "personal"].includes(raw)) return "personal"
  if (["학습", "study"].includes(raw)) return "study"
  return "work"
}

const isCategoryConstraintError = (message?: string | null) => {
  return (message ?? "").includes("todos_category_check")
}

const CATEGORY_CANDIDATES = ["work", "personal", "study", "업무", "개인", "학습"] as const

export default function HomePage() {
  const router = useRouter()

  const [todos, setTodos] = React.useState<Todo[]>([])
  const [editingTodo, setEditingTodo] = React.useState<Todo | null>(null)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all")
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>("all")
  const [sortBy, setSortBy] = React.useState<SortBy>("created_at_desc")
  const [currentUser, setCurrentUser] = React.useState<SupabaseUser | null>(null)
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const [isLoadingTodos, setIsLoadingTodos] = React.useState(false)
  const [isSubmittingTodo, setIsSubmittingTodo] = React.useState(false)
  const [todoError, setTodoError] = React.useState<string | null>(null)

  const [aiInput, setAiInput] = React.useState("")
  const [aiDraft, setAiDraft] = React.useState<Partial<TodoFormValues> | null>(null)
  const [isGeneratingAi, setIsGeneratingAi] = React.useState(false)

  const [summaryToday, setSummaryToday] = React.useState<AiSummaryResult | null>(null)
  const [summaryWeek, setSummaryWeek] = React.useState<AiSummaryResult | null>(null)
  const [summaryLoading, setSummaryLoading] = React.useState<"today" | "week" | null>(null)
  const [summaryError, setSummaryError] = React.useState<{ period: "today" | "week"; message: string } | null>(null)

  const editingInitialValues = React.useMemo<Partial<TodoFormValues> | undefined>(() => {
    if (!editingTodo) return undefined

    const due =
      editingTodo.due_date instanceof Date
        ? editingTodo.due_date.toISOString()
        : (editingTodo.due_date ?? null)

    return {
      title: editingTodo.title,
      description: editingTodo.description ?? null,
      due_date: due,
      priority: editingTodo.priority,
      category: editingTodo.category,
      completed: editingTodo.completed,
    }
  }, [editingTodo])

  const loadTodos = React.useCallback(
    async (userId: string) => {
      setTodoError(null)
      setIsLoadingTodos(true)

      try {
        const supabase = createClient()
        let query = supabase
          .from("todos")
          .select("id, user_id, title, description, created_at:created_date, due_date, priority, category, completed")
          .eq("user_id", userId)

        const keyword = search.trim()
        if (keyword) {
          query = query.ilike("title", `%${keyword}%`)
        }

        if (statusFilter === "completed") {
          query = query.eq("completed", true)
        } else if (statusFilter === "incomplete") {
          query = query.eq("completed", false)
        }

        if (priorityFilter !== "all") {
          query = query.eq("priority", priorityFilter)
        }

        const { data, error } = await query.order("created_date", { ascending: false })
        if (error) {
          const message = [error.message, error.details, error.hint].filter(Boolean).join(" / ")
          setTodoError(`할 일 목록을 불러오지 못했어요. ${message || "다시 시도해주세요."}`)
          return
        }

        const baseTodos = (data ?? []) as Todo[]
        const priorityScore: Record<TodoPriority, number> = { high: 3, medium: 2, low: 1 }

        const sorted = [...baseTodos].sort((a, b) => {
          if (sortBy === "title_asc") {
            return a.title.localeCompare(b.title, "ko")
          }
          if (sortBy === "priority_desc") {
            return priorityScore[b.priority] - priorityScore[a.priority]
          }
          if (sortBy === "due_date_asc") {
            const aTime = a.due_date ? new Date(a.due_date).getTime() : Number.POSITIVE_INFINITY
            const bTime = b.due_date ? new Date(b.due_date).getTime() : Number.POSITIVE_INFINITY
            return aTime - bTime
          }
          const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0
          const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0
          return bCreated - aCreated
        })

        setTodos(sorted)
      } catch {
        setTodoError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.")
      } finally {
        setIsLoadingTodos(false)
      }
    },
    [priorityFilter, search, sortBy, statusFilter]
  )

  React.useEffect(() => {
    let unsubscribed = false

    const initAuth = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.getUser()
        if (error) {
          if (!unsubscribed) setAuthError("사용자 정보를 불러오지 못했어요.")
          return
        }
        if (!unsubscribed) setCurrentUser(data.user ?? null)

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
          if (!unsubscribed) setCurrentUser(session?.user ?? null)
        })

        return () => listener.subscription.unsubscribe()
      } catch {
        if (!unsubscribed) setAuthError("인증 초기화에 실패했어요. 환경변수를 확인해주세요.")
      }
    }

    let cleanup: (() => void) | undefined
    void initAuth().then((fn) => {
      cleanup = fn
    })

    return () => {
      unsubscribed = true
      cleanup?.()
    }
  }, [])

  React.useEffect(() => {
    if (!currentUser) return
    void loadTodos(currentUser.id)
  }, [currentUser, loadTodos])

  const handleLogout = async () => {
    if (isSigningOut) return
    setAuthError(null)
    setIsSigningOut(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        setAuthError("로그아웃에 실패했어요. 잠시 후 다시 시도해주세요.")
        return
      }
      setCurrentUser(null)
      router.push("/login")
      router.refresh()
    } catch {
      setAuthError("로그아웃 처리 중 오류가 발생했어요.")
    } finally {
      setIsSigningOut(false)
    }
  }

  const handleCreateTodo = async (values: TodoFormValues) => {
    if (!currentUser) {
      setTodoError("로그인이 필요합니다.")
      return
    }

    setTodoError(null)
    setIsSubmittingTodo(true)

    try {
      const { error } = await createClient().from("todos").insert({
        user_id: currentUser.id,
        title: values.title,
        description: values.description ?? null,
        due_date: values.due_date ?? null,
        priority: values.priority,
        category: normalizeCategory(values.category),
        completed: values.completed,
      })

      if (error && isCategoryConstraintError(error.message)) {
        for (const candidate of CATEGORY_CANDIDATES) {
          const fallback = await createClient().from("todos").insert({
            user_id: currentUser.id,
            title: values.title,
            description: values.description ?? null,
            due_date: values.due_date ?? null,
            priority: values.priority,
            category: candidate,
            completed: values.completed,
          })

          if (!fallback.error) {
            await loadTodos(currentUser.id)
            setAiDraft(null)
            setAiInput("")
            return
          }
        }
      }

      if (error) {
        const message = [error.message, error.details, error.hint].filter(Boolean).join(" / ")
        setTodoError(`할 일 추가에 실패했어요. ${message || "잠시 후 다시 시도해주세요."}`)
        return
      }

      await loadTodos(currentUser.id)
      setAiDraft(null)
      setAiInput("")
    } catch {
      setTodoError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsSubmittingTodo(false)
    }
  }

  const handleUpdateTodo = async (values: TodoFormValues) => {
    if (!editingTodo || !currentUser) return

    setTodoError(null)
    setIsSubmittingTodo(true)

    try {
      const { error } = await createClient()
        .from("todos")
        .update({
          title: values.title,
          description: values.description ?? null,
          due_date: values.due_date ?? null,
          priority: values.priority,
          category: normalizeCategory(values.category),
          completed: values.completed,
        })
        .eq("id", editingTodo.id)
        .eq("user_id", currentUser.id)

      if (error && isCategoryConstraintError(error.message)) {
        for (const candidate of CATEGORY_CANDIDATES) {
          const fallback = await createClient()
            .from("todos")
            .update({
              title: values.title,
              description: values.description ?? null,
              due_date: values.due_date ?? null,
              priority: values.priority,
              category: candidate,
              completed: values.completed,
            })
            .eq("id", editingTodo.id)
            .eq("user_id", currentUser.id)

          if (!fallback.error) {
            setEditingTodo(null)
            await loadTodos(currentUser.id)
            return
          }
        }
      }

      if (error) {
        const message = [error.message, error.details, error.hint].filter(Boolean).join(" / ")
        setTodoError(`할 일 수정에 실패했어요. ${message || "잠시 후 다시 시도해주세요."}`)
        return
      }

      setEditingTodo(null)
      await loadTodos(currentUser.id)
    } catch {
      setTodoError("네트워크 오류가 발생했어요. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsSubmittingTodo(false)
    }
  }

  const handleDeleteTodo = async (id: string) => {
    if (!currentUser) {
      setTodoError("로그인이 필요합니다.")
      return
    }
    if (!window.confirm("이 할 일을 삭제하시겠어요?")) return

    setTodoError(null)
    const { error } = await createClient()
      .from("todos")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id)

    if (error) {
      const message = [error.message, error.details, error.hint].filter(Boolean).join(" / ")
      setTodoError(`할 일 삭제에 실패했어요. ${message || "잠시 후 다시 시도해주세요."}`)
      return
    }

    setEditingTodo((prev) => (prev?.id === id ? null : prev))
    await loadTodos(currentUser.id)
  }

  const handleToggleCompleted = async (id: string, completed: boolean) => {
    if (!currentUser) {
      setTodoError("로그인이 필요합니다.")
      return
    }

    setTodoError(null)
    const { error } = await createClient()
      .from("todos")
      .update({ completed })
      .eq("id", id)
      .eq("user_id", currentUser.id)

    if (error) {
      const message = [error.message, error.details, error.hint].filter(Boolean).join(" / ")
      setTodoError(`완료 상태 변경에 실패했어요. ${message || "잠시 후 다시 시도해주세요."}`)
      return
    }

    await loadTodos(currentUser.id)
  }

  const handleAIGenerate = async () => {
    const input = aiInput.trim()
    if (!input) {
      setTodoError("AI로 생성할 내용을 입력해주세요.")
      return
    }
    if (!currentUser) {
      setTodoError("로그인이 필요합니다.")
      return
    }
    if (isGeneratingAi) return

    setTodoError(null)
    setIsGeneratingAi(true)

    try {
      const res = await fetch("/api/ai/generate-todo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      })

      const json = await res.json()
      if (!res.ok || !json.ok) {
        const message = (json?.error as string | undefined) ?? "AI 변환 중 오류가 발생했어요."
        setTodoError(message)
        return
      }

      const data = json.data as {
        title: string
        description?: string | null
        due_date: string
        due_time?: string
        priority: TodoPriority
        category: string
      }

      const dueTime = data.due_time || "09:00"
      const dueDateObj = new Date(`${data.due_date}T${dueTime}:00`)
      const safeDueDateObj = Number.isNaN(dueDateObj.getTime())
        ? new Date(`${data.due_date}T09:00:00`)
        : dueDateObj

      setAiDraft({
        title: data.title,
        description: data.description ?? null,
        due_date: safeDueDateObj.toISOString(),
        priority: data.priority,
        category: normalizeCategory(data.category),
        completed: false,
      })
      setAiInput("")
    } catch {
      setTodoError("AI로 변환하지 못했어요. 잠시 후 다시 시도해주세요.")
    } finally {
      setIsGeneratingAi(false)
    }
  }

  const handleFetchSummary = async (period: "today" | "week") => {
    if (!currentUser) {
      setSummaryError({ period, message: "로그인이 필요합니다." })
      return
    }
    setSummaryError(null)
    setSummaryLoading(period)
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setSummaryError({
          period,
          message: (json?.error as string) ?? "요약을 불러오지 못했어요.",
        })
        return
      }
      const data = json.data as AiSummaryResult
      if (period === "today") setSummaryToday(data)
      else setSummaryWeek(data)
    } catch {
      setSummaryError({ period, message: "네트워크 오류로 요약을 가져오지 못했어요." })
    } finally {
      setSummaryLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="size-5" aria-hidden />
            </div>
            <div>
              <h1 className="font-semibold">AI Todo Manager</h1>
              <p className="text-sm text-muted-foreground">오늘의 할 일을 효율적으로 관리하세요</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarFallback>
                <User className="size-4" aria-hidden />
              </AvatarFallback>
            </Avatar>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{currentUser?.user_metadata?.name ?? "게스트"}</p>
              <p className="text-xs text-muted-foreground">{currentUser?.email ?? "로그인이 필요합니다"}</p>
            </div>
            {currentUser ? (
              <Button type="button" variant="outline" onClick={handleLogout} disabled={isSigningOut}>
                {isSigningOut ? <Spinner className="mr-1" /> : <LogOut className="mr-1 size-4" aria-hidden />}
                {isSigningOut ? "로그아웃 중..." : "로그아웃"}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => router.push("/login")}>
                로그인
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
        {authError || todoError ? (
          <Alert variant="destructive">
            <AlertTitle>오류</AlertTitle>
            <AlertDescription>{authError ?? todoError}</AlertDescription>
          </Alert>
        ) : null}
        <AiSummarySection
          todos={todos}
          currentUser={currentUser}
          summaryToday={summaryToday}
          summaryWeek={summaryWeek}
          summaryLoading={summaryLoading}
          summaryError={summaryError}
          onFetchSummary={handleFetchSummary}
          onClearSummaryError={() => setSummaryError(null)}
        />

        <Card>
          <CardContent className="grid gap-4 pt-4 lg:grid-cols-[1fr_160px_160px_180px]">
            <div className="grid gap-2">
              <Label htmlFor="todo-search">검색</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="todo-search"
                  placeholder="제목 또는 설명으로 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>상태</Label>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="incomplete">미완료</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>우선순위</Label>
              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="우선순위 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="high">높음</SelectItem>
                  <SelectItem value="medium">중간</SelectItem>
                  <SelectItem value="low">낮음</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>정렬</Label>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                <SelectTrigger>
                  <SelectValue placeholder="정렬 기준 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at_desc">생성일순</SelectItem>
                  <SelectItem value="due_date_asc">마감일순</SelectItem>
                  <SelectItem value="priority_desc">우선순위순</SelectItem>
                  <SelectItem value="title_asc">제목순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-5">
          <section className="lg:col-span-2">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ai-input">AI로 할 일 생성(자연어)</Label>
                <Textarea
                  id="ai-input"
                  rows={3}
                  placeholder="예: 내일 오후 3시까지 중요한 팀 회의 준비하기"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  disabled={isGeneratingAi}
                />
                <div className="flex justify-end">
                  <Button type="button" onClick={handleAIGenerate} disabled={isGeneratingAi}>
                    {isGeneratingAi ? <Spinner className="mr-2" /> : null}
                    AI로 생성
                  </Button>
                </div>
              </div>

              <TodoForm
                mode={editingTodo ? "edit" : "create"}
                initialValues={editingTodo ? editingInitialValues : aiDraft}
                submitting={isSubmittingTodo}
                onCancel={editingTodo ? () => setEditingTodo(null) : undefined}
                onSubmit={editingTodo ? handleUpdateTodo : handleCreateTodo}
              />
            </div>
          </section>

          <section className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">할 일 목록</h2>
              <Badge variant="outline">{todos.length}개</Badge>
            </div>

            <TodoList
              todos={todos}
              isLoading={isLoadingTodos}
              onToggleCompleted={handleToggleCompleted}
              onEdit={setEditingTodo}
              onDelete={handleDeleteTodo}
            />
          </section>
        </div>
      </main>
    </div>
  )
}
