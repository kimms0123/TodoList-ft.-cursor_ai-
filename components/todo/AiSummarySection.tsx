"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { CheckCircle2, Lightbulb, RefreshCw, Sparkles, Target } from "lucide-react"

import type { Todo, TodoPriority } from "@/components/todo/TodoCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  completionRatePercent,
  isDueToday,
  isInThisWeek,
  weekDayBuckets,
} from "@/lib/todo-period"
import { cn } from "@/lib/utils"

export type AiSummaryResult = {
  summary: string
  urgentTasks: string[]
  insights: string[]
  recommendations: string[]
}

type SummaryError = { period: "today" | "week"; message: string }

type AiSummarySectionProps = {
  todos: Todo[]
  currentUser: unknown
  summaryToday: AiSummaryResult | null
  summaryWeek: AiSummaryResult | null
  summaryLoading: "today" | "week" | null
  summaryError: SummaryError | null
  onFetchSummary: (period: "today" | "week") => void
  onClearSummaryError: () => void
}

const priorityOrder: TodoPriority[] = ["high", "medium", "low"]

function sortByPriority(a: Todo, b: Todo) {
  return priorityOrder.indexOf(b.priority) - priorityOrder.indexOf(a.priority)
}

function insightEmoji(text: string): string {
  if (/지연|마감|위험|주의|놓치|초과|긴급/i.test(text)) return "⚠️"
  if (/목표|우선|집중|핵심|완료율/i.test(text)) return "🎯"
  return "💡"
}

function isFocusTodo(todo: Todo, urgentTitles: string[]): boolean {
  if (todo.completed) return false
  const title = todo.title.trim()
  if (todo.priority === "high") return true
  return urgentTitles.some((u) => {
    const x = u.trim()
    if (!x) return false
    return title === x || title.includes(x) || x.includes(title)
  })
}

const barChartConfig = {
  완료: { label: "완료", color: "var(--chart-1)" },
  미완료: { label: "미완료", color: "var(--chart-3)" },
} satisfies ChartConfig

const lineChartConfig = {
  rate: { label: "일별 완료율(%)", color: "var(--chart-2)" },
} satisfies ChartConfig

