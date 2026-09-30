# Configuração Inicial - Nexus360 (Vercel + Supabase)

Write-Host "Iniciando configuração do projeto Nexus360..." -ForegroundColor Green

# Verifica se o Node.js está instalado
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: Node.js não encontrado. Por favor, instale o Node.js (https://nodejs.org) e tente novamente." -ForegroundColor Red
    exit
}

# Inicializa Next.js se a pasta src não existir
if (!(Test-Path "src")) {
    Write-Host "Criando aplicativo Next.js..." -ForegroundColor Yellow
    npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
}

Write-Host "Instalando dependências (Supabase, Zod, Hook Form, Lucide)..." -ForegroundColor Yellow
npm install @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers lucide-react class-variance-authority clsx tailwind-merge tailwindcss-animate

Write-Host "Inicializando shadcn/ui..." -ForegroundColor Yellow
npx shadcn-ui@latest init --yes

Write-Host "Inicializando projeto Supabase local..." -ForegroundColor Yellow
npx supabase init

Write-Host "Configuração finalizada com sucesso!" -ForegroundColor Green
Write-Host "Próximos passos:"
Write-Host "1. Execute 'npx supabase start' para iniciar o banco local."
Write-Host "2. Execute 'npx supabase db push' ou aplique as migrations manualmente."
Write-Host "3. Execute 'npm run dev' para iniciar a interface local."
