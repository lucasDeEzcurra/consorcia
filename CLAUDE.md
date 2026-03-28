# CLAUDE.md

Antes de cualquier tarea, leé INSTRUCTIONS.md que tiene la spec completa del producto con entidades, reglas de negocio, flujos de Telegram, estructura de reportes y prioridades.

## Stack

- **Framework**: Vite + React 18
- **Language**: TypeScript (strict mode)
- **Routing**: React Router v7
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (auth, database, storage, edge functions)
- **AI**: Claude API
- **PDF Reports**: HTML → PDF
- **Email**: Resend

## Project Structure

```
src/pages/        → Páginas/rutas
src/components/   → Componentes de UI
src/lib/          → Utilidades, Supabase client, auth context
src/types/        → Tipos TypeScript
supabase/migrations/ → Migraciones SQL
```

## Naming Conventions

- `camelCase` para variables y funciones
- `PascalCase` para componentes React
- `snake_case` para tablas y columnas de base de datos

## Product Context

App para administradoras de consorcios/edificios en Argentina.

**Jerarquía de datos**: Administración → Supervisores → Edificios → Propietarios

**Flujo principal**: Los supervisores envían fotos de arreglos por Telegram, se guardan organizadas por edificio, y a fin de mes se genera un reporte PDF que se envía por email a los propietarios.

## Code Conventions

- TypeScript strict siempre
- Componentes funcionales con hooks
- Supabase client-side con `@supabase/supabase-js`

## Visual Style

- Minimalista y profesional
- Tipografía distintiva — NO usar Inter, Arial ni Roboto
- shadcn/ui como base pero con personalidad propia
