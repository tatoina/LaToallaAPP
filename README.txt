# CenasApp (prototipo)

Cómo ejecutar:
1. Instala dependencias:
   npm install
2. Arranca en modo desarrollo:
   npm run dev
3. Abre http://localhost:5173

Qué hace este prototipo:
- Pantalla de bienvenida con "Entrar" y "Registrarse".
- Registro guarda usuarios en localStorage.
- Por ahora la contraseña requerida en el registro es "0000".
- Login valida contra usuarios en localStorage y guarda el usuario actual en "currentUser".

Siguientes pasos recomendados:
- Cambiar a TypeScript si quieres más seguridad.
- Añadir un backend real (Node + DB o Supabase) para persistencia y seguridad.
- Implementar edición de perfil, validaciones más robustas y gestión de sesiones seguras.