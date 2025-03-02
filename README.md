Visión General
Convergence Online es un juego web desarrollado con React, TypeScript y Redux. Se trata de un juego de emparejamiento de iconos o símbolos en un tablero, donde los jugadores deben hacer conexiones para ganar puntos y avanzar de nivel.
Estructura del Proyecto
El proyecto sigue una arquitectura moderna basada en React con las siguientes características clave:
Tecnologías Principales
React 19: Para la interfaz de usuario
TypeScript: Para tipado estático
Redux Toolkit: Para gestión de estado global
React Router: Para navegación entre páginas
Socket.io: Para comunicación en tiempo real
Axios: Para peticiones HTTP
Framer Motion: Para animaciones
Estructura de Directorios
Componentes y Funcionalidades Principales
Autenticación
El proyecto cuenta con un sistema completo de autenticación manejado por el authSlice.ts que permite:
Registro de usuarios
Inicio de sesión
Cierre de sesión
Verificación de estado de autenticación
Sistema de Juego
El juego es la parte central de la aplicación:
GameBoard: Representa el tablero de juego
GameCell: Cada celda individual del tablero
GameControls: Controles para manejar el juego
GameInfo: Información actual del juego (puntaje, nivel, etc.)
El estado del juego se maneja en gameSlice.ts con diferentes elementos:
Puntaje y puntaje máximo
Nivel actual
Estado del juego (jugando, pausado, pantalla inicial, etc.)
Tablero (matriz de iconos)
Configuración de dificultad
Comunicación en Tiempo Real
La aplicación utiliza WebSockets (Socket.io) para comunicación en tiempo real:
Chat entre jugadores
Notificaciones de usuarios conectados/desconectados
Posiblemente actualizaciones del juego en tiempo real
Diseño y Layout
La aplicación tiene un layout consistente con:
Cabecera con navegación
Área principal para contenido
Pie de página
Hilos de Ejecución y Arquitectura
Arquitectura General
Arquitectura basada en componentes: Los componentes React se organizan jerárquicamente
Gestión de estado centralizada: Redux administra el estado global
Patrón de diseño flux: Acciones → Reducers → Estado → Vistas
Hilos de Ejecución
Hilo Principal (UI):
Renderizado de componentes
Manejo de eventos de usuario
Actualización del DOM
Servicios Asíncronos:
Peticiones HTTP mediante axios
Comunicación WebSocket en segundo plano
Temporizadores y animaciones
Redux y Middleware:
Dispatch de acciones
Reducers para actualizar estado
Middleware para efectos secundarios
Thunks para operaciones asíncronas
Flujo de Datos
El usuario interactúa con la interfaz
Se disparan acciones de Redux
Los reducers actualizan el estado
Los componentes se vuelven a renderizar con el nuevo estado
Los middleware pueden realizar efectos secundarios (peticiones API, WebSockets)
Características Técnicas Destacadas
Lazy Loading: Carga bajo demanda de componentes para mejorar el rendimiento
Error Boundary: Manejo de errores a nivel de componente para evitar fallos en cascada
Sistema de Logging: Log estructurado para seguimiento de acciones y depuración
Manejo de Estado Persistente: Guardado de algunos datos en localStorage
Rutas Protegidas: Acceso condicional a páginas según autenticación