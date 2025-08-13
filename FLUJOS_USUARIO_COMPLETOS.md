# Documento Técnico Funcional - Flujos de Usuario Completos
## Mercado Productivo 2.0

**Versión:** 1.0  
**Fecha:** 12 de Enero 2025  
**Tecnologías:** Vite + React + Next.js + Supabase + Tailwind CSS

---

## Índice

1. [Introducción](#introducción)
2. [Arquitectura y Tecnologías](#arquitectura-y-tecnologías)
3. [Flujos de Autenticación](#flujos-de-autenticación)
4. [Flujos de Perfil y Configuración](#flujos-de-perfil-y-configuración)
5. [Flujos de Productos](#flujos-de-productos)
6. [Flujos de Destacado y Créditos](#flujos-de-destacado-y-créditos)
7. [Flujos de Planes y Suscripciones](#flujos-de-planes-y-suscripciones)
8. [Flujos de Navegación Pública](#flujos-de-navegación-pública)
9. [Flujos de Dashboard](#flujos-de-dashboard)
10. [Flujos de Búsqueda y Catálogo](#flujos-de-búsqueda-y-catálogo)
11. [Estados de Error y Validaciones](#estados-de-error-y-validaciones)
12. [Responsive Design](#responsive-design)
13. [Casos de Uso Especiales](#casos-de-uso-especiales)

---

## Introducción

Este documento detalla todos los flujos de usuario del sistema Mercado Productivo 2.0, una plataforma B2B agroindustrial que conecta empresas y productores directamente. El objetivo es proporcionar una guía completa para desarrollo, QA y negocio, asegurando que ningún caso de uso quede sin cubrir.

### Objetivos del Sistema
- Eliminar intermediarios innecesarios en transacciones agroindustriales
- Facilitar conexiones directas entre empresas y productores
- Proporcionar transparencia en precios y trazabilidad
- Ofrecer un sistema de destacado de productos basado en créditos

---

## Arquitectura y Tecnologías

### Stack Tecnológico
- **Frontend:** Next.js 14 + React + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Base de datos:** Supabase (PostgreSQL)
- **Autenticación:** Supabase Auth
- **Storage:** Supabase Storage
- **Deployment:** Vercel/Netlify

### Estructura de Base de Datos Principal
- `profiles`: Información de usuarios
- `products`: Productos/anuncios
- `plans`: Planes de suscripción
- `usage_counters`: Contadores de uso mensual
- `credit_transactions`: Historial de transacciones de créditos

---

## Flujos de Autenticación

### 1. Registro de Usuario

**Ruta:** `/auth/register`

#### Flujo Paso a Paso:
1. **Acceso inicial:**
   - Usuario navega a `/auth/register`
   - Se renderiza `RegisterForm` con campos: email, password, confirm password, role
   - Botones OAuth (Google, GitHub) disponibles

2. **Selección de rol:**
   - Usuario selecciona entre "Anunciante" o "Comprador"
   - Campo obligatorio, sin valor por defecto

3. **Completar formulario:**
   - Email: validación formato email
   - Password: mínimo 8 caracteres
   - Confirm Password: debe coincidir con password
   - Role: obligatorio

4. **Envío del formulario:**
   - Click en "Crear cuenta"
   - Validaciones frontend ejecutadas
   - Si válido: llamada a `supabase.auth.signUp()`
   - Loading state activado

5. **Respuestas posibles:**
   - **Éxito:** Redirección a `/auth/verify-email`
   - **Error:** Mensaje de error mostrado (email ya existe, password débil, etc.)

6. **OAuth alternativo:**
   - Click en botón Google/GitHub
   - Redirección a proveedor OAuth
   - Callback automático
   - Si éxito: redirección a `/dashboard`

#### Estados de UI:
- **Inicial:** Formulario vacío, botones habilitados
- **Loading:** Botones deshabilitados, spinner visible
- **Error:** Mensaje de error en rojo, formulario editable
- **Success:** Redirección automática

### 2. Verificación de Email

**Ruta:** `/auth/verify-email`

#### Flujo Paso a Paso:
1. **Llegada a la página:**
   - Mensaje explicativo sobre verificación
   - Botón "Reenviar email de verificación"

2. **Reenvío de email:**
   - Click en "Reenviar"
   - Llamada a `supabase.auth.resend()`
   - Mensaje de confirmación

3. **Click en email:**
   - Usuario abre email recibido
   - Click en enlace de verificación
   - Redirección automática a `/dashboard`

### 3. Inicio de Sesión

**Ruta:** `/auth/login`

#### Flujo Paso a Paso:
1. **Acceso inicial:**
   - Formulario con email y password
   - Botones OAuth disponibles
   - Link "¿Olvidaste tu contraseña?"

2. **Completar credenciales:**
   - Email: validación formato
   - Password: campo obligatorio

3. **Envío del formulario:**
   - Click en "Iniciar sesión"
   - Llamada a `supabase.auth.signInWithPassword()`
   - Loading state activado

4. **Respuestas posibles:**
   - **Éxito:** Redirección a `/dashboard`
   - **Error:** Mensaje específico (credenciales incorrectas, email no verificado)

### 4. Recuperación de Contraseña

**Ruta:** `/auth/forgot-password`

#### Flujo Paso a Paso:
1. **Solicitud de reset:**
   - Campo email
   - Click en "Enviar enlace de recuperación"
   - Llamada a `supabase.auth.resetPasswordForEmail()`

2. **Confirmación:**
   - Mensaje de éxito
   - Instrucciones para revisar email

3. **Click en email:**
   - Redirección a `/auth/update-password`
   - Token de reset validado automáticamente

### 5. Actualización de Contraseña

**Ruta:** `/auth/update-password`

#### Flujo Paso a Paso:
1. **Formulario de nueva contraseña:**
   - Campo "Nueva contraseña"
   - Campo "Confirmar nueva contraseña"
   - Validaciones en tiempo real

2. **Envío:**
   - Click en "Actualizar contraseña"
   - Llamada a `supabase.auth.updateUser()`
   - Redirección a `/auth/update-password/success`

---

## Flujos de Perfil y Configuración

### 1. Completar Perfil

**Ruta:** `/dashboard/profile`

#### Flujo Paso a Paso:
1. **Acceso inicial:**
   - Verificación de autenticación
   - Si no autenticado: redirección a `/auth/login`
   - Carga de datos existentes del perfil

2. **Formulario de perfil:**
   - Campos obligatorios: Nombre, Apellido, DNI/CUIT, Dirección, Ciudad, Provincia, CP
   - Campos opcionales: Empresa, Teléfono
   - Validaciones en tiempo real

3. **Guardado:**
   - Click en "Guardar cambios"
   - Validación completa del formulario
   - Si válido: llamada a Supabase para actualizar `profiles`
   - Evento personalizado `profile:updated` disparado
   - Mensaje de éxito mostrado

4. **Estados especiales:**
   - **Perfil incompleto:** Advertencias en dashboard
   - **Primer guardado:** Asignación automática de `plan_code = 'free'` si es anunciante

#### Validaciones Específicas:
- DNI/CUIT: formato numérico
- Email: formato válido
- Código Postal: numérico
- Todos los campos obligatorios deben estar completos para publicar productos

### 2. Visualización de Perfil Público

**Ruta:** `/profile` (placeholder)

#### Funcionalidad:
- Vista de solo lectura del perfil
- Información pública del usuario
- Productos destacados del usuario

---

## Flujos de Productos

### 1. Listado de Productos del Usuario

**Ruta:** `/dashboard/products`

#### Flujo Paso a Paso:
1. **Carga inicial:**
   - Verificación de autenticación
   - Query a `products` filtrado por `user_id`
   - Verificación de perfil completo para mostrar advertencias

2. **Visualización:**
   - Grid responsive de productos
   - Ordenamiento: productos destacados primero, luego por fecha de creación
   - Cada card muestra: imagen, título, precio, cantidad, estado destacado

3. **Acciones por producto:**
   - **Ver detalles:** Click en "Ver detalles" → `/dashboard/products/{id}`
   - **Editar:** Click en "Editar" → `/dashboard/products/{id}/edit`
   - **Destacar:** Click en "Destacar" → Modal de confirmación

4. **Crear nuevo producto:**
   - Click en "Nuevo Producto"
   - Si perfil incompleto: modal con lista de campos faltantes
   - Si perfil completo: redirección a `/dashboard/products/new`

#### Estados de UI:
- **Cargando:** Skeleton loaders
- **Sin productos:** Mensaje explicativo
- **Con productos:** Grid con cards
- **Perfil incompleto:** Botón "Nuevo Producto" deshabilitado con tooltip

### 2. Creación de Producto

**Ruta:** `/dashboard/products/new`

#### Flujo Paso a Paso:
1. **Verificaciones iniciales:**
   - Autenticación requerida
   - Perfil completo requerido
   - Carga de límites del plan (imágenes permitidas)

2. **Formulario de producto:**
   - **Título:** Obligatorio, máximo 100 caracteres
   - **Descripción:** Obligatorio, máximo 500 caracteres
   - **Precio:** Numérico, obligatorio
   - **Cantidad:** Valor numérico + unidad (kg, ton, unidades)
   - **Categoría:** Selección de lista predefinida
   - **Imágenes:** Upload múltiple según límites del plan
   - **Ubicación:** Provincia, ciudad
   - **Contacto:** Teléfono, email, WhatsApp

3. **Validaciones:**
   - Todos los campos obligatorios completos
   - Formato de precio válido
   - Al menos una imagen subida
   - Límite de imágenes según plan respetado

4. **Subida de imágenes:**
   - Drag & drop o click para seleccionar
   - Validación: formato (jpg, png, webp), tamaño máximo
   - Upload a Supabase Storage bucket `product-images`
   - Preview inmediato

5. **Envío del formulario:**
   - Click en "Publicar producto"
   - Validación final
   - Insert en tabla `products`
   - Redirección a `/dashboard/products` con mensaje de éxito

#### Límites por Plan:
- **Free/Basic:** 1 imagen
- **Premium/Pro:** 5 imágenes
- **Plus/Enterprise:** 10 imágenes

### 3. Edición de Producto

**Ruta:** `/dashboard/products/{id}/edit`

#### Flujo Paso a Paso:
1. **Carga inicial:**
   - Verificación de propiedad del producto
   - Si no es propietario: error 403
   - Carga de datos existentes del producto

2. **Formulario pre-poblado:**
   - Todos los campos con valores actuales
   - Imágenes existentes mostradas
   - Posibilidad de agregar/eliminar imágenes

3. **Modificaciones:**
   - Edición de cualquier campo
   - Validaciones en tiempo real
   - Gestión de imágenes: eliminar existentes, agregar nuevas

4. **Guardado:**
   - Click en "Guardar cambios"
   - Update en tabla `products`
   - Redirección con mensaje de éxito

### 4. Vista Detallada de Producto

**Ruta:** `/dashboard/products/{id}`

#### Flujo Paso a Paso:
1. **Carga del producto:**
   - Query por ID
   - Verificación de propiedad
   - Carga de datos relacionados (transacciones de créditos si está destacado)

2. **Visualización:**
   - Galería de imágenes
   - Información completa del producto
   - Estado de destacado con fechas
   - Historial de destacados (transacciones)

3. **Acciones disponibles:**
   - **Editar:** Redirección a formulario de edición
   - **Destacar:** Modal de confirmación si no está destacado
   - **Ver en catálogo público:** Link al producto en vista pública

---

## Flujos de Destacado y Créditos

### 1. Destacar Producto

**Componente:** `FeatureProductButton`

#### Flujo Paso a Paso:
1. **Estado inicial del botón:**
   - Si producto NO destacado: Botón naranja "Destacar"
   - Si producto destacado: Botón verde deshabilitado "✓ Destacado"

2. **Click en "Destacar":**
   - Modal de confirmación se abre
   - Información mostrada: "Usará X crédito(s) y destacará el producto por Y día(s)"
   - Botones: "Cancelar" y "Confirmar"

3. **Confirmación:**
   - Click en "Confirmar"
   - Loading state activado
   - POST a `/api/products/feature`

4. **Procesamiento backend:**
   - Validación de autenticación
   - Llamada a RPC `sp_feature_product(product_id, days, cost)`
   - RPC ejecuta:
     - Verifica propiedad del producto
     - Verifica créditos disponibles
     - Descuenta créditos de `usage_counters`
     - Actualiza `featured_until` del producto
     - Registra transacción en `credit_transactions`

5. **Respuestas posibles:**
   - **Éxito:** Modal se cierra, página se refresca, botón cambia a estado "Destacado"
   - **Error:** Mensaje específico mostrado (créditos insuficientes, producto no encontrado, etc.)

#### Parámetros por Defecto:
- **Días:** 7 días
- **Costo:** 10 créditos

### 2. Gestión de Créditos

**Ubicación:** Dashboard principal y página de plan

#### Visualización de Créditos:
1. **Dashboard principal:**
   - Gráfico radial mostrando créditos usados vs disponibles
   - Información del período actual (mes YYYYMM)
   - Créditos restantes calculados en tiempo real

2. **Cálculo de créditos:**
   - Créditos mensuales definidos en `plans.credits_monthly`
   - Uso actual desde `usage_counters.credits_used`
   - Restantes = mensuales - usados

3. **Reset mensual:**
   - Automático por período YYYYMM
   - Nuevo período = nuevos créditos disponibles

---

## Flujos de Planes y Suscripciones

### 1. Visualización de Planes

**Ruta:** `/planes`

#### Flujo Paso a Paso:
1. **Carga de planes:**
   - Query a tabla `plans`
   - Información mostrada por plan:
     - Nombre y descripción
     - Precio (Gratis, Premium, Plus)
     - Límite de productos
     - Créditos mensuales
     - Características específicas

2. **Comparación visual:**
   - Grid de 3 columnas (móvil: 1 columna)
   - Plan Premium marcado como "Más Popular"
   - Botones de acción por plan

3. **Acciones:**
   - **Plan Básico:** "Comenzar Gratis" → `/dashboard`
   - **Planes Premium/Plus:** "Elegir Plan" → Sistema de pagos (pendiente implementación)

### 2. Gestión de Plan Actual

**Ubicación:** Dashboard principal

#### Información Mostrada:
1. **Plan actual:**
   - Nombre del plan desde `profiles.plan_code`
   - Fecha de activación estimada
   - Fecha de expiración (1 mes desde activación)

2. **Límites y uso:**
   - Productos publicados vs máximo permitido
   - Créditos usados vs disponibles
   - Countdown hasta expiración

---

## Flujos de Navegación Pública

### 1. Página Principal

**Ruta:** `/`

#### Secciones y Flujos:
1. **Hero Section:**
   - Mensaje principal y propuesta de valor
   - Botones de acción:
     - Si NO autenticado: "Crear cuenta gratis" → `/auth/register`
     - Siempre: "Explorar catálogo" → `/catalog`

2. **Sección "¿Cómo funciona?":**
   - 6 pasos explicativos con iconos
   - Animaciones de reveal al hacer scroll

3. **Categorías destacadas:**
   - 4 categorías con imágenes
   - Click en cualquiera → `/catalog`

4. **CTA final:**
   - Solo visible si NO autenticado
   - "Comenzar ahora" → `/auth/register`

### 2. Catálogo Público

**Ruta:** `/catalog`

#### Estado Actual:
- Placeholder con parámetros de búsqueda
- Funcionalidad completa pendiente de implementación

#### Funcionalidad Planificada:
1. **Filtros:**
   - Por categoría
   - Por ubicación
   - Por rango de precio
   - Por disponibilidad

2. **Búsqueda:**
   - Texto libre
   - Autocompletado
   - Búsqueda avanzada

3. **Resultados:**
   - Grid de productos
   - Paginación
   - Ordenamiento (precio, fecha, relevancia)

### 3. Páginas Informativas

#### Nosotros (`/nosotros`)
- Información de la empresa
- Misión y visión
- Equipo

#### Contacto (`/contacto`)
- Formulario de contacto
- Información de contacto
- Mapa de ubicación

---

## Flujos de Dashboard

### 1. Dashboard Principal

**Ruta:** `/dashboard`

#### Flujo de Carga:
1. **Verificaciones iniciales:**
   - Autenticación requerida
   - Carga de perfil del usuario
   - Carga de plan actual
   - Carga de métricas de uso

2. **Información mostrada:**
   - **Resumen de cuenta:** Email, plan, estado de verificación
   - **Métricas de uso:** Productos publicados, créditos usados, expiración del plan
   - **Alertas:** Perfil incompleto si aplica

3. **Tarjeta de perfil incompleto:**
   - Solo visible si faltan campos obligatorios
   - Lista detallada de campos pendientes
   - Estado por campo (Completo/Pendiente)
   - Link directo a `/dashboard/profile`

### 2. Sidebar de Navegación

**Componente:** `Sidebar`

#### Elementos de navegación:
- **Dashboard:** `/dashboard`
- **Mis Productos:** `/dashboard/products`
- **Mi Plan:** `/dashboard/plan`
- **Mi Perfil:** `/dashboard/profile`

#### Estados:
- Elemento activo destacado visualmente
- Responsive: colapsa en móvil

---

## Flujos de Búsqueda y Catálogo

### 1. Búsqueda Global

**Estado:** Pendiente de implementación

#### Funcionalidad Planificada:
1. **Barra de búsqueda:**
   - Presente en header del sitio
   - Búsqueda en tiempo real
   - Sugerencias automáticas

2. **Resultados:**
   - Productos que coincidan con términos
   - Filtros aplicables
   - Ordenamiento múltiple

### 2. Filtros Avanzados

**Estado:** Pendiente de implementación

#### Tipos de filtros:
- **Categoría:** Dropdown con categorías predefinidas
- **Ubicación:** Por provincia/ciudad
- **Precio:** Rango mínimo/máximo
- **Cantidad:** Disponibilidad mínima
- **Destacados:** Solo productos destacados

---

## Estados de Error y Validaciones

### 1. Errores de Autenticación

#### Tipos de error:
- **Email ya registrado:** "Ya existe una cuenta con este email"
- **Credenciales incorrectas:** "Email o contraseña incorrectos"
- **Email no verificado:** "Debes verificar tu email antes de continuar"
- **Token expirado:** "El enlace ha expirado, solicita uno nuevo"

### 2. Errores de Validación

#### Frontend:
- Validación en tiempo real en formularios
- Mensajes específicos por campo
- Prevención de envío si hay errores

#### Backend:
- Validación adicional en APIs
- Mensajes de error estructurados
- Códigos de error específicos

### 3. Errores de Negocio

#### Créditos:
- **Créditos insuficientes:** "No tienes suficientes créditos para destacar este producto"
- **Producto ya destacado:** Botón cambia a estado deshabilitado

#### Productos:
- **Límite alcanzado:** "Has alcanzado el límite de productos para tu plan"
- **Perfil incompleto:** "Completa tu perfil para publicar productos"

### 4. Errores de Sistema

#### Manejo genérico:
- Mensajes amigables al usuario
- Logging detallado para desarrollo
- Fallbacks y estados de carga

---

## Responsive Design

### 1. Breakpoints Utilizados

```css
/* Mobile first approach */
sm: 640px   /* Tablets pequeñas */
md: 768px   /* Tablets */
lg: 1024px  /* Desktop pequeño */
xl: 1280px  /* Desktop */
2xl: 1536px /* Desktop grande */
```

### 2. Componentes Optimizados

#### Página Principal:
- **Hero:** Texto y botones adaptativos
- **Grid de características:** 1 col → 2 col → 3 col
- **Categorías:** 1 col → 2 col → 4 col

#### Dashboard:
- **Métricas:** Grid adaptativo
- **Sidebar:** Colapsa en móvil
- **Formularios:** Campos apilados en móvil

#### Productos:
- **Grid de productos:** 1 → 2 → 3 → 4 columnas
- **Formulario de creación:** Layout adaptativo
- **Botones de acción:** Stack vertical en móvil

### 3. Navegación Móvil

#### Header:
- Logo siempre visible
- Menú hamburguesa en móvil
- Dropdown de usuario adaptativo

#### Sidebar Dashboard:
- Overlay en móvil
- Navegación por tabs en tablets

---

## Casos de Uso Especiales

### 1. Usuario Nuevo

#### Primer acceso:
1. Registro → Verificación de email
2. Primer login → Dashboard con perfil incompleto
3. Completar perfil → Asignación de plan gratuito
4. Crear primer producto → Onboarding completo

### 2. Usuario con Plan Expirado

#### Comportamiento:
- Dashboard muestra advertencia
- Productos existentes siguen visibles
- No puede destacar productos
- No puede crear nuevos productos

### 3. Migración de Datos

#### Eliminación de sistema de ofertas:
- Columnas `offers_per_month` y `offers_created` removidas
- Solo sistema de créditos activo
- Migración automática de datos existentes

### 4. Gestión de Imágenes

#### Upload y storage:
- Validación de formato y tamaño
- Compresión automática
- CDN para entrega optimizada
- Cleanup de imágenes huérfanas

---

## Conclusiones y Próximos Pasos

### Funcionalidades Completadas:
✅ Sistema de autenticación completo  
✅ Gestión de perfiles  
✅ CRUD de productos  
✅ Sistema de créditos y destacado  
✅ Dashboard con métricas  
✅ Diseño responsive  
✅ Eliminación de sistema de ofertas  

### Pendientes de Implementación:
🔄 Catálogo público funcional  
🔄 Sistema de búsqueda y filtros  
🔄 Integración de pagos  
🔄 Sistema de notificaciones  
🔄 Chat/mensajería entre usuarios  
🔄 Sistema de reputación  
🔄 Analytics avanzados  

### Mejoras Técnicas Sugeridas:
- Implementar cache de consultas frecuentes
- Optimizar carga de imágenes con lazy loading
- Agregar tests automatizados
- Implementar monitoring y alertas
- Mejorar SEO y meta tags

---

**Documento generado:** 12 de Enero 2025  
**Próxima revisión:** A definir según roadmap de desarrollo
