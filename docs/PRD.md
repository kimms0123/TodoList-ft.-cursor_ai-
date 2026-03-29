# PRD.md
## AI 기반 Todo Manager 제품 요구사항 정의서

### 1. 개요
- 제품명: AI Todo Manager
- 목적: 사용자의 할 일을 효율적으로 관리하고 AI를 통해 자동 생성 및 분석 기능 제공
- 작성일: 2026-03-20

---

## 2. 주요 기능

### 2.1 인증 기능
- Supabase Auth 기반 이메일/비밀번호 회원가입 및 로그인
- JWT 기반 세션 관리
- 비밀번호 재설정 기능

---

### 2.2 할 일 관리 (CRUD)
- Create: 새로운 할 일 생성
- Read: 할 일 목록 조회
- Update: 할 일 수정
- Delete: 할 일 삭제

#### 필드 정의
| 필드명 | 타입 | 설명 |
|--------|------|------|
| id | uuid | 할 일 고유 ID |
| user_id | uuid | 사용자 ID |
| title | string | 제목 |
| description | text | 설명 |
| created_at | timestamp | 생성일 |
| due_date | timestamp | 마감일 |
| priority | enum | high / medium / low |
| category | string | 업무 / 개인 / 학습 등 |
| completed | boolean | 완료 여부 |

---

### 2.3 검색 / 필터 / 정렬

#### 검색
- title, description 기반 검색

#### 필터
- 우선순위: high / medium / low
- 카테고리: 업무 / 개인 / 학습
- 상태:
  - 진행 중
  - 완료
  - 지연 (due_date < now && completed = false)

#### 정렬
- 우선순위순
- 마감일순
- 생성일순

---

### 2.4 AI 할 일 생성

#### 기능 설명
- 자연어 입력을 구조화된 Todo 데이터로 변환

#### 입력 예
"내일 오전 10시에 팀 회의 준비"

#### 출력 예
{
  "title": "팀 회의 준비",
  "description": "내일 오전 10시에 있을 팀 회의를 위해 자료 준비",
  "created_at": "YYYY-MM-DD HH:MM",
  "due_date": "YYYY-MM-DD 10:00",
  "priority": "high",
  "category": "업무",
  "completed": false
}

#### 처리 흐름
1. 사용자 입력
2. Gemini API 호출
3. JSON 파싱
4. DB 저장

---

### 2.5 AI 요약 및 분석

#### 일일 요약
- 완료된 작업 수
- 남은 작업
- 오늘 마감 예정 작업

#### 주간 요약
- 완료율 (%)
- 카테고리별 작업 분포
- 미완료 작업 분석

---

## 3. 화면 구성

### 3.1 로그인 / 회원가입
- 이메일 입력
- 비밀번호 입력
- 회원가입 / 로그인 버튼

---

### 3.2 메인 화면
- 할 일 목록
- 할 일 추가 버튼
- 검색창
- 필터 UI (드롭다운)
- 정렬 옵션
- AI 요약 버튼

---

### 3.3 확장 기능 (통계 화면)
- 주간 완료율 그래프
- 카테고리별 비율 차트
- 작업 추세 분석

---

## 4. 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js |
| UI | Tailwind CSS, shadcn/ui |
| Backend | Supabase |
| Auth | Supabase Auth |
| Database | PostgreSQL (Supabase) |
| AI | Google Gemini API |

---

## 5. 데이터 구조

### users
- Supabase Auth 기본 테이블 사용

### todos
| 필드명 | 타입 |
|--------|------|
| id | uuid |
| user_id | uuid |
| title | text |
| description | text |
| created_at | timestamp |
| due_date | timestamp |
| priority | text |
| category | text |
| completed | boolean |

---

## 6. API 설계

### Todo API
- GET /todos
- POST /todos
- PUT /todos/:id
- DELETE /todos/:id

### AI API
- POST /ai/generate-todo
- POST /ai/summary

---

## 7. 비기능 요구사항
- 응답 속도: 1초 이내
- 모바일 반응형 UI
- 보안: JWT 인증, HTTPS

---

## 8. 향후 확장
- 캘린더 연동
- 알림 기능 (푸시)
- 협업 기능
