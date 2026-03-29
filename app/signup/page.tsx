"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"

export default function SignupPage() {
  const router = useRouter()

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  const validateForm = () => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim()
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!trimmedName) return "이름을 입력해주세요."
    if (!emailPattern.test(trimmedEmail)) return "올바른 이메일 형식을 입력해주세요."
    if (password.length < 8) return "비밀번호는 최소 8자 이상이어야 합니다."
    if (password !== confirmPassword) return "비밀번호 확인이 일치하지 않습니다."
    return null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (isSubmitting) return

    setErrorMessage(null)
    setSuccessMessage(null)

    const validationError = validateForm()
    if (validationError) {
      setErrorMessage(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      })

      if (error) {
        if (error.message.includes("already registered")) {
          setErrorMessage("이미 가입된 이메일입니다. 로그인 페이지를 이용해주세요.")
          return
        }
        setErrorMessage("회원가입에 실패했어요. 잠시 후 다시 시도해주세요.")
        return
      }

      if (data.session) {
        router.push("/")
        router.refresh()
        return
      }

      setSuccessMessage("회원가입이 완료되었습니다. 이메일 인증 후 로그인해주세요.")
    } catch {
      setErrorMessage("Supabase 환경 변수를 확인해주세요. 설정 후 다시 시도해주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserPlus className="size-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">AI Todo Manager 회원가입</CardTitle>
            <CardDescription>
              이메일로 계정을 만들고 AI 기반 Todo 관리를 시작하세요.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {errorMessage ? (
              <Alert variant="destructive">
                <AlertTitle>회원가입 오류</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            ) : null}
            {successMessage ? (
              <Alert>
                <AlertTitle>안내</AlertTitle>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="홍길동"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="비밀번호를 입력하세요"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                minLength={8}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Spinner className="mr-2" /> : null}
              {isSubmitting ? "가입 처리 중..." : "회원가입"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            이미 계정이 있나요?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              로그인
            </Link>
          </p>
        </CardFooter>
      </Card>
    </main>
  )
}
