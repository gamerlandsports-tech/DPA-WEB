# 🎾 DPA — Sistema de Gestión de Clases de Pádel

Aplicación web para control diario de clases de pádel, profesores, alumnos, calendario y estadísticas.

---

## 🚀 Guía de Configuración: Firebase + GitHub + Vercel

Esta guía te explica en 3 pasos cómo conectar la base de datos en la nube (gratuita), guardar copias de seguridad en GitHub y publicar la app online con Vercel.

---

### PASO 1: Configurar Firebase (Base de Datos en la Nube Gratuita)

1. Ingresá a **[Firebase Console](https://console.firebase.google.com)** con tu cuenta de Google.
2. Hacé clic en **"Agregar proyecto"** y nombralo `dpa-padel`.
3. En el menú lateral, andá a **Compilación → Firestore Database**.
4. Hacé clic en **"Crear base de datos"**, seleccioná la ubicación más cercana y elegí **Modo de producción**.
5. En la pestaña **Reglas** de Firestore, reemplazá el texto con esto y hacé clic en **Publicar**:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /dpa/{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
6. Andá a **Configuración del proyecto** ⚙️ (arriba a la izquierda), bajá hasta la sección **"Tus aplicaciones"** y hacé clic en el ícono Web `</>`.
7. Registrá la app (ej: `DPA Web`) y copiá las credenciales (`apiKey`, `projectId`, etc.).
8. Abrí el archivo `js/firebase-config.js` en tu carpeta del proyecto y pegá tus credenciales.

---

### PASO 2: Subir a GitHub (Respaldo Continuo)

1. Entrá a **[GitHub.com](https://github.com)** y creá un nuevo repositorio privado o público llamado `dpa-padel`.
2. Abrí la terminal (PowerShell o Git Bash) en la carpeta del proyecto:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - DPA Padel Manager"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/dpa-padel.git
   git push -u origin main
   ```

---

### PASO 3: Desplegar en Vercel (Publicación Online Gratuita)

1. Entrá a **[Vercel.com](https://vercel.com)** e iniciá sesión con tu cuenta de GitHub.
2. Hacé clic en **"Add New..." → "Project"**.
3. Seleccioná el repositorio `dpa-padel` de la lista.
4. Hacé clic en **"Deploy"**.
5. ¡Listo! Vercel te dará un link público (ej: `https://dpa-padel.vercel.app`) desde el cual podés ingresar desde cualquier computadora o celular.

> **💡 Actualizaciones Automáticas:**
> Cada vez que hagas `git push` a GitHub, Vercel actualizará la aplicación online automáticamente en 30 segundos.

---

## 🔒 Credenciales de Acceso por Defecto (Modo Admin)

- **Usuario:** `ADMIN`
- **Contraseña:** `15578610`
