import { NextResponse } from "next/server"
import { generateText, Output } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"

const BodySchema = z.object({
  period: z.enum(["today", "week"]),
})

const SummaryOutputSchema = z.object({
  summary: z.string(),
  urgentTasks: z.array(z.string()),
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
})

type TodoRow = {
  id: string
  title: string
  description: string | null
  completed: boolean
  priority: string
  category: string | null
  due_date: string | null
  created_date: string | null
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function startOfWeekMonday(d: Date) {
  const copy = new Date(d)
  const day = copy.getDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setDate(copy.getDate() + diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function endOfWeekSunday(d: Date) {
  const start = startOfWeekMonday(d)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function isDueToday(todo: TodoRow, now: Date): boolean {
  const today = ymd(now)
  if (todo.due_date) {
    const due = new Date(todo.due_date)
    if (!Number.isNaN(due.getTime())) return ymd(due) === today
  }
  if (todo.created_date) {
    const c = new Date(todo.created_date)
    if (!Number.isNaN(c.getTime())) return ymd(c) === today
  }
  return false
}

function isInThisWeek(todo: TodoRow, now: Date): boolean {
  const start = startOfWeekMonday(now).getTime()
  const end = endOfWeekSunday(now).getTime()
  const candidates: Date[] = []
  if (todo.due_date) {
    const due = new Date(todo.due_date)
    if (!Number.isNaN(due.getTime())) candidates.push(due)
  }
  if (todo.created_date) {
    const c = new Date(todo.created_date)
    if (!Number.isNaN(c.getTime())) candidates.push(c)
  }
  return candidates.some((t) => t.getTime() >= start && t.getTime() <= end)
}

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const { period } = BodySchema.parse(json)

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "서버 환경변수 GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 })
    }

    const { data: rows, error: qError } = await supabase
      .from("todos")
      .select("id, title, description, completed, priority, category, due_date, created_date")
      .eq("user_id", user.id)
      .order("created_date", { ascending: false })
      .limit(500)

    if (qError) {
      return NextResponse.json(
        { ok: false, error: "할 일 목록을 불러오지 못했어요." },
        { status: 500 }
      )
    }

    const all = (rows ?? []) as TodoRow[]
    const now = new Date()
    const filtered =
      period === "today" ? all.filter((t) => isDueToday(t, now)) : all.filter((t) => isInThisWeek(t, now))

    const payloadForModel = filtered.map((t) => ({
      title: t.title,
      completed: t.completed,
      priority: t.priority,
      category: t.category,
      due_date: t.due_date,
      created_date: t.created_date,
    }))

    const periodLabel = period === "today" ? "오늘(당일)" : "이번 주(월~일)"
    const prompt = `
역할: 너는 따뜻하고 구체적인 한국어로 조언하는 생산성 코치다.
입력: 한 사용자의 할 일 목록(JSON). 분석 기간: ${periodLabel}.

데이터 한계를 존중한다. 이전 기간·연기 이력·실제 완료 시각이 JSON에 없으면 수치를 지어내지 말고, 추정이면 "추정"임을 밝히거나 해당 항목은 짧게 건너뛴다.

반드시 다룰 분석 축 (가능한 범위에서 숫자와 함께):

1) 완료율 분석
   - 일일(오늘 모드) 또는 주간(이번 주 모드) 완료율: 완료 개수/전체 개수, 백분율.
   - 우선순위(high/medium/low)별 완료·미완료 패턴.
   - 이전 기간 대비 개선: 동일 스냅샷만 있으면 "목록만으로는 이전 기간과 직접 비교 불가" 한 문장.

2) 시간 관리 분석
   - 마감일(due_date) 준수 관점: 마감 지난 미완료, 임박 항목 비율·개수(가능하면 준수율·지연 위험 요약).
   - 연기: due_date 변경 이력이 없으면 "목록만으로는 연기 횟수 불가", 대신 마감을 넘긴 것처럼 보이는 항목은 마감일과 상태로 설명.
   - 시간대별 집중도: due_date의 시각(시)이 있으면 오전(0~11), 오후(12~17), 저녁(18~23)대별 개수·비율. 시각 없으면 날짜만 있는 항목은 시간대 미분류로 명시.

3) 생산성 패턴
   - 가장 생산적으로 보이는 요일·시간대: created_date/due_date로 추정 가능할 때만.
   - 자주 미루는 것처럼 보이는 유형: 제목·카테고리·우선순위·장기 미완료 등.
   - 완료하기 쉬웠을 법한 작업의 공통점: 완료된 항목의 짧은 제목·낮은 우선순위·카테고리 등.

4) 실행 가능한 추천
   - 구체적 시간 관리 팁(예: 마감 임박 N건은 오늘·내일 블록에 배치).
   - 우선순위 조정 및 일정 재배치 제안.
   - 업무 과부화 완화: 작업 쪼개기·위임·마감 재협상·WIP 제한 등 분산 전략 1~2개.

5) 긍정적 피드백
   - 잘하고 있는 점 1~2가지(완료한 일, 높은 우선순위 처리, 꾸준함 등).
   - 개선점은 비난 없이 격려 톤.
   - 짧은 동기부여 한 문장.

6) 기간별 차별화
   - 오늘 모드: 당일 집중 포인트, 남은 할 일 중 우선 처리 순서 제안.
   - 이번 주 모드: 주간 패턴 요약, 다음 주를 위한 계획 제안 1~2개.

7) 출력 문체
   - 자연스러운 한국어, 한 문장이 한 가지 메시지. 바로 실천 가능한 동사형으로.

출력은 반드시 JSON만. 다른 텍스트 금지.

필드:
- summary: 2~4문장. 핵심 수치·긍정 피드백·${periodLabel}에 맞는 한 줄 초점(오늘=당일 집중·남은 일 우선순위, 이번 주=주간 패턴·다음 주 힌트).
- urgentTasks: 긴급·높은 우선순위 또는 마감 임박으로 보이는 할 일 제목 문자열 배열 (최대 8개).
- insights: 문자열 배열 4~7개. 위 1~3, 6을 항목별로 나누되 중복 최소화.
- recommendations: 문자열 배열 3~6개. 위 4(실행 가능·분산 전략 포함)와 실천 연결.

할 일이 0개면 완료율은 0%로 두고, 부드러운 안내와 가벼운 격려만 한다.

데이터:
${JSON.stringify(payloadForModel, null, 0)}
`

    const { output } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
      output: Output.object({ schema: SummaryOutputSchema }),
    })

    return NextResponse.json({ ok: true, data: output, meta: { count: filtered.length, period } })
  } catch (err) {
    const message = err instanceof Error ? err.message : "요약 생성에 실패했어요."
    if (String(message).includes("429")) {
      return NextResponse.json(
        { ok: false, error: "요청 한도를 초과했어요. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      )
    }
    return NextResponse.json({ ok: false, error: "AI 요약 처리에 실패했어요. 잠시 후 다시 시도해주세요." }, { status: 500 })
  }
}
