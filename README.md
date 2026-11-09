# A medias

Web para llevar los gastos comunes de Elena y Nacho sin cuenta conjunta. Cada uno paga cuando le toca y la app dice quién va por delante y quién debería pagar lo siguiente para igualar.

- **Frontend:** HTML, CSS y JavaScript sin dependencias de compilación, en `app/`.
- **Backend:** [Supabase](https://supabase.com) (Postgres, acceso con enlace por email y tiempo real).
- **Publicación:** GitHub Pages, automática con cada push a `main`.

## Cómo funciona el reparto

Todos los gastos se reparten al 50 %. La app suma lo que ha pagado cada uno desde el principio. Quien ha pagado menos es a quien le toca pagar el siguiente gasto, y el formulario lo propone como pagador. Por debajo de 0,50 € de diferencia se considera empate.

## Puesta en marcha

### 1. Crear el proyecto en Supabase

1. Entra en [supabase.com](https://supabase.com), crea una cuenta gratuita y un proyecto nuevo. Elige la región **West EU (Ireland)** o la más cercana.
2. Ve a **SQL Editor**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecútalo.
3. En el mismo editor, añade vuestros dos emails. No guardes este paso en el repositorio:
   ```sql
   insert into public.miembros (email) values ('email-de-elena@ejemplo.com'), ('email-de-nacho@ejemplo.com');
   ```

### 2. Acceso

No hace falta invitar a nadie. Cada uno entra en la web, escribe su email y recibe un enlace. Solo los emails de la tabla `miembros` pueden ver y apuntar gastos; cualquier otro ve un aviso de que no tiene acceso.

### 3. Configurar el acceso por email

En **Authentication > URL Configuration**:

- **Site URL:** `https://elenaraga.github.io/a-medias/`
- **Redirect URLs:** si quieres probar en local, añade `http://localhost:8000/`.

### 4. Conectar la web

En **Project Settings > API**, copia la **Project URL** y la clave **anon public** en [`app/config.js`](app/config.js). Las dos pueden ser públicas: los datos están protegidos por el login y por las reglas de seguridad de la base de datos, que solo dejan leer y escribir a los emails de la tabla `miembros`.

### 5. Publicar

En el repositorio de GitHub, ve a **Settings > Pages > Build and deployment** y elige **GitHub Actions**. Cada push a `main` publica la web en unos segundos.

## Probar en local

```bash
cd app
python3 -m http.server 8000
```

Y abre `http://localhost:8000`.

## Atajos

- `N` lleva el cursor al importe de un gasto nuevo.
- `Intro` guarda el gasto.
- `Esc` cierra la edición.
