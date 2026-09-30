# 📦 Nexus360 - Gestão Integrada de Estoque

O **Nexus360** é um sistema web moderno e completo para a gestão inteligente de estoques, operações logísticas e controle de validades. Projetado sob medida para o varejo (com foco em supermercados), o sistema oferece uma visão unificada da rede (Lojas e Centros de Distribuição) e aplica automaticamente regras avançadas como o **FEFO (First Expired, First Out)**.

## ✨ Principais Módulos

O projeto é estruturado em 10 módulos essenciais:

1. **Dashboard:** Painel principal com KPIs de valor em estoque, itens críticos, em risco e alertas operacionais automáticos.
2. **Produtos:** Catálogo/Base completo com cadastro de SKU, EAN, Margem de Lucro, Fornecedores e Estoques Mínimos/Máximos.
3. **Visão de Estoque:** Controle de saldos consolidados e detalhados fisicamente por cada Centro de Distribuição e Lojas.
4. **Controle de Lotes e Validades:** Gestão de rastreabilidade (Produto → Lote → NF) e classificação visual de risco de vencimento (Normal, Atenção, Crítico, Vencido). *Lotes vencidos são bloqueados para venda/transferência automaticamente.*
5. **Entradas:** Recebimento físico de mercadorias atrelado a Nota Fiscal, Fornecedor e Lote, atualizando automaticamente os saldos e custos.
6. **Saídas (FEFO):** Baixas inteligentes que priorizam *automaticamente* o lote com validade mais próxima para minimizar perdas.
7. **CDs e Lojas (Unidades):** Gestão hierárquica das unidades logísticas da empresa.
8. **Transferências:** Movimentação rastreável de mercadorias entre a rede.
9. **Fornecedores e Reposição:** Cérebro matemático do sistema que analisa saldos abaixo do mínimo e sugere a melhor ação: Transferir de uma loja com excesso ou Comprar do Fornecedor.
10. **Relatórios:** Dashboards analíticos de Curva ABC, volume de movimentações, giro e registro de histórico detalhado por lote.

---

## 🚀 Tecnologias Utilizadas

- **Frontend:** [Next.js 14](https://nextjs.org/) (App Router), React, Tailwind CSS, Lucide Icons.
- **Backend/Database:** [Supabase](https://supabase.com/) (PostgreSQL avançado, RPCs Customizados, Triggers e Row Level Security).
- **Autenticação:** Supabase Auth com gerenciamento nativo de Sessão.
- **Linguagem:** TypeScript.

---

## ⚙️ Como Rodar o Projeto Localmente

### 1. Pré-requisitos
Antes de começar, você precisará ter instalado em sua máquina:
- [Node.js](https://nodejs.org/en/) (versão 18 ou superior)
- [Git](https://git-scm.com/)
- Uma conta ativa no [Supabase](https://supabase.com) (O plano gratuito atende perfeitamente).

### 2. Configuração do Banco de Dados (Supabase)
O coração da lógica do Nexus360 vive no banco de dados.
1. Crie um novo projeto no painel do Supabase.
2. Instale o Supabase CLI no seu terminal: `npm install -g supabase`
3. Faça o login na sua conta: `npx supabase login`
4. Conecte sua máquina ao projeto do Supabase: `npx supabase link --project-ref ID_DO_SEU_PROJETO`
5. Empurre toda a estrutura de tabelas, funções (FEFO) e permissões de segurança rodando:
   ```bash
   npx supabase db push
   ```

### 3. Configuração das Variáveis de Ambiente
Na raiz do projeto, crie um arquivo chamado `.env.local` e preencha com as chaves fornecidas no painel do seu projeto Supabase (em *Project Settings > API*):

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-longa-aqui
```

### 4. Instalando e Rodando o Projeto
Abra o terminal na pasta do projeto e execute:

```bash
# Instalar as dependências do pacote
npm install

# Iniciar o servidor de desenvolvimento
npm run dev
```
Após isso, abra seu navegador em `http://localhost:3000`.

---

## 🛡️ Usuários e Permissões de Segurança

O sistema possui uma camada de segurança fortíssima com RLS (Row Level Security) que blinda as tabelas com base no cargo do usuário logado:

- **Administrador:** Acesso a todas as telas, incluindo a gestão de funcionários (`/usuarios`), exclusão de registros e alteração de níveis de acesso.
- **Gestor de Estoque:** Pode gerenciar movimentações completas, transferências e criar reposições.
- **Gerente de Loja:** Acesso focado em aprovações e visualização de saldos de sua respectiva base.
- **Operador:** Restrito a alimentar o sistema (dar entradas e saídas físicas) e consultar estoques.

### 🔑 Primeiro Acesso
Após rodar as migrações (`db push`), uma conta mestre será automaticamente criada na sua base para você entrar no sistema sem precisar se registrar:

- **Email:** `admin@admin.com`
- **Senha:** `admin123`

*(Recomenda-se alterar esta senha na primeira utilização real em produção).*

---

Desenvolvido para revolucionar o controle de estoque do seu negócio. 🚀
