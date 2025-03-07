import { useState, useEffect } from 'react';

export const useDarkMode = () => {
  // Verificar si el modo oscuro está guardado en localStorage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedMode = localStorage.getItem('darkMode');
    // Si existe en localStorage, usar ese valor, si no, detectar preferencia del sistema
    if (savedMode !== null) {
      return savedMode === 'true';
    } else {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  });

  // Efecto para aplicar la clase al body cuando cambia el modo
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
    // Guardar preferencia en localStorage
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  // Función para alternar el modo oscuro
  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };

  return { darkMode, toggleDarkMode };
}; 