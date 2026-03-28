# CLAUDE.md

## Stack

- **Framework**: Next.js 14 App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Supabase (auth, database, storage, edge functions)
- **AI**: Claude API
- **PDF Reports**: React-PDF
- **Email**: Resend

## Project Structure

```
src/app/          → Rutas y páginas (App Router)
src/components/   → Componentes de UI
src/lib/          → Utilidades y Supabase client
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

**Flujo principal**: Los supervisores envían fotos de arreglos por WhatsApp, se guardan organizadas por edificio, y a fin de mes se genera un reporte PDF que se envía por email a los propietarios.

## Code Conventions

- TypeScript strict siempre
- Server Components por defecto; usar `'use client'` solo cuando sea necesario
- Preferir server actions y data fetching en server components

## Visual Style

- Minimalista y profesional
- Tipografía distintiva — NO usar Inter, Arial ni Roboto
- shadcn/ui como base pero con personalidad propia
