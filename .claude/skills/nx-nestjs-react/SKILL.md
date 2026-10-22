---
name: nx-nestjs-react
description: Conventions and verified workflows for full-stack TypeScript in an Nx monorepo: NestJS + Prisma backend, React frontend, Jest tests. Use whenever generating, editing, or reviewing code in this stack — modules, controllers, services, Prisma schema/migrations, React components/hooks, Nx libs or affected commands, or tests — even if the user doesn't name the framework.
---

# Nx + NestJS + Prisma + React

Opinionated conventions for this stack. Follow them by default; the repo's own CLAUDE.md or existing code style wins on conflict. Every non-trivial change ends with the verification step at the bottom — code that hasn't passed `nx affected -t lint test build` isn't done.

## Stack contract

Nx integrated monorepo · NestJS apps under `apps/` · React apps under `apps/` · shared code in `libs/` · Prisma as the ORM · Jest everywhere (unit + e2e) · strict TypeScript (`strict`, `noUncheckedIndexedAccess`) · `class-validator` DTOs at the HTTP boundary.

## Nx workspace rules

- Generate, don't hand-create: `nx g @nx/nest:app`, `nx g @nx/react:app`, `nx g @nx/js:lib`, `nx g @nx/react:lib`. Generators keep project.json, tsconfig paths, and jest config consistent. Preview with `--dry-run` when unsure.
- Organize `libs/` by domain (business capability), not technical layer. Keep apps thin — logic lives in libs.
- Tag every project (`type:app|feature|ui|data-access|util`, `scope:api|web|shared`) and enforce with `@nx/enforce-module-boundaries` in ESLint: apps depend on libs, never on other apps; `scope:api` and `scope:web` may only share `scope:shared`. Boundaries are what keep a monorepo from becoming a monolith.
- Run work through `nx affected -t <targets>` locally and in CI, never blanket `run-many`, so caching does its job.
- Diagnose surprises with `nx graph` (dependency issues, unexpected rebuilds) before changing config.
- Verify after structural changes: `nx show projects` lists the new project; `nx run <project>:build` succeeds.

## NestJS backend

- One module per domain; import feature modules into `AppModule`. Export a service only when another module needs it. Never `new` a service — constructor injection everywhere.
- Cross-module cycles are a design smell: restructure or extract a shared lib; `forwardRef()` is a last resort, not a pattern.
- HTTP boundary: DTO classes with `class-validator` decorators for every request body/query; `ValidationPipe` global with `{ whitelist: true, transform: true }`. Never pass a raw body into a service. Response DTOs (or serializer interceptors) keep entities — and fields like password hashes — out of responses.
- Services throw typed HTTP exceptions (`NotFoundException`, `ConflictException`, …); let Nest's exception filter shape the response. Never leak stack traces or internal errors to clients.
- All config through `ConfigModule` with a validated schema; no hardcoded hosts, ports, or secrets.
- Document endpoints with Swagger decorators (`@ApiTags`, `@ApiOkResponse`, …) as you write them, not after.

### Prisma

- One `PrismaService` extending `PrismaClient` (with `onModuleInit` → `$connect`), provided by a global `PrismaModule` in a shared data-access lib. Inject it; never instantiate `PrismaClient` per-service.
- Schema lives in one place (e.g. `libs/data-access/prisma/schema.prisma`); wire `prisma generate` into the lib's build or a postinstall so the client is never stale.
- Migrations: `prisma migrate dev --name <change>` locally, `prisma migrate deploy` in CI/prod. Never edit applied migrations; never `db push` outside throwaway prototypes.
- Multi-step writes that must be atomic go through `this.prisma.$transaction(async (tx) => …)` and every step uses `tx`, not `this.prisma` — a step outside the transaction silently breaks atomicity.
- Handle known error codes explicitly: catch `PrismaClientKnownRequestError` and map `P2002` (unique violation) → `ConflictException`, `P2025` (not found) → `NotFoundException`. Prefer this over pre-checking with a read, which races.
- Avoid N+1: use `include`/`select` for what the endpoint needs; select narrowly rather than returning whole rows.

## React frontend

- Function components + hooks; TypeScript strict; named exports; colocate component, test, and styles.
- Server state belongs to TanStack Query (cache keys per resource, invalidate on mutation); client state stays local or in a small store — don't mirror server data into global state.
- Share API request/response types between web and api through a `libs/shared/*` lib so the compiler catches contract drift — this is the main payoff of the monorepo; never retype an API shape by hand in the frontend.
- Stable unique `key` props (never array index for dynamic lists); every effect that subscribes/allocates returns a cleanup; error boundaries around feature roots; Suspense for async UI.
- Memoize (`memo`, `useMemo`, `useCallback`) only where a measured re-render problem exists or when passing callbacks/objects to memoized children — reflexive memoization is noise.
- Accessibility is not optional: semantic HTML first, ARIA where semantics fall short, keyboard focus visible.

## Jest testing

- Arrange–Act–Assert; test behavior, not implementation details.
- NestJS unit tests: `Test.createTestingModule` with `PrismaService` replaced by a mock (`{ provide: PrismaService, useValue: mockDeep<PrismaClient>() }` via jest-mock-extended, or a hand-rolled object). Assert both the happy path and the mapped error (e.g. P2002 → ConflictException).
- NestJS e2e: supertest against the compiled app with a real test database (dockerized Postgres or SQLite where the schema allows); reset state between tests. One e2e suite per API module.
- React: React Testing Library — query by role/label the way a user would; no snapshot-only tests for logic.
- New behavior lands with its tests in the same change. For bug fixes, write the failing test first — it proves the fix and pins the regression.

## Verification (always, before declaring done)

```bash
nx affected -t lint test build
```

plus `nx affected -t typecheck` if the workspace defines it, and `prisma migrate dev` has been run after any schema change. If an affected project fails that you didn't touch, check `nx graph --focused=<project>` before assuming the failure is unrelated.

## Must not

- `any` (or `as` casts to silence errors) without a comment justifying it
- Raw `req.body`/unvalidated input reaching a service
- Secrets, connection strings, or per-env values in source
- Cross-app imports or lib imports that violate module-boundary tags
- Editing generated Prisma client code or applied migrations
- Skipping the verification step because "it's a small change"
