import React, { useState, useEffect, useRef } from 'react';
import { GameState } from '../../../store/slices/gameSlice';
import './LevelCompleteModal.css';

// Definición de GameStats si no existe
interface GameStats {
  score: number;
  timeFormatted: string;
  maxCombo: number;
  moves: number;
  averageSpeed: number;
}

// Tipos para las recompensas
type RewardType = 'coins' | 'gems' | 'xp' | 'item' | 'character' | 'skill';
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

interface Reward {
  type: RewardType;
  amount: number;
  name: string;
  icon: string;
  rarity: Rarity;
}

interface NextLevelPreview {
  level: number;
  difficulty: number;
  newIcons: string[];
  objectives: {
    description: string;
    target: string;
    icon: string;
  }[];
}

interface LevelCompleteModalProps {
  isVisible: boolean;
  onClose: () => void;
  onContinue: () => void;
  onMainMenu: () => void;
  gameStats: GameStats;
  levelNumber: number;
  nextLevel: number;
  starsEarned: number;
  rewards: Reward[];
  nextLevelPreview?: NextLevelPreview;
}

const LevelCompleteModal: React.FC<LevelCompleteModalProps> = ({
  isVisible,
  onClose,
  onContinue,
  onMainMenu,
  gameStats = {
    score: 0,
    timeFormatted: '00:00',
    maxCombo: 0,
    moves: 0,
    averageSpeed: 0
  }, // Valor por defecto para gameStats
  levelNumber = 1,
  nextLevel = 2,
  starsEarned = 0,
  rewards = [],
  nextLevelPreview
}) => {
  const [closing, setClosing] = useState(false);
  const [activeTab, setActiveTab] = useState<'results' | 'preview'>('results');
  const modalRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  
  // Función para ajustar el alto del viewport en dispositivos móviles
  const setViewportHeight = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  useEffect(() => {
    // Ajustar viewport para dispositivos móviles
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    
    // Limpiar event listener
    return () => {
      window.removeEventListener('resize', setViewportHeight);
    };
  }, []);

  // Manejar el cierre con animación
  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      onClose();
      setClosing(false);
    }, 300);
  };
  
  // Crear confeti al mostrar el modal
  useEffect(() => {
    if (isVisible && confettiRef.current) {
      createConfetti();
    }
  }, [isVisible]);
  
  // Crear efecto de confeti
  const createConfetti = () => {
    if (!confettiRef.current) return;
    
    // Reducir la cantidad de confeti en pantallas pequeñas
    const confettiCount = window.innerWidth < 500 ? 20 : 35;
    
    // Limpiar confeti anterior
    while (confettiRef.current.firstChild) {
      confettiRef.current.removeChild(confettiRef.current.firstChild);
    }
    
    const colors = ['#4CAF50', '#FFC107', '#2196F3', '#E91E63', '#FFEB3B', '#3F51B5'];
    
    // Crear piezas de confeti
    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      
      // Estilos aleatorios para cada pieza
      const color = colors[Math.floor(Math.random() * colors.length)];
      const left = Math.random() * 100 + '%';
      const size = Math.random() * 8 + 5 + 'px';
      const delay = Math.random() * 3 + 's';
      const duration = (Math.random() * 2 + 3) + 's';
      
      confetti.style.left = left;
      confetti.style.width = size;
      confetti.style.height = size;
      confetti.style.backgroundColor = color;
      confetti.style.animationDelay = delay;
      confetti.style.animationDuration = duration;
      
      // Formas aleatorias para el confeti
      const shapes = ['square', 'circle', 'triangle'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      
      if (shape === 'circle') {
        confetti.style.borderRadius = '50%';
      } else if (shape === 'triangle') {
        confetti.style.width = '0';
        confetti.style.height = '0';
        confetti.style.backgroundColor = 'transparent';
        confetti.style.borderLeft = size + ' solid transparent';
        confetti.style.borderRight = size + ' solid transparent';
        confetti.style.borderBottom = size + ' solid ' + color;
      }
      
      confettiRef.current.appendChild(confetti);
    }
  };
  
  // Generar iconos flotantes
  const floatingIcons = () => {
    // Reducir la cantidad de iconos
    const icons = ['🏆', '⭐', '🎉', '🚀', '🌟'];
    const numIcons = Math.min(7, window.innerWidth < 500 ? 3 : 5);
    
    const renderedIcons = [];
    for (let i = 0; i < numIcons; i++) {
      const icon = icons[Math.floor(Math.random() * icons.length)];
      const delay = Math.random() * 2;
      const duration = Math.random() * 2 + 2;
      const top = 5 + Math.random() * 20; // Limitamos a la parte superior
      const left = 5 + Math.random() * 90;
      
      renderedIcons.push(
        <div 
          key={i}
          className="floating-icon"
          style={{
            position: 'absolute',
            top: `${top}%`,
            left: `${left}%`,
            fontSize: `${Math.random() * 1.2 + 0.8}em`,
            opacity: 0.4,
            filter: 'blur(0.5px)',
            animation: `float ${duration}s ease-in-out ${delay}s infinite`,
            zIndex: 0 // Menor z-index para que no cubra el contenido
          }}
        >
          {icon}
        </div>
      );
    }
    
    return <>{renderedIcons}</>;
  };
  
  // Determinar la clase de combo
  const getComboClass = (combo: number) => {
    if (combo >= 20) return 'combo-legendary-text';
    if (combo >= 15) return 'combo-epic-text';
    if (combo >= 10) return 'combo-rare-text';
    if (combo >= 5) return 'combo-uncommon-text';
    return 'combo-basic-text';
  };
  
  // Obtener iconos para las estadísticas
  const getStatIcon = (statType: string) => {
    switch (statType) {
      case 'score': return '🏆';
      case 'time': return '⏱️';
      case 'combo': return '⚡';
      case 'moves': return '👣';
      case 'speed': return '🚀';
      default: return '📊';
    }
  };
  
  // Si el modal no está visible, no renderizar nada
  if (!isVisible && !closing) {
    return null;
  }
  
  return (
    <div 
      className={`game-modal fullscreen-modal ${isVisible ? 'visible' : ''} ${closing ? 'closing' : ''}`}
      onClick={handleClose}
    >
      <div 
        ref={modalRef}
        className={`level-complete-content ${isVisible && !closing ? 'animate-in' : ''}`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Fondo con efectos */}
        <div className="level-complete-background"></div>
        
        {/* Contenedor de confeti */}
        <div ref={confettiRef} className="confetti-container"></div>
        
        {/* Iconos flotantes - ahora están detrás del contenido */}
        {floatingIcons()}
        
        {/* Encabezado */}
        <div className="level-header">
          <div className="level-transition">
            <span className="previous-level">N{levelNumber}</span>
            <span className="level-arrow">→</span>
            <span className="next-level pulse-animation">N{nextLevel}</span>
          </div>
          <div className="stars-container">
            {[1, 2, 3].map((star) => (
              <div 
                key={star} 
                className={`level-star ${star <= starsEarned ? 'earned' : ''}`}
                style={{ '--delay': `${(star - 1) * 0.2}s` } as React.CSSProperties}
              >
                ⭐
              </div>
            ))}
          </div>
        </div>
        
        {/* Pestañas de navegación */}
        <div className="modal-tabs">
          <button 
            className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
          >
            Resultados
          </button>
          <button 
            className={`tab-button ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Siguiente nivel
          </button>
        </div>
        
        {/* Secciones principales - aumentado z-index */}
        <div className="modal-sections">
          {/* Sección de resultados */}
          {activeTab === 'results' && (
            <div className="results-section">
              <div className="victory-banner">
                <div className="victory-icon">🏆</div>
                <h2 className="victory-title">¡NIVEL COMPLETADO!</h2>
              </div>
              
              {/* Estadísticas principales */}
              <div className="main-stats">
                <div className="stat-card score">
                  <div className="stat-icon-badge">{getStatIcon('score')}</div>
                  <div className="stat-value">{gameStats?.score || 0}</div>
                  <div className="stat-label">PUNTOS</div>
                </div>
                <div className="stat-card time">
                  <div className="stat-icon-badge">{getStatIcon('time')}</div>
                  <div className="stat-value">{gameStats?.timeFormatted || '00:00'}</div>
                  <div className="stat-label">TIEMPO</div>
                </div>
                <div className="stat-card combo">
                  <div className="stat-icon-badge">{getStatIcon('combo')}</div>
                  <div className={`stat-value ${getComboClass(gameStats?.maxCombo || 0)}`}>
                    {gameStats?.maxCombo || 0}x
                  </div>
                  <div className="stat-label">COMBO</div>
                </div>
              </div>
              
              {/* Estadísticas detalladas */}
              <div className="detailed-stats compact">
                <div className="stat-row">
                  <span className="stat-icon">{getStatIcon('moves')}</span>
                  <span className="stat-label">MOVIMIENTOS</span>
                  <span className="stat-value">{gameStats?.moves || 0}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-icon">{getStatIcon('speed')}</span>
                  <span className="stat-label">VELOCIDAD</span>
                  <span className="stat-value">{(gameStats?.averageSpeed || 0).toFixed(1)}/s</span>
                </div>
              </div>
              
              {/* Sección de recompensas */}
              <div className="rewards-section">
                <h3 className="section-title">Recompensas</h3>
                <div className="rewards-grid adaptive">
                  {(rewards || []).map((reward, index) => (
                    <div key={index} className={`reward-card ${reward.rarity}`}>
                      <div className="reward-icon">{reward.icon}</div>
                      <div className="reward-amount">+{reward.amount}</div>
                      <div className="reward-name">{reward.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Sección de vista previa */}
          {activeTab === 'preview' && nextLevelPreview && (
            <div className="preview-section compact">
              <h3 className="section-title">Nivel {nextLevelPreview.level}</h3>
              
              {/* Indicador de dificultad */}
              <div className="difficulty-indicator">
                <span>Dificultad:</span>
                <div className="difficulty-bars">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div 
                      key={level}
                      className={`difficulty-bar ${level <= nextLevelPreview.difficulty ? 'active' : ''}`}
                    ></div>
                  ))}
                </div>
              </div>
              
              {/* Nuevos iconos */}
              {nextLevelPreview.newIcons.length > 0 && (
                <div className="new-icons-preview compact">
                  <div className="preview-subtitle">Nuevos iconos:</div>
                  <div className="icons-grid compact">
                    {nextLevelPreview.newIcons.map((icon, index) => (
                      <div key={index} className="new-icon-card">
                        {icon}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Objetivos */}
              <div className="level-objectives compact">
                <div className="preview-subtitle">Objetivos:</div>
                <div className="objectives-list">
                  {nextLevelPreview.objectives.map((objective, index) => (
                    <div key={index} className="objective-item">
                      <div className="objective-icon">{objective.icon}</div>
                      <div className="objective-desc">{objective.description}</div>
                      <div className="objective-target">{objective.target}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Botones de acción */}
          <div className="action-buttons">
            <button className="continue-button pulse-animation" onClick={onContinue}>
              Siguiente nivel
            </button>
            <button className="menu-button" onClick={onMainMenu}>
              Menú
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LevelCompleteModal;