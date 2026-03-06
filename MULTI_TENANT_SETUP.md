# Fiscal Flow - Multi-tenant Setup

## Visão da arquitetura

```
Account (escritório contábil)
├── Users (contadores/usuários)
├── Clients (empresas dos clientes)
│   ├── NfeRecords (notas fiscais)
│   └── PrestacaoIncluida (checkboxes de prestação)
```

## Pré-requisitos

- Node.js 20+
- Docker (para PostgreSQL) ou PostgreSQL instalado

## Configuração do banco

### Opção 1: Docker (recomendado)

```bash
docker compose up -d
```

O PostgreSQL sobe na porta **5454** (evita conflito com instalação local).

### Opção 2: PostgreSQL local

Crie o banco `fiscal_flow` e ajuste o `.env`:

```
DATABASE_URL="postgresql://usuario:senha@localhost:5432/fiscal_flow"
```

## Comandos

```bash
# Gerar Prisma Client
npm run db:generate

# Aplicar migrações
npm run db:migrate

# Push do schema (sem migração)
npm run db:push

# Popular dados iniciais
npm run db:seed

# Interface do banco
npm run db:studio
```

## Primeiro acesso

Após o seed:

- **E-mail:** admin@fiscalflow.com
- **Senha:** fiscalflow123

## Status da implementação

### ✅ Concluído

- [x] Schema Prisma (Account, User, Client, NfeRecord, PrestacaoIncluida)
- [x] Login com banco de dados (bcrypt)
- [x] JWT com accountId e userId
- [x] API GET/POST /api/clients
- [x] ClientProvider + ClientSelector
- [x] Seletor de cliente na topbar
- [x] Página Empresas – listagem e cadastro de clientes

### 🔄 Próximos passos (roadmap)

1. **Persistência de notas** – salvar XMLs importados em `NfeRecord` por `clientId`
2. **Persistência de prestação** – gravar `PrestacaoIncluida` por cliente
5. **Tela de configurações** – dados do escritório
6. **Dashboard consolidado** – visão de todos os clientes do account

## Modelo de dados

| Tabela | Descrição |
|--------|-----------|
| Account | Escritório contábil (tenant) |
| User | Usuários do escritório |
| Client | Empresas/clientes do contador |
| NfeRecord | Notas fiscais (por cliente) |
| PrestacaoIncluida | Notas incluídas na prestação |

## Segurança multi-tenant

Todas as queries devem filtrar por `accountId` do usuário logado. Nunca retornar dados de outro account.
