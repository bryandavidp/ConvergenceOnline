import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import { 
  setHighlightedCells, 
  setGameStatus,
  incrementScore,
  GameState
} from '../../../store/slices/gameSlice';
import './GameTutorial.css';

// Definición de los pasos del tutorial
enum TutorialStep {
  WELCOME = 'welcome',
  BASIC_MECHANICS = 'basic_mechanics',
  CONVERGENCE = 'convergence',
  COMBOS = 'combos',
  PENALTIES = 'penalties',
  COMPLETION = 'completion'
}

interface TutorialStepContent {
  title: string;
  content: React.ReactNode;
  highlightCells?: {row: number, col: number}[];
  waitForAction?: boolean;
  actionType?: 'convergence' | 'combo' | 'penalty' | 'any';
}

interface GameTutorialProps {
  onComplete: () => void;
}

const GameTutorial: React.FC<GameTutorialProps> = ({ onComplete }) => {
  const dispatch = useDispatch();
  const [currentStep, setCurrentStep] = useState<TutorialStep>(TutorialStep.WELCOME);
  const [isStepComplete, setIsStepComplete] = useState(false);
  const [showTutorialUI, setShowTutorialUI] = useState(true);
  const [completionModalVisible, setCompletionModalVisible] = useState(false);
  // Estado para ocultar temporalmente el tutorial para realizar acciones
  const [temporarilyHidden, setTemporarilyHidden] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  // Estado para mostrar mensaje de ayuda sobre combos
  const [showComboHelp, setShowComboHelp] = useState(false);
  
  // Referencias al estado del juego
  const tutorialOverlayRef = useRef<HTMLDivElement>(null);
  const { 
    board, 
    score, 
    iconCount, 
    status, 
    comboCount,
    currentPlayMode
  } = useSelector((state: RootState) => state.game);
  
  // Valores anteriores para detectar cambios
  const prevScore = useRef(score);
  const prevIconCount = useRef(iconCount);
  const prevComboCount = useRef(comboCount);
  
  // Finalizar el tutorial
  const finishTutorial = () => {
    setCompletionModalVisible(true);
    localStorage.setItem('tutorialCompleted', 'true');
  };
  
  // Manejar el evento cuando se cierra el modal de finalización
  const handleCompletionModalClose = () => {
    setCompletionModalVisible(false);
    onComplete();
  };

  // Función para ocultar temporalmente el tutorial para realizar una acción
  const hideTemporarily = () => {
    console.log('Tutorial: Ocultando temporalmente para acción');
    setTemporarilyHidden(true);
    setActionPending(true);
  };
  
  // Contenido de los pasos del tutorial
  const tutorialSteps: Record<TutorialStep, TutorialStepContent> = {
    [TutorialStep.WELCOME]: {
      title: "¡Bienvenido al Tutorial!",
      content: (
        <>
          <p>¡Hola! Vamos a aprender juntos cómo jugar a Convergence.</p>
          <p>En este tutorial, te enseñaré las mecánicas básicas del juego para que puedas empezar a jugar rápidamente.</p>
          <button className="tutorial-button" onClick={() => nextStep()}>Empezar</button>
        </>
      )
    },
    [TutorialStep.BASIC_MECHANICS]: {
      title: "Mecánicas Básicas",
      content: (
        <>
          <p>El objetivo del juego es <strong>eliminar iconos</strong> del tablero creando <strong>convergencias</strong>.</p>
          <p>Una convergencia ocurre cuando 3 o más iconos del mismo tipo se alinean en línea recta (horizontal, vertical o diagonal).</p>
          <p>Observa el tablero y busca grupos de iconos iguales que estén alineados.</p>
          <button className="tutorial-button" onClick={() => nextStep()}>Siguiente</button>
        </>
      )
    },
    [TutorialStep.CONVERGENCE]: {
      title: "¡Crea tu primera convergencia!",
      content: (
        <>
          <p>Ahora es tu turno: <strong>encuentra 3 o más iconos iguales</strong> que estén alineados y haz clic en ellos para eliminarlos.</p>
          <p>Te he señalado un posible grupo. ¡Prueba a hacer clic!</p>
          <p className="tutorial-note">Debes completar esta acción para continuar.</p>
          {!temporarilyHidden && (
            <button className="tutorial-button" onClick={hideTemporarily}>Entendido</button>
          )}
        </>
      ),
      waitForAction: true,
      actionType: 'convergence',
      highlightCells: findPossibleConvergence(board)
    },
    [TutorialStep.COMBOS]: {
      title: "¡Sistema de Combos!",
      content: (
        <>
          <p>¡Excelente! Has creado tu primera convergencia.</p>
          <p>Un <strong>combo</strong> ocurre cuando eliminas <strong>múltiples convergencias</strong> en un corto periodo de tiempo.</p>
          <p>Para hacer un combo, necesitas:</p>
          <ol>
            <li>Eliminar una primera convergencia (que ya has hecho)</li>
            <li>Encontrar y eliminar <strong>otra convergencia diferente</strong> antes de que se agote el tiempo</li>
          </ol>
          <p>Los combos multiplican tus puntos: <span className="combo-basic-text">x1.5</span>, <span className="combo-uncommon-text">x2.0</span>, <span className="combo-rare-text">x3.0</span> y hasta <span className="combo-legendary-text">x5.0</span>.</p>
          <p>Verás una <strong>barra de tiempo</strong> en la parte superior cuando se active un combo. ¡Elimina otro grupo antes de que se agote!</p>
          <p className="tutorial-note">Debes eliminar una segunda convergencia para continuar.</p>
          {!temporarilyHidden && (
            <button className="tutorial-button" onClick={hideTemporarily}>Entendido</button>
          )}
        </>
      ),
      waitForAction: true,
      actionType: 'combo'
    },
    [TutorialStep.PENALTIES]: {
      title: "Cuidado con las Penalizaciones",
      content: (
        <>
          <p>Ten cuidado: si el tablero se llena demasiado, recibirás <strong>penalizaciones</strong>.</p>
          <p>Estas penalizaciones añaden más iconos al tablero y dificultan el juego.</p>
          <p>Intenta mantener el tablero lo más despejado posible.</p>
          <button className="tutorial-button" onClick={() => nextStep()}>Entendido</button>
        </>
      )
    },
    [TutorialStep.COMPLETION]: {
      title: "¡Tutorial Completado!",
      content: (
        <>
          <p>¡Felicidades! Has completado el tutorial básico de Convergence.</p>
          <p>Ahora conoces las mecánicas fundamentales del juego:</p>
          <ul>
            <li>Crear convergencias alineando 3 o más iconos iguales</li>
            <li>Realizar combos para multiplicar tus puntos</li>
            <li>Evitar penalizaciones manteniendo el tablero despejado</li>
          </ul>
          <button className="tutorial-button-primary" onClick={finishTutorial}>¡Estoy listo para jugar!</button>
        </>
      )
    }
  };
  
  // Función para encontrar una posible convergencia en el tablero actual
  function findPossibleConvergence(board: (string | null)[][]): {row: number, col: number}[] {
    const directions = [
      {rowStep: 1, colStep: 0},   // Vertical
      {rowStep: 0, colStep: 1},   // Horizontal
      {rowStep: 1, colStep: 1},   // Diagonal descendente
      {rowStep: 1, colStep: -1}   // Diagonal ascendente
    ];
    
    const boardSize = board.length;
    
    // Buscar convergencias existentes
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        const icon = board[row][col];
        if (!icon) continue;
        
        for (const direction of directions) {
          const convergence = [];
          let currentRow = row;
          let currentCol = col;
          
          // Comprobar hasta 5 celdas en cada dirección
          for (let i = 0; i < 5; i++) {
            if (
              currentRow < 0 || 
              currentRow >= boardSize || 
              currentCol < 0 || 
              currentCol >= boardSize ||
              board[currentRow][currentCol] !== icon
            ) {
              break;
            }
            
            convergence.push({row: currentRow, col: currentCol});
            currentRow += direction.rowStep;
            currentCol += direction.colStep;
          }
          
          // Si encontramos 3 o más, es una convergencia válida
          if (convergence.length >= 3) {
            console.log(`Convergencia encontrada: ${convergence.length} iconos ${icon}`);
            return convergence;
          }
        }
      }
    }
    
    console.log('No se encontraron convergencias existentes, buscando oportunidades para crear una');
    
    // Si no encontramos convergencias existentes, busquemos patrones donde falte 1 icono para completar
    const potentialConvergences = findAlmostConvergences(board);
    if (potentialConvergences.length > 0) {
      console.log('Se encontró una oportunidad para crear convergencia');
      return potentialConvergences;
    }
    
    // Si no encontramos ninguna, devolver algunas celdas al azar que tengan iconos
    console.log('No se encontraron convergencias potenciales, seleccionando iconos aleatorios');
    const randomCells = [];
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col]) {
          randomCells.push({row, col});
        }
      }
    }
    
    // Devolver hasta 3 celdas aleatorias
    const selectedCells = randomCells.slice(0, Math.min(3, randomCells.length));
    console.log(`Seleccionados ${selectedCells.length} iconos aleatorios para destacar`);
    return selectedCells;
  }
  
  // Función para encontrar patrones que estén a un icono de formar una convergencia
  function findAlmostConvergences(board: (string | null)[][]): {row: number, col: number}[] {
    const boardSize = board.length;
    
    // Recorrer cada celda del tablero
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        // Verificar si hay al menos 2 iconos del mismo tipo en línea horizontal
        if (col < boardSize - 2) {
          if (board[row][col] && board[row][col] === board[row][col+1]) {
            // Destacar estos 2 iconos adyacentes
            return [
              {row, col},
              {row, col: col+1}
            ];
          }
        }
        
        // Verificar si hay al menos 2 iconos del mismo tipo en línea vertical
        if (row < boardSize - 2) {
          if (board[row][col] && board[row][col] === board[row+1][col]) {
            // Destacar estos 2 iconos adyacentes
            return [
              {row, col},
              {row: row+1, col}
            ];
          }
        }
        
        // Verificar si hay al menos 2 iconos del mismo tipo en diagonal descendente
        if (row < boardSize - 2 && col < boardSize - 2) {
          if (board[row][col] && board[row][col] === board[row+1][col+1]) {
            // Destacar estos 2 iconos adyacentes en diagonal
            return [
              {row, col},
              {row: row+1, col: col+1}
            ];
          }
        }
        
        // Verificar si hay al menos 2 iconos del mismo tipo en diagonal ascendente
        if (row > 1 && col < boardSize - 2) {
          if (board[row][col] && board[row][col] === board[row-1][col+1]) {
            // Destacar estos 2 iconos adyacentes en diagonal
            return [
              {row, col},
              {row: row-1, col: col+1}
            ];
          }
        }
      }
    }
    
    return [];
  }
  
  // Avanzar al siguiente paso del tutorial
  const nextStep = () => {
    const steps = Object.values(TutorialStep);
    const currentIndex = steps.indexOf(currentStep);
    
    console.log(`Tutorial: Avanzando al paso ${currentIndex + 1} de ${steps.length}`);
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
      setIsStepComplete(false);
      setTemporarilyHidden(false);
      setActionPending(false);
    } else {
      console.log('Tutorial: Finalizando tutorial');
      finishTutorial();
    }
  };
  
  // Verificar si se ha completado una acción requerida para avanzar
  useEffect(() => {
    const currentStepContent = tutorialSteps[currentStep];
    
    if (currentStepContent.waitForAction && actionPending) {
      switch (currentStepContent.actionType) {
        case 'convergence':
          // Verificar si se ha hecho una convergencia (la puntuación ha aumentado)
          if (score > prevScore.current) {
            console.log('Convergencia detectada: puntuación aumentada');
            setIsStepComplete(true);
            setTemporarilyHidden(false);
            setActionPending(false);
          }
          break;
          
        case 'combo':
          // Verificar si se ha hecho un combo real (no solo una convergencia)
          // Un combo real ocurre cuando el contador de combos es al menos 2
          if (comboCount >= 2) {
            console.log(`Combo real detectado: ${comboCount} convergencias consecutivas`);
            setIsStepComplete(true);
            setTemporarilyHidden(false);
            setActionPending(false);
            setShowComboHelp(false);
          } else if (score > prevScore.current && comboCount < 2) {
            // Si solo aumentó la puntuación pero no es un combo real, mostrar un mensaje
            console.log('Se detectó una convergencia, pero no un combo. El combo requiere múltiples convergencias.');
            
            // Mostrar mensaje de ayuda
            setShowComboHelp(true);
            setTemporarilyHidden(false);
            
            // No marcamos como completo, solo actualizamos la referencia de puntuación
            prevScore.current = score;
          }
          break;
          
        default:
          break;
      }
    }
    
    // Actualizar referencias (excepto para el caso especial del combo)
    if (!(currentStepContent.actionType === 'combo' && score > prevScore.current && comboCount < 2)) {
      prevScore.current = score;
    }
    prevIconCount.current = iconCount;
    prevComboCount.current = comboCount;
  }, [score, iconCount, comboCount, currentStep, tutorialSteps, actionPending]);
  
  // Avanzar automáticamente cuando se completa un paso
  useEffect(() => {
    if (isStepComplete) {
      const timer = setTimeout(() => {
        nextStep();
      }, 1500); // Esperar 1.5 segundos antes de avanzar
      
      return () => clearTimeout(timer);
    }
  }, [isStepComplete]);
  
  // Resaltar celdas relevantes para el paso actual
  useEffect(() => {
    const highlightCells = tutorialSteps[currentStep].highlightCells;
    
    if (highlightCells && highlightCells.length > 0) {
      // Aplicar clases especiales para el tutorial a las celdas resaltadas
      const cellElements = document.querySelectorAll('.game-cell');
      const boardSize = board.length;
      
      // Primero remover cualquier clase de tutorial anterior
      cellElements.forEach(cell => {
        cell.classList.remove('tutorial-highlight-pulse');
        
        // Remover indicadores de clic previos
        const indicators = document.querySelectorAll('.cell-click-indicator');
        indicators.forEach(ind => ind.remove());
      });
      
      // Aplicar el nuevo estilo a las celdas correspondientes
      highlightCells.forEach(({row, col}) => {
        const index = row * boardSize + col;
        if (cellElements[index]) {
          cellElements[index].classList.add('tutorial-highlight-pulse');
          
          // Añadir indicador de clic
          if (tutorialSteps[currentStep].waitForAction) {
            const indicator = document.createElement('div');
            indicator.className = 'cell-click-indicator';
            indicator.textContent = '¡Clic aquí!';
            cellElements[index].appendChild(indicator);
          }
        }
      });
      
      // Enviar las celdas al estado global para que se resalten
      dispatch(setHighlightedCells(highlightCells));
    } else {
      dispatch(setHighlightedCells([]));
    }
    
    return () => {
      // Limpiar clases y elementos al desmontar
      const cellElements = document.querySelectorAll('.game-cell');
      cellElements.forEach(cell => {
        cell.classList.remove('tutorial-highlight-pulse');
      });
      
      const indicators = document.querySelectorAll('.cell-click-indicator');
      indicators.forEach(ind => ind.remove());
      
      dispatch(setHighlightedCells([]));
    };
  }, [currentStep, dispatch, board, temporarilyHidden]);
  
  // Verificar que estamos en modo tutorial
  useEffect(() => {
    if (currentPlayMode !== 'tutorial' && status === 'playing') {
      console.warn('GameTutorial: No estamos en modo tutorial pero el componente está activo');
    }
  }, [currentPlayMode, status]);
  
  // Ocultar el mensaje de ayuda de combo después de un tiempo
  useEffect(() => {
    if (showComboHelp) {
      const timer = setTimeout(() => {
        setShowComboHelp(false);
      }, 5000); // Ocultar después de 5 segundos
      
      return () => clearTimeout(timer);
    }
  }, [showComboHelp]);
  
  // Logging al montar el componente
  useEffect(() => {
    console.log('GameTutorial: Componente montado y visible');
    
    return () => {
      console.log('GameTutorial: Componente desmontado');
    };
  }, []);
  
  return (
    <>
      {/* Overlay principal del tutorial */}
      {showTutorialUI && !temporarilyHidden && (
        <div 
          className={`tutorial-overlay ${tutorialSteps[currentStep].waitForAction ? 'interactive' : ''}`} 
          ref={tutorialOverlayRef}
        >
          <div className="tutorial-card">
            <h2 className="tutorial-title">{tutorialSteps[currentStep].title}</h2>
            <div className="tutorial-content">
              {tutorialSteps[currentStep].content}
            </div>
            {showComboHelp && currentStep === TutorialStep.COMBOS && (
              <div className="tutorial-help-message">
                <p>¡Bien! Has eliminado una convergencia, pero un combo requiere eliminar <strong>varias convergencias seguidas</strong>.</p>
                <p>Busca y elimina <strong>otro grupo de iconos</strong> antes de que se agote el tiempo.</p>
              </div>
            )}
            {isStepComplete && tutorialSteps[currentStep].waitForAction && (
              <div className="tutorial-success-message">
                ¡Perfecto! Avanzando al siguiente paso...
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Botón flotante para volver a mostrar el tutorial cuando está oculto */}
      {temporarilyHidden && (
        <div className="tutorial-mini-button" onClick={() => setTemporarilyHidden(false)}>
          <span className="tutorial-mini-icon">❓</span>
          <span>Mostrar Tutorial</span>
        </div>
      )}
      
      {/* Modal de finalización del tutorial */}
      {completionModalVisible && (
        <div className="tutorial-completion-modal">
          <div className="tutorial-completion-content">
            <h2>¡Felicidades!</h2>
            <p>Has completado el tutorial básico de Convergence.</p>
            <p>Ahora tienes los conocimientos necesarios para jugar a todos los modos de juego.</p>
            <p>¡Diviértete jugando y mejorando tus habilidades!</p>
            <button 
              className="tutorial-completion-button"
              onClick={handleCompletionModalClose}
            >
              ¡Vamos a jugar!
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default GameTutorial;
