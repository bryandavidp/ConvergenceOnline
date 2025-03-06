# Convergence Mobile

## Descripción
Este proyecto es una migración de la aplicación web "Convergence" a una versión móvil utilizando React Native con soporte para web a través de React Native Web.

## Estructura del Proyecto
```
mobile/
├── src/
│   ├── assets/            # Recursos estáticos (imágenes, sonidos, etc.)
│   ├── components/        # Componentes reutilizables
│   │   └── game/          # Componentes específicos del juego
│   │       └── GameBoard/ # Componente del tablero de juego
│   │           ├── hooks/ # Hooks personalizados para el tablero
│   │           └── styles/ # Estilos del tablero
│   ├── hooks/             # Hooks personalizados generales
│   ├── store/             # Gestión de estado con Redux
│   └── utils/             # Utilidades y funciones auxiliares
├── package.json           # Dependencias del proyecto
└── tsconfig.json          # Configuración de TypeScript
```

## Características
- Soporte multiplataforma (iOS, Android, Web)
- Sistema de detección de rendimiento para adaptar animaciones
- Almacenamiento local persistente
- Gestión de estado con Redux

## Migración desde Web
El proceso de migración implica:
1. Adaptar los componentes React a React Native
2. Convertir CSS a StyleSheet de React Native
3. Reemplazar eventos del DOM por gestos nativos
4. Adaptar las APIs del navegador a APIs nativas

## Cómo ejecutar
### Para desarrollo web
```
cd mobile
npm run web
```

### Para desarrollo en iOS
```
cd mobile
npm run ios
```

### Para desarrollo en Android
```
cd mobile
npm run android
``` 