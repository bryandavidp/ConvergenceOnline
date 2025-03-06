import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../../store/store';
import {
  GameStatus,
  GamePlayMode,
  GameDifficulty,
  setBoardSize,
  setBoard,
  setAnimationMode
} from '../../../store/slices/gameSlice';
import GameBoard from '../GameBoard/GameBoard';
import GameControls from '../../game/GameControls/GameControls';
import useFpsDetector from '../../../hooks/useFpsDetector';
import { screenStyles } from './styles/screenStyles';
import { generateBoard } from '../../../utils/gameUtils';
import { colors, fontSizes, spacing } from '../../../utils/theme';

/**
 * Pantalla principal del tablero de juego.
 * Incluye controles y configuración del juego.
 */
const GameBoardScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { fps, useLiteAnimations, setAnimationMode: setAnimMode } = useFpsDetector();
  
  // Obtener estado del juego desde Redux
  const {
    status,
    score,
    level,
    currentPlayMode,
    currentDifficulty,
    boardSize,
    timeRemaining,
  } = useSelector((state: RootState) => state.game);
  
  const [showSettings, setShowSettings] = useState<boolean>(false);
  
  // Inicializar tablero cuando cambian parámetros
  useEffect(() => {
    // Generar nuevo tablero según tamaño
    const newBoard = generateBoard(boardSize, level);
    dispatch(setBoard(newBoard));
  }, [boardSize, level, dispatch, currentPlayMode, currentDifficulty]);

  // Sincronizar preferencia de animación con el estado global
  useEffect(() => {
    dispatch(setAnimationMode(useLiteAnimations));
  }, [useLiteAnimations, dispatch]);
  
  /**
   * Muestra u oculta el panel de configuración
   */
  const toggleSettings = () => {
    setShowSettings(prev => !prev);
  };
  
  /**
   * Cambia el modo de juego
   */
  const handleModeChange = (mode: GamePlayMode) => {
    // Lógica para cambiar el modo de juego
    console.log('Modo cambiado a:', mode);
  };
  
  /**
   * Cambia la dificultad del juego
   */
  const handleDifficultyChange = (difficulty: GameDifficulty) => {
    // Lógica para cambiar la dificultad
    console.log('Dificultad cambiada a:', difficulty);
  };
  
  /**
   * Cambia el tamaño del tablero
   */
  const handleBoardSizeChange = (size: number) => {
    dispatch(setBoardSize(size));
  };
  
  /**
   * Cambia el modo de animación
   */
  const handleAnimationModeChange = (lite: boolean) => {
    setAnimMode(lite);
  };
  
  return (
    <View style={screenStyles.container}>
      {/* Cabecera con título e información */}
      <View style={screenStyles.header}>
        <Text style={screenStyles.title}>Convergence</Text>
        <Text style={screenStyles.subtitle}>
          Modo: {currentPlayMode} - Dificultad: {currentDifficulty}
        </Text>
        
        {fps !== null && (
          <Text style={styles.fpsText}>
            FPS: {fps} {useLiteAnimations ? '(Animaciones Lite)' : ''}
          </Text>
        )}
      </View>
      
      {/* Información de puntuación y nivel */}
      <View style={screenStyles.infoRow}>
        <View style={screenStyles.scoreContainer}>
          <Text style={screenStyles.scoreLabel}>Puntuación</Text>
          <Text style={screenStyles.scoreText}>{score}</Text>
        </View>
        
        <View style={screenStyles.levelContainer}>
          <Text style={screenStyles.levelLabel}>Nivel</Text>
          <Text style={screenStyles.levelText}>{level}</Text>
        </View>
      </View>
      
      {/* Botón de configuración */}
      <TouchableOpacity 
        style={styles.settingsButton} 
        onPress={toggleSettings}
      >
        <Text style={styles.settingsButtonText}>
          {showSettings ? 'Ocultar Configuración' : 'Mostrar Configuración'}
        </Text>
      </TouchableOpacity>
      
      {/* Panel de configuración */}
      {showSettings && (
        <ScrollView style={screenStyles.settingsPanel}>
          <View style={screenStyles.settingsPanelContent}>
            <Text style={styles.settingsHeader}>Configuración del Juego</Text>
            
            {/* Modos de juego */}
            <Text style={styles.settingsSubHeader}>Modo de Juego</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  currentPlayMode === GamePlayMode.CLASSIC && styles.selectedOptionButton
                ]}
                onPress={() => handleModeChange(GamePlayMode.CLASSIC)}
              >
                <Text style={styles.optionButtonText}>Clásico</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  currentPlayMode === GamePlayMode.TIMED && styles.selectedOptionButton
                ]}
                onPress={() => handleModeChange(GamePlayMode.TIMED)}
              >
                <Text style={styles.optionButtonText}>Contrarreloj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  currentPlayMode === GamePlayMode.COMPETITIVE && styles.selectedOptionButton
                ]}
                onPress={() => handleModeChange(GamePlayMode.COMPETITIVE)}
              >
                <Text style={styles.optionButtonText}>Competitivo</Text>
              </TouchableOpacity>
            </View>
            
            {/* Dificultad */}
            <Text style={styles.settingsSubHeader}>Dificultad</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  currentDifficulty === GameDifficulty.EASY && styles.selectedOptionButton
                ]}
                onPress={() => handleDifficultyChange(GameDifficulty.EASY)}
              >
                <Text style={styles.optionButtonText}>Fácil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  currentDifficulty === GameDifficulty.MEDIUM && styles.selectedOptionButton
                ]}
                onPress={() => handleDifficultyChange(GameDifficulty.MEDIUM)}
              >
                <Text style={styles.optionButtonText}>Media</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  currentDifficulty === GameDifficulty.HARD && styles.selectedOptionButton
                ]}
                onPress={() => handleDifficultyChange(GameDifficulty.HARD)}
              >
                <Text style={styles.optionButtonText}>Difícil</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  currentDifficulty === GameDifficulty.EXPERT && styles.selectedOptionButton
                ]}
                onPress={() => handleDifficultyChange(GameDifficulty.EXPERT)}
              >
                <Text style={styles.optionButtonText}>Experto</Text>
              </TouchableOpacity>
            </View>
            
            {/* Tamaño del tablero */}
            <Text style={styles.settingsSubHeader}>Tamaño del Tablero</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  boardSize === 6 && styles.selectedOptionButton
                ]}
                onPress={() => handleBoardSizeChange(6)}
              >
                <Text style={styles.optionButtonText}>6x6</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  boardSize === 8 && styles.selectedOptionButton
                ]}
                onPress={() => handleBoardSizeChange(8)}
              >
                <Text style={styles.optionButtonText}>8x8</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  boardSize === 10 && styles.selectedOptionButton
                ]}
                onPress={() => handleBoardSizeChange(10)}
              >
                <Text style={styles.optionButtonText}>10x10</Text>
              </TouchableOpacity>
            </View>
            
            {/* Modo de animación */}
            <Text style={styles.settingsSubHeader}>Calidad de Animaciones</Text>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  !useLiteAnimations && styles.selectedOptionButton
                ]}
                onPress={() => handleAnimationModeChange(false)}
              >
                <Text style={styles.optionButtonText}>Animaciones completas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  useLiteAnimations && styles.selectedOptionButton
                ]}
                onPress={() => handleAnimationModeChange(true)}
              >
                <Text style={styles.optionButtonText}>Modo ligero</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
      
      {/* Tablero de juego */}
      <View style={screenStyles.gameContainer}>
        <GameBoard />
      </View>
      
      {/* Controles del juego */}
      <GameControls />
    </View>
  );
};

// Estilos locales para complementar screenStyles
const styles = StyleSheet.create({
  settingsButton: {
    backgroundColor: colors.secondaryButton,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignSelf: 'center',
    marginVertical: spacing.sm,
  },
  settingsButtonText: {
    color: colors.textLight,
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  fpsText: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  optionButton: {
    backgroundColor: colors.secondaryButton,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    margin: 4,
  },
  selectedOptionButton: {
    backgroundColor: colors.primary,
  },
  optionButtonText: {
    color: colors.textLight,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  settingsHeader: {
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: 10,
    textAlign: 'center',
  },
  settingsSubHeader: {
    fontSize: fontSizes.md,
    fontWeight: 'bold',
    color: colors.textLight,
    marginTop: 10,
    marginBottom: 5,
  }
});

export default GameBoardScreen;