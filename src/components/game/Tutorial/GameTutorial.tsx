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
        </>
      ),
      waitForAction: true,
      actionType: 'convergence',
      highlightCells: findPossibleConvergence(board)
    },
    [TutorialStep.COMBOS]: {
      title: "¡Combos!",
      content: (
        <>
          <p>¡Excelente! Has creado tu primera convergencia.</p>
          <p>Si eliminas varias convergencias en un corto periodo de tiempo, crearás <strong>combos</strong> que multiplican tus puntos.</p>
          <p>Intenta eliminar otro grupo de iconos rápidamente para crear un combo.</p>
          <p className="tutorial-note">Debes crear un combo para continuar.</p>
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
            return convergence;
          }
        }
      }
    }
    
    // Si no encontramos ninguna, devolver algunas celdas al azar que tengan iconos
    const randomCells = [];
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (board[row][col]) {
          randomCells.push({row, col});
        }
      }
    }
    
    // Devolver hasta 3 celdas aleatorias
    return randomCells.slice(0, 3);
  }
  
  // Avanzar al siguiente paso del tutorial
  const nextStep = () => {
    const steps = Object.values(TutorialStep);
    const currentIndex = steps.indexOf(currentStep);
    
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
      setIsStepComplete(false);
    } else {
      finishTutorial();
    }
  };
  
  // Verificar si se ha completado una acción requerida para avanzar
  useEffect(() => {
    const currentStepContent = tutorialSteps[currentStep];
    
    if (currentStepContent.waitForAction) {
      switch (currentStepContent.actionType) {
        case 'convergence':
          // Verificar si se ha hecho una convergencia (la puntuación ha aumentado)
          if (score > prevScore.current) {
            setIsStepComplete(true);
          }
          break;
          
        case 'combo':
          // Verificar si se ha hecho un combo
          if (comboCount > prevComboCount.current) {
            setIsStepComplete(true);
          }
          break;
          
        default:
          break;
      }
    }
    
    // Actualizar referencias
    prevScore.current = score;
    prevIconCount.current = iconCount;
    prevComboCount.current = comboCount;
  }, [score, iconCount, comboCount, currentStep, tutorialSteps]);
  
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
  }, [currentStep, dispatch, board]);
  
  // Verificar que estamos en modo tutorial
  useEffect(() => {
    if (currentPlayMode !== 'tutorial' && status === 'playing') {
      console.warn('GameTutorial: No estamos en modo tutorial pero el componente está activo');
    }
  }, [currentPlayMode, status]);
  
  return (
    <>
      {/* Overlay principal del tutorial */}
      {showTutorialUI && (
        <div 
          className={`tutorial-overlay ${tutorialSteps[currentStep].waitForAction ? 'interactive' : ''}`} 
          ref={tutorialOverlayRef}
        >
          <div className="tutorial-card">
            <h2 className="tutorial-title">{tutorialSteps[currentStep].title}</h2>
            <div className="tutorial-content">
              {tutorialSteps[currentStep].content}
            </div>
            {isStepComplete && tutorialSteps[currentStep].waitForAction && (
              <div className="tutorial-success-message">
                ¡Perfecto! Avanzando al siguiente paso...
              </div>
            )}
          </div>
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
