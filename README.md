# Vivo — Videollamadas para eventos en vivo

Plataforma de videollamadas grupales para transmitir cualquier evento (bodas, graduaciones, cumpleaños, conferencias) a invitados que no pueden asistir. Diferenciadores:

- **Sin límite de tiempo** de transmisión.
- **Mute total controlado por el anfitrión**: los invitados entran en silencio (a nivel de servidor, no reversible desde el cliente) y el host habilita micrófonos individualmente.
- **Hasta 50 invitados por sesión.**

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS |
| Media (SFU) | LiveKit (`livekit-client`, `@livekit/components-react`) |
| Auth + DB + Realtime | Supabase (Google OAuth, anonymous sign-in, Postgres, Realtime) |
| Chat y reacciones | Supabase Realtime (Postgres Changes + Broadcast) |

## Configuración

### 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ejecuta [`supabase/schema.sql`](supabase/schema.sql) en el **SQL Editor**.
3. **Authentication → Sign In / Up**:
   - Activa **Google** (necesitas Client ID/Secret de [Google Cloud Console](https://console.cloud.google.com/apis/credentials); agrega `https://TU-PROYECTO.supabase.co/auth/v1/callback` como redirect URI autorizado).
   - Activa **Allow anonymous sign-ins** (modo invitado).
4. **Authentication → URL Configuration**: agrega `http://localhost:3000/**` (y tu dominio de producción) a las Redirect URLs.

### 2. LiveKit

- **Desarrollo**: crea un proyecto gratis en [cloud.livekit.io](https://cloud.livekit.io) y copia URL, API Key y Secret.
- **Producción**: self-hosted (Docker en Hetzner/DigitalOcean) para costo fijo y tiempo ilimitado — el código es idéntico, solo cambian las variables de entorno.

### 3. Variables de entorno

```bash
cp .env.example .env.local
# completa los valores de Supabase y LiveKit
```

### 4. Ejecutar

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Cómo funciona el mute absoluto

1. Al crear la sesión, el host marca **"Todos entran muteados"**.
2. El token JWT de LiveKit del invitado se emite **sin** el grant de publicar micrófono (`canPublishSources` excluye `MICROPHONE`). El SFU rechaza cualquier intento de publicar audio: no es un mute cosmético del cliente.
3. Desde el panel de participantes, el host pulsa **"Dar voz"** → el backend actualiza la DB y llama a `UpdateParticipant` en LiveKit → el invitado recibe el permiso en caliente y a partir de ahí controla su propio mute.
4. **"Silenciar"** revoca el grant: LiveKit despublica el micrófono automáticamente (mute duro).

## Estructura

```
supabase/schema.sql          Esquema completo (tablas, RLS, triggers, realtime)
src/lib/livekit.ts           Emisión de tokens y Server API de LiveKit
src/lib/supabase/            Clientes browser/server/admin
src/app/api/sessions         Crear sesiones (host)
src/app/api/join             Registro de participante + cupo de 50
src/app/api/token            Token LiveKit con permisos según rol/mute
src/app/api/host/control     Acciones del host (aprobar, dar voz, expulsar, finalizar)
src/app/dashboard            Dashboard del anfitrión
src/app/join/[code]          Auth dual → lobby con preview → sala de espera
src/app/room/[code]          Sala: grid adaptativo, pantalla, chat, reacciones, panel host
```
