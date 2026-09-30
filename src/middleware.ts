import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Repassamos o caminho atual para o layout.tsx conseguir ler
  supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname)

  const hasAuthCookie = request.cookies.getAll().some(c => c.name.includes('-auth-token'))
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  // Se não tem cookie e tenta acessar área protegida, chuta pro login
  if (!hasAuthCookie && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
