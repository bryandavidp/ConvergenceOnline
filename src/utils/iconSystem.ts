import { GameDifficulty, GamePlayMode } from '../store/slices/gameSlice';

// Tipos básicos para el sistema de iconos
export type IconFormat = 'emoji' | 'svg' | 'image';
export type IconPackType = 'basic' | 'intermediate' | 'advanced' | 'special';

export interface IconDefinition {
  id: string;
  display: string;        // El valor que se muestra (emoji, svg path, image url)
  format: IconFormat;     // El formato del icono
  difficulty: number;     // Nivel de dificultad (1-5)
  tags: string[];        // Etiquetas para categorización
  metadata?: {           // Metadatos adicionales
    name?: string;
    description?: string;
    category?: string;
    rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  };
}

export interface IconPack {
  id: string;
  name: string;
  description: string;
  type: IconPackType;
  difficulty: number;
  icons: IconDefinition[];
  levelRange: {
    min: number;
    max: number;
  };
  tags: string[];
  metadata?: {
    theme?: string;
    unlockable?: boolean;
    special?: boolean;
  };
}

// Packs de iconos predefinidos
export const PREDEFINED_ICON_PACKS: IconPack[] = [
  {
    id: 'fruits_basic',
    name: 'Frutas Básicas',
    description: 'Pack de frutas básicas para niveles iniciales',
    type: 'basic',
    difficulty: 1,
    levelRange: { min: 1, max: 3 },
    tags: ['fruits', 'basic', 'beginner'],
    icons: [
      { id: 'apple', display: '🍎', format: 'emoji', difficulty: 1, tags: ['fruit', 'basic'] },
      { id: 'grape', display: '🍇', format: 'emoji', difficulty: 1, tags: ['fruit', 'basic'] },
      { id: 'orange', display: '🍊', format: 'emoji', difficulty: 1, tags: ['fruit', 'basic'] },
      { id: 'strawberry', display: '🍓', format: 'emoji', difficulty: 1, tags: ['fruit', 'basic'] }
    ]
  },
  {
    id: 'animals_basic',
    name: 'Animales Básicos',
    description: 'Pack de animales básicos para niveles iniciales',
    type: 'basic',
    difficulty: 1,
    levelRange: { min: 1, max: 3 },
    tags: ['animals', 'basic', 'beginner'],
    icons: [
      { id: 'dog', display: '🐶', format: 'emoji', difficulty: 1, tags: ['animal', 'basic'] },
      { id: 'cat', display: '🐱', format: 'emoji', difficulty: 1, tags: ['animal', 'basic'] },
      { id: 'mouse', display: '🐭', format: 'emoji', difficulty: 1, tags: ['animal', 'basic'] },
      { id: 'rabbit', display: '🐰', format: 'emoji', difficulty: 1, tags: ['animal', 'basic'] }
    ]
  },
  {
    id: 'symbols_intermediate',
    name: 'Símbolos Intermedios',
    description: 'Pack de símbolos para niveles intermedios',
    type: 'intermediate',
    difficulty: 2,
    levelRange: { min: 4, max: 6 },
    tags: ['symbols', 'intermediate'],
    icons: [
      { id: 'star', display: '⭐', format: 'emoji', difficulty: 2, tags: ['symbol', 'intermediate'] },
      { id: 'sparkle', display: '✨', format: 'emoji', difficulty: 2, tags: ['symbol', 'intermediate'] },
      { id: 'fire', display: '🔥', format: 'emoji', difficulty: 2, tags: ['symbol', 'intermediate'] },
      { id: 'rainbow', display: '🌈', format: 'emoji', difficulty: 2, tags: ['symbol', 'intermediate'] }
    ]
  },
  {
    id: 'food_advanced',
    name: 'Comida Avanzada',
    description: 'Pack de comida para niveles avanzados',
    type: 'advanced',
    difficulty: 3,
    levelRange: { min: 7, max: 9 },
    tags: ['food', 'advanced'],
    icons: [
      { id: 'pizza', display: '🍕', format: 'emoji', difficulty: 3, tags: ['food', 'advanced'] },
      { id: 'burger', display: '🍔', format: 'emoji', difficulty: 3, tags: ['food', 'advanced'] },
      { id: 'sushi', display: '🍣', format: 'emoji', difficulty: 3, tags: ['food', 'advanced'] },
      { id: 'ramen', display: '🍜', format: 'emoji', difficulty: 3, tags: ['food', 'advanced'] }
    ]
  },
  {
    id: 'vehicles_advanced',
    name: 'Vehículos Avanzados',
    description: 'Pack de vehículos para niveles avanzados',
    type: 'advanced',
    difficulty: 3,
    levelRange: { min: 7, max: 9 },
    tags: ['vehicles', 'advanced'],
    icons: [
      { id: 'car', display: '🚗', format: 'emoji', difficulty: 3, tags: ['vehicle', 'advanced'] },
      { id: 'bike', display: '🚲', format: 'emoji', difficulty: 3, tags: ['vehicle', 'advanced'] },
      { id: 'plane', display: '✈️', format: 'emoji', difficulty: 3, tags: ['vehicle', 'advanced'] },
      { id: 'ship', display: '🚢', format: 'emoji', difficulty: 3, tags: ['vehicle', 'advanced'] }
    ]
  },
  {
    id: 'objects_advanced',
    name: 'Objetos Avanzados',
    description: 'Pack de objetos para niveles avanzados',
    type: 'advanced',
    difficulty: 3,
    levelRange: { min: 7, max: 9 },
    tags: ['objects', 'advanced'],
    icons: [
      { id: 'book', display: '📚', format: 'emoji', difficulty: 3, tags: ['object', 'advanced'] },
      { id: 'lamp', display: '💡', format: 'emoji', difficulty: 3, tags: ['object', 'advanced'] },
      { id: 'key', display: '🔑', format: 'emoji', difficulty: 3, tags: ['object', 'advanced'] },
      { id: 'clock', display: '⏰', format: 'emoji', difficulty: 3, tags: ['object', 'advanced'] }
    ]
  }
];

