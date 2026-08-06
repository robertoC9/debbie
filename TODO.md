# TODO - Registro de usuarios, login, conversaciones

## Pasos
- [x] Análisis del proyecto y revisión de archivos
- [x] Crear tablas en PostgreSQL (users, messages)
- [x] Instalar dependencias: pg, bcrypt, jsonwebtoken, cookie-parser
- [x] Agregar DATABASE_URL al `.env`
- [x] Actualizar `server.js` (conexión BD, register, login, messages)
- [x] Arreglar "Error de conexión" (se eliminó la dependencia del correo SMTP)
- [x] Evitar registros falsos (validación de correo, bloqueo de dominios temporales, verificación MX, rate limiting, honeypot)
- [x] Implementar sesión persistente (cookie httpOnly + JWT) en registro y login
- [x] Restaurar sesión al navegar (`/api/me`)
- [x] Logout con `/api/logout`
- [x] Actualizar `index.html` (modal registro/login, honeypot, conversaciones)
- [x] Actualizar `script.js` (registro con auto-login, login, sesión, mensajes, cookies)
- [x] Actualizar `style.css`
- [x] Probar el flujo completo (registro, login, sesión, honeypot)

## Decisiones de diseño
- El registro ya **no requiere confirmación por correo**: la cuenta se crea y se inicia
  sesión automáticamente de forma inmediata.
- Se eliminó la dependencia de Gmail/nodemailer (causaba el "Error de conexión"
  por credenciales SMTP o certificados TLS).
- Para impedir registros falsos:
  - Validación de formato de correo.
  - Bloqueo de dominios de correo desechables/temporales.
  - Verificación de registros MX del dominio (correo entregable real).
  - Rate limiting por IP (5 intentos fallidos por 10 min).
  - Campo honeypot oculto (`website`) que los bots rellenan y los humanos no.

## Nota
- El `.env` actual solo contiene `PORT` y `DATABASE_URL`. Ya no se necesitan
  `EMAIL_USER`, `EMAIL_PASS` ni `ALLOW_UNVERIFIED`.

# TODO - Reorganización frontend/backend

## Pasos
- [x] Crear carpeta `frontend/`
- [x] Mover `index.html`, `script.js`, `style.css`, `assets/`, `debora-logo.png`, `hero-video.mp4` a `frontend/`
- [x] Actualizar `server.js` para servir estáticos desde `frontend/` y añadir catch-all
- [x] Probar que el blog carga correctamente desde `http://localhost:3000`

