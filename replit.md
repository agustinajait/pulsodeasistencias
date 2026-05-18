# CPI Norte · Sistema Integral de Asistencia

Sistema de gestión de asistencia para el centro de primera infancia CPI Norte (Buenos Aires). Maneja asistencia diaria, contactos familiares (llamados), alertas por ausencias consecutivas, registro/egreso de niños y tablero de administración.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (puerto 5000 → proxy en /api)
- `pnpm --filter @workspace/cpi-sistema run dev` — Frontend React+Vite
- `pnpm run typecheck` — typecheck completo de todos los paquetes
- `pnpm run build` — typecheck + build de todos los paquetes
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks y esquemas Zod desde spec OpenAPI
- `pnpm --filter @workspace/db run push` — aplicar cambios de esquema DB (solo dev)
- `pnpm --filter @workspace/scripts run seed` — poblar la DB desde el HTML original
- Required env: `DATABASE_URL` — cadena de conexión Postgres

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validación: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (desde spec OpenAPI)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Tailwind + shadcn/ui

## Where things live

- `lib/db/src/schema/index.ts` — esquema de la DB (rooms, children, attendance, contacts)
- `lib/api-spec/openapi.yaml` — spec OpenAPI (fuente de verdad del contrato)
- `lib/api-client-react/src/generated/` — hooks y tipos generados por Orval
- `artifacts/api-server/src/routes/` — rutas Express (rooms, children, attendance, contacts, dashboard)
- `artifacts/cpi-sistema/src/pages/` — páginas React (login, sala, admin)
- `artifacts/cpi-sistema/src/components/child-sheet.tsx` — modal de ficha de niño
- `artifacts/cpi-sistema/src/lib/auth-context.tsx` — contexto de auth (rol + ecoNumber)
- `scripts/src/seed.ts` — seed desde HTML original (NINOS_RAW)

## Architecture decisions

- **Multi-centro**: tabla `centers` con FK en `rooms`. El login tiene 2 pasos: selector de centro → selector de rol. El auth-context guarda `centerId` en localStorage.
- El auth-context expone `ecoNumber` (0–3) en lugar de roomId hardcodeado; la sala page resuelve el roomId real buscando en la lista de rooms por ecoNumber. Esto es robusto ante re-seeds.
- Rooms: ECO 0 (cap 30), ECO 1 (cap 55), ECO 2 (cap 60), ECO 3 (cap 35). IDs actuales: 5–8, todos bajo centerId=1 ("CPI Norte").
- La seed filtra contactos con fecha vacía o mal formateada antes de insertar.
- El frontend usa hooks generados por Orval (`useListChildren`, `useMarkAttendance`, `useListCenters`, etc.) — nunca `fetch` directo.
- Color de marca: verde #1C6E44. Sin emojis en la UI.
- El admin panel tiene barra de filtro por centro en el header y panel "Gestionar" para crear centros y salas.
- La nómina del admin filtra por sala (roomId) con un selector inline.

## Product

- **Login**: selector de rol (Sala ECO 0–3 para docentes, Administración para coordinación)
- **Sala**: lista de niños con toggle P/A, motivo de ausencia, mercadería, calendario mensual, ficha de niño, registro de llamados
- **Admin**: tablero resumen, alertas por ausencias consecutivas, nómina, asistencia por sala, vacantes, egresos

## User preferences

- Sin emojis en la UI
- Color primario: verde #1C6E44
- Idioma: español argentino

## Gotchas

- Siempre correr `pnpm --filter @workspace/api-spec run codegen` después de editar `openapi.yaml`
- El seed puede correr varias veces sin limpiar — los rooms se duplican. Limpiar con `DELETE FROM rooms WHERE id NOT IN (SELECT MIN(id) FROM rooms GROUP BY eco_number)` antes de re-seedear si hay duplicados.
- `__dirname` en scripts tsx necesita `fileURLToPath(import.meta.url)` ya que son ESM.

## Pointers

- Ver skill `pnpm-workspace` para estructura del workspace, TypeScript y detalles de paquetes
