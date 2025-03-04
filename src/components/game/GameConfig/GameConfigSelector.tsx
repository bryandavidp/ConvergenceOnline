import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store';
import useGameLogic from '../../../hooks/useGameLogic';
import { GameDifficulty, GamePlayMode } from '../../../store/slices/gameSlice';
import * as config from '../../../utils/config';
import styles from './GameConfigSelector.module.css';

interface GameConfigSelectorProps {
  onApplyConfig?: (difficulty: GameDifficulty, mode: GamePlayMode) => void;
}

const GameConfigSelector: React.FC<GameConfigSelectorProps> = ({ onApplyConfig }) => {
  const dispatch = useDispatch();
  const { currentDifficulty, currentPlayMode, status } = useSelector((state: RootState) => state.game);
  const { changeGameConfig } = useGameLogic();
  
  // Estados locales para dificultad y modo seleccionados
  const [selectedDifficulty, setSelectedDifficulty] = useState<GameDifficulty>(currentDifficulty);
  const [selectedMode, setSelectedMode] = useState<GamePlayMode>(currentPlayMode);
  
  // Manejadores de cambio
  const handleDifficultyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDifficulty(e.target.value as GameDifficulty);
  };
  
  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMode(e.target.value as GamePlayMode);
  };
  
  // Aplicar configuración seleccionada
  const applyConfig = () => {
    console.log('Aplicando config:', selectedDifficulty, selectedMode);
    
    // Solo permitir cambios si el juego no está en curso
    if (status === 'startScreen' || status === 'paused' || status === 'gameOver' || status === 'levelCompleted' || status === 'idle') {
      if (onApplyConfig) {
        // Si se proporcionó la función onApplyConfig, utilizarla
        onApplyConfig(selectedDifficulty, selectedMode);
      } else if (changeGameConfig) {
        // Si no, usar directamente changeGameConfig del hook
        changeGameConfig(selectedDifficulty, selectedMode);
      }
    } else {
      // Estamos en estado 'playing', mostrar confirmación
      if (window.confirm('Cambiar la configuración reiniciará el juego. ¿Continuar?')) {
        if (onApplyConfig) {
          onApplyConfig(selectedDifficulty, selectedMode);
        } else if (changeGameConfig) {
          changeGameConfig(selectedDifficulty, selectedMode);
        }
      }
    }
  };
  
  // Renderizar información de la configuración
  const renderConfigInfo = () => {
    // Obtenemos la configuración combinada para mostrar información relevante
    const gameConfig = config.getGameConfig(selectedDifficulty, selectedMode);
    
    return (
      <div className={styles.configInfo}>
        <h4>Configuración seleccionada</h4>
        <ul>
          <li>
            <span>Dificultad:</span> 
            {selectedDifficulty === 'easy' && 'Fácil'}
            {selectedDifficulty === 'normal' && 'Normal'}
            {selectedDifficulty === 'hard' && 'Difícil'}
            {selectedDifficulty === 'tutorial' && 'Tutorial'}
          </li>
          <li>
            <span>Modo:</span>
            {selectedMode === 'classic' && 'Clásico'}
            {selectedMode === 'timed' && 'Contrarreloj'}
            {selectedMode === 'survival' && 'Supervivencia'}
          </li>
          <li><span>Velocidad inicial:</span> {gameConfig.initialSpawnRate}ms</li>
          {selectedMode === 'timed' && (
            <li><span>Tiempo inicial:</span> {gameConfig.initialTimeLimit || 120} segundos</li>
          )}
          {selectedMode === 'classic' && (
            <li><span>Niveles:</span> {gameConfig.maxLevel || 5}</li>
          )}
        </ul>
      </div>
    );
  };
  
  return (
    <div className={styles.container}>
      <h3>Configuración de Juego</h3>
      
      <div className={styles.configGrid}>
        <div className={styles.configSection}>
          <label htmlFor="difficulty">Dificultad:</label>
          <select 
            id="difficulty" 
            value={selectedDifficulty} 
            onChange={handleDifficultyChange}
            className={styles.select}
          >
            <option value="easy">Fácil</option>
            <option value="normal">Normal</option>
            <option value="hard">Difícil</option>
            <option value="tutorial">Tutorial</option>
          </select>
        </div>
        
        <div className={styles.configSection}>
          <label htmlFor="mode">Modo de juego:</label>
          <select 
            id="mode" 
            value={selectedMode} 
            onChange={handleModeChange}
            className={styles.select}
          >
            <option value="classic">Clásico</option>
            <option value="timed">Contrarreloj</option>
            <option value="survival">Supervivencia</option>
          </select>
        </div>
      </div>
      
      {renderConfigInfo()}
      
      <button 
        onClick={applyConfig} 
        className={styles.applyButton}
      >
        Aplicar Configuración
      </button>
    </div>
  );
};

export default GameConfigSelector; 