# TODO - Hacer funcional la base de datos en Netlify

## Pasos
- [x] Análisis del proyecto y revisión de archivos
- [x] Decidir estrategia de autenticación (JWT en header Authorization)
- [x] Crear tablas SQL en Postgres en la nube (users, messages) — confirmado por el usuario (se ven columnas)
- [x] Crear helper compartido de Netlify Functions (conexión BD, JWT, validaciones)
- [x] Crear funciones Netlify: register, login, me, logout, messages
- [x] Actualizar `netlify.toml` (functions + redirects /api/*)
- [x] Actualizar `frontend/script.js` (token JWT en headers, localStorage)
- [ ] Configurar variables de entorno en Netlify (DATABASE_URL, JWT_SECRET)
- [ ] Desplegar el sitio en Netlify
- [ ] Probar el flujo completo tras el deploy

## Correcciones de calidad y seguridad (Opción A)
- [x] Eliminar `.env.example` (disparaba el secrets scanning de Netlify por el valor de PORT)
- [x] Ajustar `server.js` para que PORT no dispare el secrets scanning
- [x] Añadir `SECRETS_SCAN_OMIT_KEYS` en `netlify.toml` para DATABASE_URL/JWT_SECRET/PORT (no hay valores hardcodeados en el repo, era un falso positivo)
- [x] Corregir CORS en `_shared.js` (Access-Control-Allow-Origin + Credentials incompatibles)
- [x] Hacer que `JWT_SECRET` falle explícitamente si falta en producción
- [x] Límites máximos de longitud en `register.js` (name, password)
- [x] Límite de longitud en `messages.js` (content)

## SQL para crear las tablas
Correr en la consola SQL de Supabase/Neon:

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Variables de entorno en Netlify
- `DATABASE_URL` = connection string de Supabase/Neon
- `JWT_SECRET` = clave secreta aleatoria larga
