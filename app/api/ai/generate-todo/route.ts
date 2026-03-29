import { NextResponse } from "next/server"
import { generateText, Output } from "ai"
import { google } from "@ai-sdk/google"
import { z } from "zod"

const InputSchema = z.object({
  input: z.string(),
})

const AiTodoSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.enum(["업무", "개인", "학습"]),
})

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 60_000

const rateMap = new Map<string, { count: number; resetAt: number }>()

function getClientKey(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("user-agent") ||
    "anonymous"
  )
}

function collapseSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim()
}

function sanitizeInput(raw: string) {
  const trimmed = raw.trim()

  // Remove common emoji ranges
  const noEmoji = trimmed.replace(
    /[\u{1F300}-\u{1FAFF}\u{1F100}-\u{1F1FF}\u{2600}-\u{27BF}]/gu,
    ""
  )

  // Replace disallowed characters with spaces
  // Keep Korean, English letters, numbers, whitespace, and common punctuation.
  const allowed = noEmoji.replace(
    /[^0-9A-Za-z\uAC00-\uD7A3\s.,!?~@#$%^&*()_\-+=\[\]{};:'"<>/\\|]/g,
    " "
  )

  // Normalize case for ASCII only
  const lowercased = allowed.replace(/[A-Z]/g, (c) => c.toLowerCase())

  return collapseSpaces(lowercased)
}

function isValidDueDateNotPast(due_date: string, todayYMD: string) {
  const due = new Date(`${due_date}T00:00:00`)
  const today = new Date(`${todayYMD}T00:00:00`)
  return due.getTime() >= today.getTime()
}

export async function POST(req: Request) {
  // Simple in-memory rate limiter (good enough for local/dev; resets on restart)
  const clientKey = getClientKey(req)
  const nowMs = Date.now()
  const rate = rateMap.get(clientKey)

  if (!rate || nowMs >= rate.resetAt) {
    rateMap.set(clientKey, { count: 1, resetAt: nowMs + RATE_LIMIT_WINDOW_MS })
  } else {
    if (rate.count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { ok: false, error: "요청 한도를 초과했어요. 잠시 후 다시 시도해주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil((rate.resetAt - nowMs) / 1000)) },
        }
      )
    }
    rateMap.set(clientKey, { ...rate, count: rate.count + 1 })
  }

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: "요청 바디를 읽지 못했어요." }, { status: 400 })
    }

    let parsed: z.infer<typeof InputSchema>
    try {
      parsed = InputSchema.parse(body)
    } catch {
      return NextResponse.json(
        { ok: false, error: "잘못된 입력입니다. 변환할 내용을 입력해주세요." },
        { status: 400 }
      )
    }

    // 1) 전처리
    const preprocessed = sanitizeInput(parsed.input)

    // 1) 입력 검증(전처리 이후)
    if (!preprocessed) {
      return NextResponse.json(
        { ok: false, error: "입력값이 비어있어요. 내용을 2자 이상 입력해주세요." },
        { status: 400 }
      )
    }
    if (preprocessed.length < 2) {
      return NextResponse.json({ ok: false, error: "입력은 최소 2자 이상이어야 합니다." }, { status: 400 })
    }
    if (preprocessed.length > 500) {
      return NextResponse.json({ ok: false, error: "입력은 최대 500자까지 가능합니다." }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "서버 환경변수 GOOGLE_GENERATIVE_AI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      )
    }

    const now = new Date()
    const todayYMD = now.toISOString().slice(0, 10)

    const prompt = `
너는 AI 할 일 변환기야.
사용자의 자연어를 보고 todos 테이블에 들어갈 구조화 데이터로 변환해.

현재 날짜(참고, 오늘=포함): ${todayYMD}

### 날짜 처리 규칙(due_date)
- "오늘" -> 현재 날짜
- "내일" -> 현재 날짜 + 1일
- "모레" -> 현재 날짜 + 2일
- "이번주 금요일" -> 이번 주에서 가장 가까운(가장 먼저 오는) 금요일 날짜
  - 만약 오늘이 금요일이면 due_date는 오늘로 둬.
- "다음주 월요일" -> 다음 주의 가장 가까운(가장 먼저 오는) 월요일 날짜
  - 만약 오늘이 월요일이면 due_date는 '다음주 월요일'로 둬(즉, 7일 뒤).

### 시간 처리 규칙(due_time)
- "아침" -> 09:00
- "점심" -> 12:00
- "오후" -> 14:00
- "저녁" -> 18:00
- "밤" -> 21:00
- 시간이 명시되지 않으면 due_time은 무조건 "09:00"

### 우선순위 규칙(priority)
- high: "급하게", "중요한", "빨리", "꼭", "반드시" 중 하나라도 포함되면 high
- medium: "보통", "적당히" 포함되면 medium (그리고 high 키워드가 없을 때)
- low: "여유롭게", "천천히", "언젠가" 포함되면 low (그리고 high/medium 키워드가 없을 때)
- 위 키워드가 없으면 medium

### 카테고리 규칙(category)
todos 스키마의 category는 반드시 아래 3가지 중 하나로만 출력해:
- "업무" | "개인" | "학습"

키워드 기반 분류:
- 업무: "회의", "보고서", "프로젝트", "업무"
- 개인: "쇼핑", "친구", "가족", "개인"
- 건강: "운동", "병원", "건강", "요가"
- 학습: "공부", "책", "강의", "학습"

중요: "건강" 키워드는 todos의 허용 category에 맞추기 위해 출력 category를 "개인"으로 매핑해.

### 출력 형식
- 반드시 JSON만 출력해 (다른 텍스트/설명/마크다운 금지)
- JSON은 AiTodoSchema와 1:1로 일치해야 함
- due_date는 YYYY-MM-DD
- due_time는 HH:mm (시간이 없으면 09:00)
`

    const { output } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: `${prompt}\n\n사용자 입력: ${preprocessed}`,
      output: Output.object({
        schema: AiTodoSchema,
      }),
    })

    // 3) 후처리(안정성/제약 준수)
    let title = (output.title ?? "").trim()
    if (title.length < 2) title = "새 할 일"
    if (title.length > 80) title = `${title.slice(0, 80)}...`

    const due_time = output.due_time?.match(/^\d{2}:\d{2}$/) ? output.due_time : "09:00"
    const due_date = isValidDueDateNotPast(output.due_date, todayYMD) ? output.due_date : todayYMD

    const descriptionText =
      output.description === null || output.description === undefined ? null : output.description.trim()
    const description = descriptionText && descriptionText.length > 0 ? descriptionText : null

    const priority = output.priority ?? "medium"
    const category = output.category ?? "업무"

    return NextResponse.json({
      ok: true,
      data: {
        title,
        description,
        due_date,
        due_time,
        priority,
        category,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 요청을 처리하지 못했어요."

    // Best-effort 429 detection
    if (String(message).includes("429")) {
      return NextResponse.json(
        { ok: false, error: "요청 한도를 초과했어요. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { ok: false, error: "AI 처리 실패: 잠시 후 다시 시도해주세요." },
      { status: 500 }
    )
  }
}