// Configuración de dificultad para packs de iconos
export const ICON_PACK_DIFFICULTY_CONFIG: Record<GameDifficulty, {
  minDifficulty: number;
  maxDifficulty: number;
  packTypes: IconPackType[];
}> = {
  easy: {
    minDifficulty: 1,
    maxDifficulty: 2,
    packTypes: ['basic']
  },
  normal: {
    minDifficulty: 1,
    maxDifficulty: 3,
    packTypes: ['basic', 'intermediate']
  },
  hard: {
    minDifficulty: 3,
    maxDifficulty: 4,
    packTypes: ['intermediate', 'advanced']
  },
  tutorial: {
    minDifficulty: 1,
    maxDifficulty: 1,
    packTypes: ['basic']
  }
};

// Clase principal para gestionar el sistema de iconos
export class IconSystem {
  private static instance: IconSystem;
  private iconPacks: IconPack[] = [];
  private iconCache: Map<string, IconDefinition> = new Map();

  private constructor() {
    this.initializePacks();
  }

  public static getInstance(): IconSystem {
    if (!IconSystem.instance) {
      IconSystem.instance = new IconSystem();
    }
    return IconSystem.instance;
  }

  private initializePacks(): void {
    // Inicializar con packs predefinidos
    this.iconPacks = [...PREDEFINED_ICON_PACKS];
    
    // Crear cache de iconos
    this.iconPacks.forEach(pack => {
      pack.icons.forEach(icon => {
        this.iconCache.set(icon.id, icon);
      });
    });
  }

  // Obtener packs disponibles para un nivel específico
  public getAvailablePacks(
    level: number,
    difficulty: GameDifficulty,
    playMode: GamePlayMode
  ): IconPack[] {
    const difficultyConfig = ICON_PACK_DIFFICULTY_CONFIG[difficulty];
    
    return this.iconPacks.filter(pack => 
      pack.levelRange.min <= level && 
      pack.levelRange.max >= level &&
      difficultyConfig.packTypes.includes(pack.type)
    );
  }

  // Obtener iconos para un nivel específico
  public getIconsForLevel(
    level: number,
    difficulty: GameDifficulty,
    playMode: GamePlayMode,
    count: number = 4
  ): IconDefinition[] {
    const availablePacks = this.getAvailablePacks(level, difficulty, playMode);
    
    if (availablePacks.length === 0) {
      // Si no hay packs disponibles, generar iconos aleatorios
      return this.generateRandomIcons(count, difficulty);
    }

    // Seleccionar packs aleatorios y obtener iconos
    const selectedPacks = this.selectRandomPacks(availablePacks, Math.min(2, availablePacks.length));
    const icons: IconDefinition[] = [];

    selectedPacks.forEach(pack => {
      const packIcons = this.selectRandomIcons(pack, Math.ceil(count / selectedPacks.length));
      icons.push(...packIcons);
    });

    return icons.slice(0, count);
  }

  // Generar iconos aleatorios cuando no hay packs disponibles
  private generateRandomIcons(count: number, difficulty: GameDifficulty): IconDefinition[] {
    const difficultyConfig = ICON_PACK_DIFFICULTY_CONFIG[difficulty];
    const allIcons = Array.from(this.iconCache.values());
    
    const availableIcons = allIcons.filter(icon => 
      icon.difficulty >= difficultyConfig.minDifficulty &&
      icon.difficulty <= difficultyConfig.maxDifficulty
    );

    return this.selectRandomIconsFromArray(availableIcons, count);
  }

  // Seleccionar packs aleatorios
  private selectRandomPacks(packs: IconPack[], count: number): IconPack[] {
    const shuffled = [...packs].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Seleccionar iconos aleatorios de un pack
  private selectRandomIcons(pack: IconPack, count: number): IconDefinition[] {
    return this.selectRandomIconsFromArray(pack.icons, count);
  }

  // Seleccionar iconos aleatorios de un array
  private selectRandomIconsFromArray(icons: IconDefinition[], count: number): IconDefinition[] {
    const shuffled = [...icons].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Añadir un nuevo pack de iconos
  public addIconPack(pack: IconPack): void {
    this.iconPacks.push(pack);
    pack.icons.forEach(icon => {
      this.iconCache.set(icon.id, icon);
    });
  }

  // Obtener un icono por ID
  public getIconById(id: string): IconDefinition | undefined {
    return this.iconCache.get(id);
  }

  // Obtener todos los packs disponibles
  public getAllPacks(): IconPack[] {
    return [...this.iconPacks];
  }

  // Obtener packs por tipo
  public getPacksByType(type: IconPackType): IconPack[] {
    return this.iconPacks.filter(pack => pack.type === type);
  }

  // Obtener packs por rango de niveles
  public getPacksByLevelRange(min: number, max: number): IconPack[] {
    return this.iconPacks.filter(pack => 
      pack.levelRange.min <= max && pack.levelRange.max >= min
    );
  }
} 