export function AiSummarySection({
  todos,
  currentUser,
  summaryToday,
  summaryWeek,
  summaryLoading,
  summaryError,
  onFetchSummary,
  onClearSummaryError,
}: AiSummarySectionProps) {
  const now = new Date()
  const todayTodos = todos.filter((t) => isDueToday(t, now))
  const weekTodos = todos.filter((t) => isInThisWeek(t, now))

  const todayRate = completionRatePercent(todayTodos)
  const weekRate = completionRatePercent(weekTodos)

  const todayRemaining = [...todayTodos].filter((t) => !t.completed).sort(sortByPriority)

  const weekBuckets = weekDayBuckets(todos, now)

  const trendData = weekBuckets.map((b) => ({
    ...b,
    day: b.label,
    rate: b.total > 0 ? b.rate : null,
  }))

  const barData = weekBuckets.map((b) => ({
    day: b.label,
    완료: b.completed,
    미완료: b.incomplete,
  }))

  const handleFetch = (period: "today" | "week") => {
    onClearSummaryError()
    onFetchSummary(period)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-primary" aria-hidden />
          AI 요약 및 분석
        </CardTitle>
        <CardDescription>
          오늘·이번 주 할 일을 바탕으로 완료율, 패턴, 인사이트와 실행 가능한 추천을 제공합니다. 각 탭에서 분석을
          실행하세요.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="today" className="w-full gap-4">
          <TabsList className="grid w-full max-w-md grid-cols-2 sm:max-w-lg">
            <TabsTrigger value="today">오늘의 요약</TabsTrigger>
            <TabsTrigger value="week">이번 주 요약</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => handleFetch("today")}
                disabled={!currentUser || summaryLoading === "today"}
              >
                {summaryLoading === "today" ? <Spinner className="mr-2" /> : <Sparkles className="mr-2 size-4" />}
                AI 요약 보기
              </Button>
              {!currentUser ? (
                <span className="text-sm text-muted-foreground">로그인 후 이용할 수 있어요.</span>
              ) : null}
            </div>

            {summaryError?.period === "today" ? (
              <Alert variant="destructive">
                <AlertTitle>분석을 불러오지 못했어요</AlertTitle>
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{summaryError.message}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive/40 bg-background"
                    onClick={() => handleFetch("today")}
                    disabled={!currentUser || summaryLoading === "today"}
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    재시도
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {summaryLoading === "today" ? (
              <div
                className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 py-10"
                role="status"
                aria-live="polite"
              >
                <Spinner className="size-8 text-primary" />
                <p className="text-sm text-muted-foreground">오늘 할 일을 분석하는 중입니다…</p>
              </div>
            ) : null}

            {!summaryLoading && summaryToday ? (
              <div className="space-y-4">
                <Card className="overflow-hidden border-primary/15 shadow-sm">
                  <CardHeader className="space-y-1 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">당일 완료율</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground sm:text-5xl">
                          {todayRate}
                        </span>
                        <span className="text-lg font-medium text-muted-foreground">%</span>
                      </div>
                      <Badge variant="secondary" className="tabular-nums">
                        {todayTodos.filter((t) => t.completed).length}/{todayTodos.length}건 완료
                      </Badge>
                    </div>
                    <div className="[&_[data-slot=progress-track]]:h-3">
                      <Progress value={todayRate} className="w-full" aria-label={`오늘 완료율 ${todayRate}%`} />
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Card className="min-h-[140px]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">오늘 집중할 작업</CardTitle>
                      <CardDescription className="text-xs">AI가 골라낸 긴급·우선 과제입니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {summaryToday.urgentTasks.length > 0 ? (
                        <ul className="space-y-2">
                          {summaryToday.urgentTasks.slice(0, 6).map((t, i) => (
                            <li
                              key={`focus-${i}-${t}`}
                              className="flex gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 font-medium text-foreground"
                            >
                              <Target className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                              <span className="leading-snug">{t}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">표시할 집중 과제가 없어요.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="min-h-[140px]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">남은 할 일</CardTitle>
                      <CardDescription className="text-xs">우선순위 높은 순입니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {todayRemaining.length > 0 ? (
                        <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                          {todayRemaining.map((todo) => {
                            const focus = isFocusTodo(todo, summaryToday.urgentTasks)
                            return (
                              <li
                                key={todo.id}
                                className={cn(
                                  "flex items-start justify-between gap-2 rounded-md border px-2 py-1.5",
                                  focus
                                    ? "border-primary/50 bg-primary/8"
                                    : "border-transparent bg-muted/40"
                                )}
                              >
                                <span className={cn("min-w-0 flex-1 leading-snug", focus && "font-medium")}>
                                  {todo.title}
                                </span>
                                <Badge
                                  variant={todo.priority === "high" ? "destructive" : "secondary"}
                                  className="shrink-0 text-[10px]"
                                >
                                  {todo.priority === "high" ? "높음" : todo.priority === "medium" ? "중간" : "낮음"}
                                </Badge>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle2 className="size-4 text-emerald-600" />
                          남은 할 일이 없어요. 훌륭해요!
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <p className="leading-relaxed text-foreground">{summaryToday.summary}</p>

                <Separator />

                {summaryToday.insights.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {summaryToday.insights.map((text, i) => (
                      <Card key={`in-${i}`} className="border-muted bg-muted/20">
                        <CardContent className="flex gap-3 pt-4 text-sm leading-relaxed">
                          <span className="text-lg leading-none" aria-hidden>
                            {insightEmoji(text)}
                          </span>
                          <span>{text}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : null}

                {summaryToday.recommendations.length > 0 ? (
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <Lightbulb className="size-4 text-chart-4" />
                      실행 가능한 추천
                    </h4>
                    <ul className="space-y-2">
                      {summaryToday.recommendations.map((rec, i) => (
                        <li
                          key={`rec-${i}`}
                          className="flex gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm shadow-sm"
                        >
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span className="leading-relaxed">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : !summaryLoading && !summaryToday ? (
              <p className="text-sm text-muted-foreground">「AI 요약 보기」를 눌러 오늘 기준 분석을 받아보세요.</p>
            ) : null}
          </TabsContent>

          <TabsContent value="week" className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => handleFetch("week")}
                disabled={!currentUser || summaryLoading === "week"}
              >
                {summaryLoading === "week" ? <Spinner className="mr-2" /> : <Sparkles className="mr-2 size-4" />}
                AI 요약 보기
              </Button>
              {!currentUser ? (
                <span className="text-sm text-muted-foreground">로그인 후 이용할 수 있어요.</span>
              ) : null}
            </div>

            {summaryError?.period === "week" ? (
              <Alert variant="destructive">
                <AlertTitle>분석을 불러오지 못했어요</AlertTitle>
                <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{summaryError.message}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-destructive/40 bg-background"
                    onClick={() => handleFetch("week")}
                    disabled={!currentUser || summaryLoading === "week"}
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    재시도
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}

            {summaryLoading === "week" ? (
              <div
                className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 py-10"
                role="status"
                aria-live="polite"
              >
                <Spinner className="size-8 text-primary" />
                <p className="text-sm text-muted-foreground">이번 주 패턴을 분석하는 중입니다…</p>
              </div>
            ) : null}

            {!summaryLoading && summaryWeek ? (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">주간 완료율</CardTitle>
                      <CardDescription className="text-xs">이번 주(월~일) 범위에 해당하는 할 일 기준입니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-semibold tabular-nums sm:text-4xl">{weekRate}</span>
                          <span className="text-muted-foreground">%</span>
                        </div>
                        <Badge variant="outline" className="tabular-nums">
                          {weekTodos.filter((t) => t.completed).length}/{weekTodos.length}건
                        </Badge>
                      </div>
                      <div className="[&_[data-slot=progress-track]]:h-2.5">
                        <Progress value={weekRate} className="w-full" aria-label={`이번 주 완료율 ${weekRate}%`} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">요일별 완료율 추이</CardTitle>
                      <CardDescription className="text-xs">할 일이 있는 날만 곡선이 이어집니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-2 pt-0 sm:px-4">
                      <ChartContainer config={lineChartConfig} className="aspect-auto h-[200px] w-full min-w-0">
                        <LineChart data={trendData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="day" tickLine={false} axisLine={false} />
                          <YAxis domain={[0, 100]} width={28} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}`} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Line
                            type="monotone"
                            dataKey="rate"
                            stroke="var(--color-rate)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                            name="완료율"
                          />
                        </LineChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">요일별 생산성 패턴</CardTitle>
                    <CardDescription className="text-xs">마감일(없으면 생성일)이 해당 요일인 할 일 기준, 완료·미완료 비교</CardDescription>
                  </CardHeader>
                  <CardContent className="overflow-x-auto px-1 pt-0 sm:px-4">
                    <ChartContainer config={barChartConfig} className="aspect-auto h-[220px] min-h-[200px] min-w-[280px] w-full">
                      <BarChart data={barData} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                        <XAxis dataKey="day" tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="완료" stackId="a" fill="var(--color-completed)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="미완료" stackId="a" fill="var(--color-incomplete)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                <p className="leading-relaxed text-foreground">{summaryWeek.summary}</p>

                {summaryWeek.recommendations.length > 0 ? (
                  <Card className="border-dashed border-primary/40 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Target className="size-4 text-primary" />
                        다음 주 계획 제안
                      </CardTitle>
                      <CardDescription className="text-xs">AI 추천을 바탕으로 다음 주를 준비해 보세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {summaryWeek.recommendations.map((rec, i) => (
                          <li key={`next-${i}`} className="flex gap-2 text-sm leading-relaxed">
                            <span className="font-medium text-primary">{i + 1}.</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : null}

                <Separator />

                {summaryWeek.urgentTasks.length > 0 ? (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">긴급·주목 할 일</h4>
                    <ul className="flex flex-wrap gap-2">
                      {summaryWeek.urgentTasks.map((t, i) => (
                        <li key={`wu-${i}`}>
                          <Badge variant="outline" className="max-w-full whitespace-normal py-1 text-left font-normal">
                            {t}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {summaryWeek.insights.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {summaryWeek.insights.map((text, i) => (
                      <Card key={`win-${i}`} className="border-muted bg-muted/20">
                        <CardContent className="flex gap-3 pt-4 text-sm leading-relaxed">
                          <span className="text-lg leading-none" aria-hidden>
                            {insightEmoji(text)}
                          </span>
                          <span>{text}</span>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : !summaryLoading && !summaryWeek ? (
              <p className="text-sm text-muted-foreground">「AI 요약 보기」를 눌러 이번 주 기준 분석을 받아보세요.</p>
            ) : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
