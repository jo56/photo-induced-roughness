import React, { useCallback, useEffect, useRef, useState } from 'react';


const GRID_COLOR = '#2e1f20';

function createEmptyGrid(rows: number, cols: number): number[][] {
  const g: number[][] = [];
  for (let r = 0; r < rows; r++) {
    g[r] = new Array(cols).fill(0);
  }
  return g;
}

function cloneGrid(grid: number[][]): number[][] {
  const newGrid = new Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    newGrid[i] = new Array(grid[i].length);
    for (let j = 0; j < grid[i].length; j++) {
      newGrid[i][j] = grid[i][j];
    }
  }
  return newGrid;
}

function RuleEditor({ label, rules, onChange }: { label: string, rules: number[], onChange: (rules: number[]) => void }) {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8];

    const handleToggle = (num: number) => {
        const newRules = rules.includes(num)
            ? rules.filter(r => r !== num)
            : [...rules, num];
        onChange(newRules.sort((a, b) => a - b));
    };

    return (
        <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>{label}:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {numbers.map(num => (
                    <label key={num} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: '#241a1c', border: '1px solid #4a6b4f', padding: '4px 8px', borderRadius: '4px', userSelect: 'none' }}>
                        <input
                            type="checkbox"
                            checked={rules.includes(num)}
                            onChange={() => handleToggle(num)}
                            style={{ marginRight: '6px', cursor: 'pointer' }}
                        />
                        {num}
                    </label>
                ))}
            </div>
        </div>
    );
}

type Direction = 'up' | 'down' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type SpreadPattern = 'random' | 'conway' | 'pulse' | 'directional' | 'tendrils' | 'vein' | 'crystallize' | 'erosion' | 'flow' | 'jitter' | 'vortex' | 'strobe' | 'scramble' | 'ripple';



export default function RoughImageGenerator(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isMouseDown = useRef(false);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const autoDotsRef = useRef<number | null>(null);
  const autoShapesRef = useRef<number | null>(null);
  const dotsRunningRef = useRef(false);
  const shapesRunningRef = useRef(false);
  const pressedKeys = useRef(new Set<string>());
  const walkers = useRef<{r: number, c: number, color: number}[]>([]);
  const strobeStateRef = useRef(true); // true: expand, false: contract
  const ripplesRef = useRef<{r: number, c: number, color: number, radius: number, maxRadius: number}[]>([]);

  const defaults = {
    cellSize: 2,
    rows: 375,
    cols: 375,
    showGrid: false,
    backgroundColor: '#0f0a0b',
    selectedColor: 1,
    spreadProbability: 0.3,
    autoSpreadSpeed: 3,
    blendMode: 'replace',
    spreadPattern: 'random' as SpreadPattern,
    pulseSpeed: 10,
    pulseOvertakes: true,
    pulseDirection: 'bottom-right' as Direction,
    directionalBias: 'down' as Direction,
    conwayRules: { born: [3], survive: [2,3] },
    tendrilsRules: { born: [1], survive: [1,2] },
    directionalBiasStrength: 0.8,
    randomWalkSpreadCount: 1,
    randomWalkMode: 'any' as const,
    veinSeekStrength: 0.5,
    veinBranchChance: 0.15,
    crystallizeThreshold: 2,
    erosionRate: 0.3,
    erosionSolidity: 4,
    flowDirection: 'down' as Direction,
    flowChance: 0.7,
    jitterChance: 0.4,
    vortexCount: 8,
    strobeExpandThreshold: 2,
    strobeContractThreshold: 4,
    scrambleSwaps: 15,
    rippleChance: 0.15,
  };

  const [palette, setPalette] = useState([
    '#000000', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', 
    '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'
  ]);

  const [cellSize, setCellSize] = useState(defaults.cellSize);
  const [rows, setRows] = useState(defaults.rows);
  const [cols, setCols] = useState(defaults.cols);
  const [grid, setGrid] = useState<number[][]>(() => createEmptyGrid(defaults.rows, defaults.cols));
  const [showGrid, setShowGrid] = useState(defaults.showGrid);
  const [backgroundColor, setBackgroundColor] = useState(defaults.backgroundColor);
  const [selectedColor, setSelectedColor] = useState(defaults.selectedColor);
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [originalGrid, setOriginalGrid] = useState<number[][] | null>(null);
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const [pendingImage, setPendingImage] = useState<HTMLImageElement | null>(null);
  const [suggestedSize, setSuggestedSize] = useState({ width: 0, height: 0 });
  const [spreadProbability, setSpreadProbability] = useState(defaults.spreadProbability);
  const [autoSpreadSpeed, setAutoSpreadSpeed] = useState(defaults.autoSpreadSpeed);
  const [autoSpreading, setAutoSpreading] = useState(false);
  const [autoSpreadEnabled, setAutoSpreadEnabled] = useState(true);
  const [autoDots, setAutoDots] = useState(false);
  const [autoDotsEnabled, setAutoDotsEnabled] = useState(true);
  const [autoDotsSpeed, setAutoDotsSpeed] = useState(defaults.autoDotsSpeed || 1);
  const [autoShapes, setAutoShapes] = useState(false);
  const [autoShapesEnabled, setAutoShapesEnabled] = useState(true);
  const [autoShapesSpeed, setAutoShapesSpeed] = useState(defaults.autoShapesSpeed || 1);
  const [blendMode, setBlendMode] = useState(defaults.blendMode);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [showSpeedSettings, setShowSpeedSettings] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);
  const [showVisualSettings, setShowVisualSettings] = useState(false);
  const [showGenerativeSettings, setShowGenerativeSettings] = useState(false);
  const [showStepControls, setShowStepControls] = useState(false);
  const [showAutoControls, setShowAutoControls] = useState(true);
  const [showOptions, setShowOptions] = useState(true);
  const [customColor, setCustomColor] = useState('#ffffff');
  const [isSavingColor, setIsSavingColor] = useState(false);
  const [spreadPattern, setSpreadPattern] = useState<SpreadPattern>(defaults.spreadPattern);
  const [pulseSpeed, setPulseSpeed] = useState(defaults.pulseSpeed);
  const [directionalBias, setDirectionalBias] = useState<'none' | Direction>(defaults.directionalBias);
  const [conwayRules, setConwayRules] = useState(defaults.conwayRules);
  const [tendrilsRules, setTendrilsRules] = useState(defaults.tendrilsRules);
  const [directionalBiasStrength, setDirectionalBiasStrength] = useState(defaults.directionalBiasStrength);
  const [pulseOvertakes, setPulseOvertakes] = useState(defaults.pulseOvertakes);
  const [pulseDirection, setPulseDirection] = useState<Direction>(defaults.pulseDirection);
  const [randomWalkSpreadCount, setRandomWalkSpreadCount] = useState(defaults.randomWalkSpreadCount);
  const [randomWalkMode, setRandomWalkMode] = useState<'any' | 'cardinal'>(defaults.randomWalkMode);
  const [veinSeekStrength, setVeinSeekStrength] = useState(defaults.veinSeekStrength);
  const [veinBranchChance, setVeinBranchChance] = useState(defaults.veinBranchChance);
  const [crystallizeThreshold, setCrystallizeThreshold] = useState(defaults.crystallizeThreshold);
  const [erosionRate, setErosionRate] = useState(defaults.erosionRate);
  const [erosionSolidity, setErosionSolidity] = useState(defaults.erosionSolidity);
  const [flowDirection, setFlowDirection] = useState<Direction>(defaults.flowDirection);
  const [flowChance, setFlowChance] = useState(defaults.flowChance);
  const [jitterChance, setJitterChance] = useState(defaults.jitterChance);
  const [vortexCount, setVortexCount] = useState(defaults.vortexCount);
  const [strobeExpandThreshold, setStrobeExpandThreshold] = useState(defaults.strobeExpandThreshold);
  const [strobeContractThreshold, setStrobeContractThreshold] = useState(defaults.strobeContractThreshold);
  const [scrambleSwaps, setScrambleSwaps] = useState(defaults.scrambleSwaps);
  const [rippleChance, setRippleChance] = useState(defaults.rippleChance);

  const spreadProbabilityRef = useRef(spreadProbability);
  const autoSpreadSpeedRef = useRef(autoSpreadSpeed);
  const autoDotsSpeedRef = useRef(autoDotsSpeed);
  const autoShapesSpeedRef = useRef(autoShapesSpeed);
  const rowsRef = useRef(rows);
  const colsRef = useRef(cols);
  const spreadPatternRef = useRef(spreadPattern);
  const pulseSpeedRef = useRef(pulseSpeed);
  const directionalBiasRef = useRef(directionalBias);
  const conwayRulesRef = useRef(conwayRules);
  const tendrilsRulesRef = useRef(tendrilsRules);
  const directionalBiasStrengthRef = useRef(directionalBiasStrength);
  const pulseOvertakesRef = useRef(pulseOvertakes);
  const pulseDirectionRef = useRef(pulseDirection);
  const randomWalkSpreadCountRef = useRef(randomWalkSpreadCount);
  const randomWalkModeRef = useRef(randomWalkMode);
  const veinSeekStrengthRef = useRef(veinSeekStrength);
  const veinBranchChanceRef = useRef(veinBranchChance);
  const crystallizeThresholdRef = useRef(crystallizeThreshold);
  const erosionRateRef = useRef(erosionRate);
  const erosionSolidityRef = useRef(erosionSolidity);
  const flowDirectionRef = useRef(flowDirection);
  const flowChanceRef = useRef(flowChance);
  const jitterChanceRef = useRef(jitterChance);
  const vortexCountRef = useRef(vortexCount);
  const strobeExpandThresholdRef = useRef(strobeExpandThreshold);
  const strobeContractThresholdRef = useRef(strobeContractThreshold);
  const scrambleSwapsRef = useRef(scrambleSwaps);
  const rippleChanceRef = useRef(rippleChance);
  
  useEffect(() => { spreadProbabilityRef.current = spreadProbability; }, [spreadProbability]);
  useEffect(() => { autoSpreadSpeedRef.current = autoSpreadSpeed; }, [autoSpreadSpeed]);
  useEffect(() => { autoDotsSpeedRef.current = autoDotsSpeed; }, [autoDotsSpeed]);
  useEffect(() => { autoShapesSpeedRef.current = autoShapesSpeed; }, [autoShapesSpeed]);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  useEffect(() => { colsRef.current = cols; }, [cols]);
  useEffect(() => { spreadPatternRef.current = spreadPattern; }, [spreadPattern]);
  useEffect(() => { pulseSpeedRef.current = pulseSpeed; }, [pulseSpeed]);
  useEffect(() => { directionalBiasRef.current = directionalBias; }, [directionalBias]);
  useEffect(() => { conwayRulesRef.current = conwayRules; }, [conwayRules]);
  useEffect(() => { tendrilsRulesRef.current = tendrilsRules; }, [tendrilsRules]);
  useEffect(() => { directionalBiasStrengthRef.current = directionalBiasStrength; }, [directionalBiasStrength]);
  useEffect(() => { pulseOvertakesRef.current = pulseOvertakes; }, [pulseOvertakes]);
  useEffect(() => { pulseDirectionRef.current = pulseDirection; }, [pulseDirection]);
  useEffect(() => { randomWalkSpreadCountRef.current = randomWalkSpreadCount; }, [randomWalkSpreadCount]);
  useEffect(() => { randomWalkModeRef.current = randomWalkMode; }, [randomWalkMode]);
  useEffect(() => { veinSeekStrengthRef.current = veinSeekStrength; }, [veinSeekStrength]);
  useEffect(() => { veinBranchChanceRef.current = veinBranchChance; }, [veinBranchChance]);
  useEffect(() => { crystallizeThresholdRef.current = crystallizeThreshold; }, [crystallizeThreshold]);
  useEffect(() => { erosionRateRef.current = erosionRate; }, [erosionRate]);
  useEffect(() => { erosionSolidityRef.current = erosionSolidity; }, [erosionSolidity]);
  useEffect(() => { flowDirectionRef.current = flowDirection; }, [flowDirection]);
  useEffect(() => { flowChanceRef.current = flowChance; }, [flowChance]);
  useEffect(() => { jitterChanceRef.current = jitterChance; }, [jitterChance]);
  useEffect(() => { vortexCountRef.current = vortexCount; }, [vortexCount]);
  useEffect(() => { strobeExpandThresholdRef.current = strobeExpandThreshold; }, [strobeExpandThreshold]);
  useEffect(() => { strobeContractThresholdRef.current = strobeContractThreshold; }, [strobeContractThreshold]);
  useEffect(() => { scrambleSwapsRef.current = scrambleSwaps; }, [scrambleSwaps]);
  useEffect(() => { rippleChanceRef.current = rippleChance; }, [rippleChance]);


  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [panelPos, setPanelPos] = useState(() => {
  if (typeof window !== 'undefined') {
    return { x: 24, y: 20 };
  }
  return { x: 20, y: 20 };
});
  const mousePos = useRef({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 800;
      setIsMobile(mobile);
      if (!mobile && canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        setPanelPos(prev => ({ x: 24, y: prev.y }));
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const updateDirection = () => {
        let newDirection: Direction | null = null;
        const keys = pressedKeys.current;

        if (keys.has('KeyW') && keys.has('KeyA')) newDirection = 'top-left';
        else if (keys.has('KeyW') && keys.has('KeyD')) newDirection = 'top-right';
        else if (keys.has('KeyS') && keys.has('KeyA')) newDirection = 'bottom-left';
        else if (keys.has('KeyS') && keys.has('KeyD')) newDirection = 'bottom-right';
        else if (keys.has('KeyW')) newDirection = 'up';
        else if (keys.has('KeyS')) newDirection = 'down';
        else if (keys.has('KeyA')) newDirection = 'left';
        else if (keys.has('KeyD')) newDirection = 'right';
        
        if (newDirection) {
            const isDiagonal = newDirection.includes('-');
            const isCardinal = !isDiagonal;

            if (spreadPattern === 'pulse' && isDiagonal) {
                setPulseDirection(newDirection);
            } else if (spreadPattern === 'directional') {
                setDirectionalBias(newDirection);
            } else if (spreadPattern === 'flow' && isCardinal) {
                setFlowDirection(newDirection);
            }
        }
    };

    const keyMap: { [key: string]: string } = {
        'ArrowUp': 'KeyW', 'ArrowDown': 'KeyS', 'ArrowLeft': 'KeyA', 'ArrowRight': 'KeyD'
    };
    const relevantCodes = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];

    const handleKeyDown = (e: KeyboardEvent) => {
        if (!showGenerativeSettings || (spreadPattern !== 'pulse' && spreadPattern !== 'directional' && spreadPattern !== 'flow')) {
            return;
        }

        const code = keyMap[e.code] || e.code;
        if (!relevantCodes.includes(code) || e.repeat) return;
        
        e.preventDefault();
        pressedKeys.current.add(code);
        updateDirection();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        const code = keyMap[e.code] || e.code;
        if (relevantCodes.includes(code)) {
            pressedKeys.current.delete(code);
        }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showGenerativeSettings, spreadPattern, setPulseDirection, setDirectionalBias, setFlowDirection]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;

    // Clear canvas once
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Batch same-colored cells to reduce fillStyle changes
    const colorGroups = new Map<string, Array<{r: number, c: number}>>();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const colorIndex = grid[r]?.[c];
        if (colorIndex > 0) {
          const colorKey = colorIndex === palette.length ? customColor : palette[colorIndex];
          if (!colorGroups.has(colorKey)) {
            colorGroups.set(colorKey, []);
          }
          colorGroups.get(colorKey)!.push({r, c});
        }
      }
    }

    // Draw each color group at once
    colorGroups.forEach((cells, color) => {
      ctx.fillStyle = color;
      cells.forEach(({r, c}) => {
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      });
    });

    if (showGrid) {
      ctx.strokeStyle = GRID_COLOR;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= cols * cellSize; x += cellSize) {
        ctx.beginPath();
        ctx.moveTo(x + 0.25, 0);
        ctx.lineTo(x + 0.25, rows * cellSize);
        ctx.stroke();
      }
      for (let y = 0; y <= rows * cellSize; y += cellSize) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.25);
        ctx.lineTo(cols * cellSize, y + 0.25);
        ctx.stroke();
      }
    }
  }, [grid, rows, cols, cellSize, backgroundColor, showGrid, palette, customColor]);

  useEffect(() => draw(), [draw]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const img = new Image();
    img.onload = () => {
      // Check if image is larger than screen
      const maxWidth = Math.floor(window.innerWidth * 0.8 / cellSize);
      const maxHeight = Math.floor(window.innerHeight * 0.8 / cellSize);
      
      if (img.width > maxWidth || img.height > maxHeight) {
        // Calculate suggested size maintaining aspect ratio
        const aspectRatio = img.width / img.height;
        let newWidth = Math.min(img.width, maxWidth);
        let newHeight = Math.min(img.height, maxHeight);
        
        if (newWidth / aspectRatio > maxHeight) {
          newWidth = maxHeight * aspectRatio;
        } else {
          newHeight = newWidth / aspectRatio;
        }
        
        setSuggestedSize({ 
          width: Math.floor(newWidth), 
          height: Math.floor(newHeight) 
        });
        setPendingImage(img);
        setShowResizeDialog(true);
      } else {
        setUploadedImage(img);
        convertImageToGrid(img);
      }
    };
    img.src = URL.createObjectURL(file);
  };

  const handleResizeAccept = () => {
    if (pendingImage) {
      const scaledImage = createScaledImage(pendingImage, suggestedSize.width, suggestedSize.height);
      scaledImage.onload = () => {
        setUploadedImage(scaledImage);
        convertImageToGrid(scaledImage);
        setShowResizeDialog(false);
        setPendingImage(null);
      };
    }
  };

  const handleResizeReject = () => {
    if (pendingImage) {
      setUploadedImage(pendingImage);
      convertImageToGrid(pendingImage);
      setShowResizeDialog(false);
      setPendingImage(null);
    }
  };

  const createScaledImage = (img: HTMLImageElement, targetWidth: number, targetHeight: number): HTMLImageElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const scaledImg = new Image();
    scaledImg.src = canvas.toDataURL();
    return scaledImg;
  };

  const convertImageToGrid = (img: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use image dimensions directly for 1:1 pixel mapping
    const imageWidth = img.width;
    const imageHeight = img.height;
    
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    
    // Draw image at original size for exact pixel mapping
    ctx.drawImage(img, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
    const newGrid = createEmptyGrid(imageHeight, imageWidth);
    const newPalette = [...palette];
    const colorMap = new Map<string, number>();

    // Initialize existing palette colors in the map
    for (let i = 0; i < palette.length; i++) {
      colorMap.set(palette[i].toLowerCase(), i);
    }

    for (let r = 0; r < imageHeight; r++) {
      for (let c = 0; c < imageWidth; c++) {
        const pixelIndex = (r * imageWidth + c) * 4;
        const red = imageData.data[pixelIndex];
        const green = imageData.data[pixelIndex + 1];
        const blue = imageData.data[pixelIndex + 2];
        const alpha = imageData.data[pixelIndex + 3];

        if (alpha < 128) {
          newGrid[r][c] = 0;
        } else {
          const rgb = `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
          
          // Check if this exact color already exists
          let colorIndex = colorMap.get(rgb.toLowerCase());
          
          if (colorIndex === undefined) {
            // Color doesn't exist, add it to the palette
            colorIndex = newPalette.length;
            newPalette.push(rgb);
            colorMap.set(rgb.toLowerCase(), colorIndex);
          }

          newGrid[r][c] = colorIndex;
        }
      }
    }

    // Update grid dimensions to match image
    setRows(imageHeight);
    setCols(imageWidth);
    setPalette(newPalette);
    setGrid(newGrid);
    setOriginalGrid(cloneGrid(newGrid));
  };





  const clear = () => {
    if (originalGrid) {
      setGrid(cloneGrid(originalGrid));
    } else {
      setGrid(createEmptyGrid(rows, cols));
    }
    setIsSavingColor(false);
  };

  const colorSpread = useCallback(() => {
    const pattern = spreadPatternRef.current;
    const currentRows = rowsRef.current;
    const currentCols = colsRef.current;


    setGrid(g => {
        let ng = cloneGrid(g);

        switch (pattern) {
            case 'ripple': {
                // Update existing ripples - use fewer points for better performance
                ripplesRef.current.forEach(ripple => {
                    const r = Math.round(ripple.radius);
                    for (let i = 0; i < 360; i += 15) { // Reduced from 5 to 15 degrees
                        const angle = i * Math.PI / 180;
                        const nr = Math.round(ripple.r + r * Math.sin(angle));
                        const nc = Math.round(ripple.c + r * Math.cos(angle));
                        if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols && ng[nr][nc] === 0) {
                            ng[nr][nc] = ripple.color;
                        }
                    }
                    ripple.radius += 0.5;
                });
                
                // Filter out old ripples
                ripplesRef.current = ripplesRef.current.filter(r => r.radius <= r.maxRadius);

                // Create new ripples - sample fewer cells
                const chance = rippleChanceRef.current;
                const step = Math.max(1, Math.floor(Math.sqrt(currentRows * currentCols) / 50)); // Dynamic sampling
                for (let r = 0; r < currentRows; r += step) {
                    for (let c = 0; c < currentCols; c += step) {
                        if (g[r][c] > 0 && Math.random() < chance) {
                            ripplesRef.current.push({
                                r, c, color: g[r][c], radius: 1, maxRadius: Math.max(currentRows, currentCols) / 3
                            });
                        }
                    }
                }
                break;
            }
            case 'scramble': {
                // Scan for colored cells each time for accuracy
                const coloredCells: {r: number, c: number, color: number}[] = [];
                for (let r = 0; r < currentRows; r++) {
                    for (let c = 0; c < currentCols; c++) {
                        if (g[r][c] > 0) {
                            coloredCells.push({r, c, color: g[r][c]});
                        }
                    }
                }
                if (coloredCells.length < 2) break;

                const swaps = Math.min(scrambleSwapsRef.current, Math.floor(coloredCells.length / 2));
                for (let i = 0; i < swaps; i++) {
                    const idx1 = Math.floor(Math.random() * coloredCells.length);
                    let idx2 = Math.floor(Math.random() * coloredCells.length);
                    while (idx1 === idx2) {
                        idx2 = Math.floor(Math.random() * coloredCells.length);
                    }
                    const cell1 = coloredCells[idx1];
                    const cell2 = coloredCells[idx2];
                    
                    if (cell1 && cell2) {
                        const color1 = ng[cell1.r][cell1.c];
                        const color2 = ng[cell2.r][cell2.c];
                        ng[cell1.r][cell1.c] = color2;
                        ng[cell2.r][cell2.c] = color1;
                    }
                }
                break;
            }
            case 'vortex': {
                const count = vortexCountRef.current;
                for (let i = 0; i < count; i++) {
                    const r = 1 + Math.floor(Math.random() * (currentRows - 2));
                    const c = 1 + Math.floor(Math.random() * (currentCols - 2));
                    
                    const neighborsCoords = [
                        [r - 1, c - 1], [r - 1, c], [r - 1, c + 1],
                        [r, c + 1], [r + 1, c + 1], [r + 1, c],
                        [r + 1, c - 1], [r, c - 1]
                    ];
                    
                    const originalColors = neighborsCoords.map(([nr, nc]) => g[nr][nc]);
                    
                    // Clockwise rotation
                    neighborsCoords.forEach(([nr, nc], idx) => {
                        const sourceIndex = (idx + 7) % 8; // (idx - 1 + 8) % 8
                        ng[nr][nc] = originalColors[sourceIndex];
                    });
                }
                break;
            }
            case 'strobe': {
                strobeStateRef.current = !strobeStateRef.current;
            
                if (strobeStateRef.current) { // EXPAND
                    const expandThreshold = strobeExpandThresholdRef.current;
                    const locationsToColor = new Map<string, number>();
                    for (let r = 0; r < currentRows; r++) {
                        for (let c = 0; c < currentCols; c++) {
                            if (g[r][c] === 0) {
                                const neighborColors: number[] = [];
                                for (let dr = -1; dr <= 1; dr++) {
                                    for (let dc = -1; dc <= 1; dc++) {
                                        if (dr === 0 && dc === 0) continue;
                                        const nr = r + dr, nc = c + dc;
                                        if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols && g[nr][nc] > 0) {
                                            neighborColors.push(g[nr][nc]);
                                        }
                                    }
                                }
            
                                if (neighborColors.length >= expandThreshold) {
                                    const colorCounts = neighborColors.reduce((acc, color) => {
                                        acc[color] = (acc[color] || 0) + 1;
                                        return acc;
                                    }, {} as Record<number, number>);
                                    
                                    let dominantColor = 0;
                                    let maxCount = 0;
                                    for (const color in colorCounts) {
                                        if (colorCounts[color] > maxCount) {
                                            maxCount = colorCounts[color];
                                            dominantColor = parseInt(color);
                                        }
                                    }
                                    if(dominantColor > 0) {
                                        locationsToColor.set(`${r},${c}`, dominantColor);
                                    }
                                }
                            }
                        }
                    }
                    locationsToColor.forEach((color, key) => {
                        const [r, c] = key.split(',').map(Number);
                        ng[r][c] = color;
                    });
            
                } else { // CONTRACT
                    const contractThreshold = strobeContractThresholdRef.current;
                    for (let r = 0; r < currentRows; r++) {
                        for (let c = 0; c < currentCols; c++) {
                            if (g[r][c] > 0) {
                                let emptyNeighbors = 0;
                                for (let dr = -1; dr <= 1; dr++) {
                                    for (let dc = -1; dc <= 1; dc++) {
                                        if (dr === 0 && dc === 0) continue;
                                        const nr = r + dr, nc = c + dc;
                                        if (nr < 0 || nr >= currentRows || nc < 0 || nc >= currentCols || g[nr][nc] === 0) {
                                            emptyNeighbors++;
                                        }
                                    }
                                }
                                if (emptyNeighbors >= contractThreshold) {
                                    ng[r][c] = 0;
                                }
                            }
                        }
                    }
                }
                break;
            }
            case 'jitter': {
                const changes = new Map<string, number>();
                const empties = new Set<string>();
                const chance = jitterChanceRef.current;

                for (let r = 0; r < currentRows; r++) {
                    for (let c = 0; c < currentCols; c++) {
                        const color = g[r]?.[c];
                        if (color > 0 && Math.random() < chance) {
                            const emptyNeighbors = [];
                            for (let dr = -1; dr <= 1; dr++) {
                                for (let dc = -1; dc <= 1; dc++) {
                                    if (dr === 0 && dc === 0) continue;
                                    const nr = r + dr, nc = c + dc;
                                    if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols && g[nr][nc] === 0) {
                                        emptyNeighbors.push({nr, nc});
                                    }
                                }
                            }
                            if (emptyNeighbors.length > 0) {
                                const target = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
                                const key = `${target.nr},${target.nc}`;
                                if (!changes.has(key) && !empties.has(`${r},${c}`)) {
                                    changes.set(key, color);
                                    empties.add(`${r},${c}`);
                                }
                            }
                        }
                    }
                }
                 empties.forEach(key => {
                    const [r, c] = key.split(',').map(Number);
                    if (!changes.has(key)) ng[r][c] = 0;
                });
                changes.forEach((color, key) => {
                    const [r, c] = key.split(',').map(Number);
                    ng[r][c] = color;
                });
                break;
            }
            case 'flow': {
                const changes = new Map<string, number>();
                const empties = new Set<string>();
                const dir = flowDirectionRef.current;
                const chance = flowChanceRef.current;
                
                let r_start = 0, r_end = currentRows, r_inc = 1;
                let c_start = 0, c_end = currentCols, c_inc = 1;
        
                if (dir === 'up') { r_start = currentRows - 1; r_end = -1; r_inc = -1; }
                if (dir === 'left') { c_start = currentCols - 1; c_end = -1; c_inc = -1; }
        
                for (let r = r_start; r !== r_end; r += r_inc) {
                    for (let c = c_start; c !== c_end; c += c_inc) {
                        const color = g[r]?.[c];
                        if (color > 0 && Math.random() < chance) {
                            let dr = 0, dc = 0;
                            if (dir === 'up') dr = -1;
                            else if (dir === 'down') dr = 1;
                            else if (dir === 'left') dc = -1;
                            else if (dir === 'right') dc = 1;
        
                            const nr = r + dr;
                            const nc = c + dc;
        
                            if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols && g[nr][nc] === 0) {
                                if (!changes.has(`${nr},${nc}`)) {
                                    changes.set(`${nr},${nc}`, color);
                                    empties.add(`${r},${c}`);
                                }
                            }
                        }
                    }
                }
        
                empties.forEach(key => {
                    const [r, c] = key.split(',').map(Number);
                    if (!changes.has(key)) ng[r][c] = 0;
                });
                changes.forEach((color, key) => {
                    const [r, c] = key.split(',').map(Number);
                    ng[r][c] = color;
                });
                break;
            }
            case 'vein': {
                if (walkers.current.length === 0) {
                    for(let r = 0; r < currentRows; r++) {
                        for(let c = 0; c < currentCols; c++) {
                            if(g[r][c] > 0 && Math.random() < 0.1) {
                                walkers.current.push({r, c, color: g[r][c]});
                            }
                        }
                    }
                    if (walkers.current.length === 0) {
                        // Find all colored pixels to start walkers from
                        const coloredPixels: {r: number, c: number, color: number}[] = [];
                        for(let r = 0; r < currentRows; r++) {
                            for(let c = 0; c < currentCols; c++) {
                                if(g[r][c] > 0) {
                                    coloredPixels.push({r, c, color: g[r][c]});
                                }
                            }
                        }
                        // Start with a few random walkers if we have colored pixels
                        if (coloredPixels.length > 0) {
                            const numWalkers = Math.min(5, coloredPixels.length);
                            for (let i = 0; i < numWalkers; i++) {
                                const pixel = coloredPixels[Math.floor(Math.random() * coloredPixels.length)];
                                walkers.current.push({r: pixel.r, c: pixel.c, color: pixel.color});
                            }
                        }
                    }
                }

                const foodSources: {r: number, c: number}[] = [];
                 for(let r = 0; r < currentRows; r++) {
                    for(let c = 0; c < currentCols; c++) {
                        if (g[r][c] > 0) foodSources.push({r, c});
                    }
                }

                walkers.current.forEach(walker => {
                    let bestDir = { dr: 0, dc: 0 };
                    let bestDist = Infinity;

                    if (foodSources.length > 0 && Math.random() < veinSeekStrengthRef.current) {
                        foodSources.forEach(food => {
                            const dist = Math.hypot(walker.r - food.r, walker.c - food.c);
                            if (dist < bestDist && dist > 1) {
                                bestDist = dist;
                                bestDir = { dr: Math.sign(food.r - walker.r), dc: Math.sign(food.c - walker.c) };
                            }
                        });
                    } else {
                        bestDir = { dr: Math.floor(Math.random() * 3) - 1, dc: Math.floor(Math.random() * 3) - 1 };
                    }
                    
                    const newR = Math.max(0, Math.min(currentRows - 1, walker.r + bestDir.dr));
                    const newC = Math.max(0, Math.min(currentCols - 1, walker.c + bestDir.dc));
                    
                    walker.r = Math.floor(newR);
                    walker.c = Math.floor(newC);
                    ng[walker.r][walker.c] = walker.color;
                    
                    if (Math.random() < veinBranchChanceRef.current) {
                        walkers.current.push({...walker});
                    }
                });

                walkers.current = walkers.current.slice(0, 200); // Limit walker count
                break;
            }
            case 'crystallize': {
                for(let r = 0; r < currentRows; r++) {
                    for(let c = 0; c < currentCols; c++) {
                       if (g[r][c] === 0) { // Can only grow into empty space
                           const neighbors: number[] = [];
                           for (let dr = -1; dr <= 1; dr++) {
                               for (let dc = -1; dc <= 1; dc++) {
                                   if (dr === 0 && dc === 0) continue;
                                   const nr = r + dr, nc = c + dc;
                                   if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols && g[nr][nc] > 0) {
                                       neighbors.push(g[nr][nc]);
                                   }
                               }
                           }
                           
                           if (neighbors.length > 0) {
                               const counts: {[key:number]: number} = {};
                               neighbors.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
                               
                               for(const color in counts) {
                                   if (counts[color] >= crystallizeThresholdRef.current) {
                                       ng[r][c] = parseInt(color);
                                       break;
                                   }
                               }
                           }
                       } else if (Math.random() < 0.05) {
                           // Occasionally allow crystallization to replace existing pixels
                           const neighbors: number[] = [];
                           for (let dr = -1; dr <= 1; dr++) {
                               for (let dc = -1; dc <= 1; dc++) {
                                   if (dr === 0 && dc === 0) continue;
                                   const nr = r + dr, nc = c + dc;
                                   if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols && g[nr][nc] > 0 && g[nr][nc] !== g[r][c]) {
                                       neighbors.push(g[nr][nc]);
                                   }
                               }
                           }
                           
                           if (neighbors.length >= crystallizeThresholdRef.current + 2) {
                               const counts: {[key:number]: number} = {};
                               neighbors.forEach(n => { counts[n] = (counts[n] || 0) + 1; });
                               
                               for(const color in counts) {
                                   if (counts[color] >= crystallizeThresholdRef.current + 1) {
                                       ng[r][c] = parseInt(color);
                                       break;
                                   }
                               }
                           }
                       }
                    }
                }
                break;
            }
            case 'erosion': {
                for(let r = 0; r < currentRows; r++) {
                    for(let c = 0; c < currentCols; c++) {
                        if (g[r][c] > 0) {
                            let emptyNeighbors = 0;
                            for (let dr = -1; dr <= 1; dr++) {
                                for (let dc = -1; dc <= 1; dc++) {
                                    if (dr === 0 && dc === 0) continue;
                                    const nr = r + dr, nc = c + dc;
                                    if (nr < 0 || nr >= currentRows || nc < 0 || nc >= currentCols || g[nr][nc] === 0) {
                                        emptyNeighbors++;
                                    }
                                }
                            }
                            if (emptyNeighbors >= erosionSolidityRef.current && Math.random() < erosionRateRef.current) {
                                ng[r][c] = 0;
                            }
                        }
                    }
                }
                break;
            }
            case 'tendrils':
            case 'conway': {
                const rules = pattern === 'conway' ? conwayRulesRef.current : tendrilsRulesRef.current;
                const BORN = rules.born;
                const SURVIVE = rules.survive;
                
                // First, preserve all existing pixels
                for (let r = 0; r < currentRows; r++) {
                    for (let c = 0; c < currentCols; c++) {
                        ng[r][c] = g[r][c]; // Copy existing state
                    }
                }
                
                // Then apply cellular automata rules only to empty spaces and unstable pixels
                for (let r = 0; r < currentRows; r++) {
                    for (let c = 0; c < currentCols; c++) {
                        let liveNeighbors = 0;
                        const neighborColors: number[] = [];
                        for (let dr = -1; dr <= 1; dr++) {
                            for (let dc = -1; dc <= 1; dc++) {
                                if (dr === 0 && dc === 0) continue;
                                const nr = r + dr;
                                const nc = c + dc;
                                if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols && g[nr]?.[nc] > 0) {
                                    liveNeighbors++;
                                    neighborColors.push(g[nr][nc]);
                                }
                            }
                        }

                        const isAlive = g[r]?.[c] > 0;
                        
                        // Only apply death rules with low probability to preserve image
                        if (isAlive && !SURVIVE.includes(liveNeighbors) && Math.random() < 0.1) {
                            ng[r][c] = 0;
                        }
                        // Apply birth rules to empty spaces
                        else if (!isAlive && BORN.includes(liveNeighbors)) {
                            const colorCounts = neighborColors.reduce((acc, color) => {
                                acc[color] = (acc[color] || 0) + 1;
                                return acc;
                            }, {} as Record<number, number>);
                            
                            let dominantColor = 0;
                            let maxCount = 0;
                            for (const color in colorCounts) {
                                if (colorCounts[color] > maxCount) {
                                    maxCount = colorCounts[color];
                                    dominantColor = parseInt(color);
                                }
                            }
                            ng[r][c] = dominantColor > 0 ? dominantColor : 1;
                        }
                    }
                }
                break;
            }
            case 'pulse': {
                const changes = new Map<string, number>();
                const direction = pulseDirectionRef.current;
                let r_start = 0, r_end = currentRows, r_inc = 1;
                let c_start = 0, c_end = currentCols, c_inc = 1;

                switch (direction) {
                    case 'up':
                        r_start = currentRows - 1; r_end = -1; r_inc = -1;
                        break;
                    case 'down':
                        break;
                    case 'left':
                        c_start = currentCols - 1; c_end = -1; c_inc = -1;
                        break;
                    case 'right':
                        break;
                    case 'top-left':
                        r_start = currentRows - 1; r_end = -1; r_inc = -1;
                        c_start = currentCols - 1; c_end = -1; c_inc = -1;
                        break;
                    case 'top-right':
                        r_start = currentRows - 1; r_end = -1; r_inc = -1;
                        break;
                    case 'bottom-left':
                        c_start = currentCols - 1; c_end = -1; c_inc = -1;
                        break;
                    case 'bottom-right':
                        break;
                }

                for (let r = r_start; r !== r_end; r += r_inc) {
                    for (let c = c_start; c !== c_end; c += c_inc) {
                        const currentColor = g[r]?.[c];
                        if (currentColor > 0) {
                            for (let dr = -1; dr <= 1; dr++) {
                                for (let dc = -1; dc <= 1; dc++) {
                                    if (dr === 0 && dc === 0) continue;
                                    const nr = r + dr;
                                    const nc = c + dc;
                                    if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols && (g[nr]?.[nc] === 0 || pulseOvertakesRef.current)) {
                                        const key = `${nr},${nc}`;
                                        changes.set(key, currentColor);
                                    }
                                }
                            }
                        }
                    }
                }
                
                changes.forEach((color, key) => {
                    const [r, c] = key.split(',').map(Number);
                    ng[r][c] = color;
                });
                break;
            }
            case 'random': {
                for (let r = 0; r < currentRows; r++) {
                    for (let c = 0; c < currentCols; c++) {
                        const currentColor = g[r]?.[c];
                        if (currentColor === undefined || currentColor === 0) continue;

                        if (Math.random() < spreadProbabilityRef.current) {
                            let neighbors: { r: number, c: number }[] = [];
                            const mode = randomWalkModeRef.current;

                            for (let dr = -1; dr <= 1; dr++) {
                                for (let dc = -1; dc <= 1; dc++) {
                                    if (dr === 0 && dc === 0) continue;
                                    if (mode === 'cardinal' && dr !== 0 && dc !== 0) continue;
                                    
                                    const nr = r + dr;
                                    const nc = c + dc;
                                    if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols) {
                                        neighbors.push({ r: nr, c: nc });
                                    }
                                }
                            }
                            
                            if (neighbors.length > 0) {
                                for (let i = neighbors.length - 1; i > 0; i--) {
                                    const j = Math.floor(Math.random() * (i + 1));
                                    [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
                                }
                                
                                const count = randomWalkSpreadCountRef.current;
                                for(let i=0; i < Math.min(count, neighbors.length); i++) {
                                    const randomNeighbor = neighbors[i];
                                    ng[randomNeighbor.r][randomNeighbor.c] = currentColor;
                                }
                            }
                        }
                    }
                }
                break;
            }
            case 'directional': {
                for (let r = 0; r < currentRows; r++) {
                    for (let c = 0; c < currentCols; c++) {
                        const currentColor = g[r]?.[c];
                        if (currentColor === undefined || currentColor === 0) continue;

                        if (Math.random() < spreadProbabilityRef.current) {
                            let neighbors: { r: number, c: number }[] = [];
                            for (let dr = -1; dr <= 1; dr++) {
                                for (let dc = -1; dc <= 1; dc++) {
                                    if (dr === 0 && dc === 0) continue;
                                    const nr = r + dr;
                                    const nc = c + dc;
                                    if (nr >= 0 && nr < currentRows && nc >= 0 && nc < currentCols) {
                                        neighbors.push({ r: nr, c: nc });
                                    }
                                }
                            }

                            if (directionalBiasRef.current !== 'none' && Math.random() < directionalBiasStrengthRef.current) {
                                const bias = directionalBiasRef.current;
                                let dr = 0, dc = 0;
                                
                                switch (bias) {
                                    case 'up':          dr = -1; dc =  0; break;
                                    case 'down':        dr =  1; dc =  0; break;
                                    case 'left':        dr =  0; dc = -1; break;
                                    case 'right':       dr =  0; dc =  1; break;
                                    case 'top-left':    dr = -1; dc = -1; break;
                                    case 'top-right':   dr = -1; dc =  1; break;
                                    case 'bottom-left': dr =  1; dc = -1; break;
                                    case 'bottom-right':dr =  1; dc =  1; break;
                                }
        
                                const biasedNeighbor = { r: r + dr, c: c + dc };
                                
                                if (biasedNeighbor.r >= 0 && biasedNeighbor.r < currentRows && biasedNeighbor.c >= 0 && biasedNeighbor.c < currentCols) {
                                    ng[biasedNeighbor.r][biasedNeighbor.c] = currentColor;
                                    continue;
                                }
                            }

                            if (neighbors.length > 0) {
                                const randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
                                ng[randomNeighbor.r][randomNeighbor.c] = currentColor;
                            }
                        }
                    }
                }
                break;
            }
        }
        return ng;
    });
  }, []);

  const addRandomDots = useCallback(() => {
    setGrid(g => {
        const ng = cloneGrid(g);
        const availableColors = palette.slice(1).map((_, i) => i + 1);
        if (availableColors.length === 0) return ng;

        const numDots = Math.floor(Math.random() * 6) + 5;
        for (let i = 0; i < numDots; i++) {
            const r = Math.floor(Math.random() * rowsRef.current);
            const c = Math.floor(Math.random() * colsRef.current);
            const color = availableColors[Math.floor(Math.random() * availableColors.length)];
            if(ng[r]) ng[r][c] = color;
        }
        
        return ng;
    });
  }, [palette]);

  const addRandomShapes = useCallback(() => {
    setGrid(g => {
        const ng = cloneGrid(g);
        const availableColors = palette.slice(1).map((_, i) => i + 1);
        if (availableColors.length === 0) return ng;

        const currentRows = rowsRef.current;
        const currentCols = colsRef.current;

        const numShapes = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < numShapes; i++) {
            const color = availableColors[Math.floor(Math.random() * availableColors.length)];
            const shapeType = Math.random() > 0.5 ? 'rect' : 'line';
            
            if (shapeType === 'rect') {
                const startR = Math.floor(Math.random() * (currentRows - 5));
                const startC = Math.floor(Math.random() * (currentCols - 5));
                const width = Math.floor(Math.random() * 6) + 3;
                const height = Math.floor(Math.random() * 6) + 3;
                
                for (let r = startR; r < Math.min(startR + height, currentRows); r++) {
                    for (let c = startC; c < Math.min(startC + width, currentCols); c++) {
                        if(ng[r]) ng[r][c] = color;
                    }
                }
            } else {
                const startR = Math.floor(Math.random() * currentRows);
                const startC = Math.floor(Math.random() * currentCols);
                const isHorizontal = Math.random() > 0.5;
                const length = Math.floor(Math.random() * 10) + 5;
                
                for (let i = 0; i < length; i++) {
                    let r = startR;
                    let c = startC;
                    
                    if (isHorizontal) {
                        c += i;
                    } else {
                        r += i;
                    }
                    
                    if (r >= 0 && r < currentRows && c >= 0 && c < currentCols) {
                        if(ng[r]) ng[r][c] = color;
                    }
                }
            }
        }
        
        return ng;
    });
  }, [palette]);

  const runAutoSpread = useCallback(() => {
    let lastTime = performance.now();
    let frameCount = 0;
    const loop = (time: number) => {
      if (!runningRef.current) return;

      const pattern = spreadPatternRef.current;
      const speed = pattern === 'pulse' 
        ? pulseSpeedRef.current 
        : autoSpreadSpeedRef.current;
      
      const interval = 1000 / Math.max(0.25, speed);

      // Skip frames for very slow speeds to reduce CPU usage
      if (speed < 1) {
        frameCount++;
        if (frameCount % Math.ceil(60 / Math.max(0.25, speed)) !== 0) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
      }

      if (time - lastTime >= interval) {
        colorSpread();
        lastTime = time;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [colorSpread]);

  const runAutoDots = useCallback(() => {
    let lastTime = performance.now();
    const loop = (time: number) => {
      if (!dotsRunningRef.current) return;
      const interval = 1000 / Math.max(0.1, autoDotsSpeedRef.current);
      if (time - lastTime >= interval) {
        addRandomDots();
        lastTime = time;
      }
      autoDotsRef.current = requestAnimationFrame(loop);
    };
    autoDotsRef.current = requestAnimationFrame(loop);
  }, [addRandomDots]);

  const runAutoShapes = useCallback(() => {
    let lastTime = performance.now();
    const loop = (time: number) => {
      if (!shapesRunningRef.current) return;
      const interval = 1000 / Math.max(0.1, autoShapesSpeedRef.current);
      if (time - lastTime >= interval) {
        addRandomShapes();
        lastTime = time;
      }
      autoShapesRef.current = requestAnimationFrame(loop);
    };
    autoShapesRef.current = requestAnimationFrame(loop);
  }, [addRandomShapes]);

  const toggleAutoSpread = () => {
    runningRef.current = !runningRef.current;
    setAutoSpreading(runningRef.current);
    if (runningRef.current) {
      if (spreadPatternRef.current === 'vein') walkers.current = [];
      if (spreadPatternRef.current === 'strobe') strobeStateRef.current = true;
      if (spreadPatternRef.current === 'ripple') ripplesRef.current = [];
      runAutoSpread();
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  };

  const toggleAutoDots = () => {
    dotsRunningRef.current = !dotsRunningRef.current;
    setAutoDots(dotsRunningRef.current);
    if (dotsRunningRef.current) {
      runAutoDots();
    } else if (autoDotsRef.current) {
      cancelAnimationFrame(autoDotsRef.current);
    }
  };

  const toggleAutoShapes = () => {
    shapesRunningRef.current = !shapesRunningRef.current;
    setAutoShapes(shapesRunningRef.current);
    if (shapesRunningRef.current) {
      runAutoShapes();
    } else if (autoShapesRef.current) {
      cancelAnimationFrame(autoShapesRef.current);
    }
  };

  const startAllEnabled = () => {
    if (autoSpreadEnabled && !autoSpreading) {
      runningRef.current = true;
      setAutoSpreading(true);
      runAutoSpread();
    }
    if (autoDotsEnabled && !autoDots) {
      dotsRunningRef.current = true;
      setAutoDots(true);
      runAutoDots();
    }
    if (autoShapesEnabled && !autoShapes) {
      shapesRunningRef.current = true;
      setAutoShapes(true);
      runAutoShapes();
    }
  };

  const stopAll = () => {
    if (autoSpreading) {
      runningRef.current = false;
      setAutoSpreading(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    }
    if (autoDots) {
      dotsRunningRef.current = false;
      setAutoDots(false);
      if (autoDotsRef.current) {
        cancelAnimationFrame(autoDotsRef.current);
      }
    }
    if (autoShapes) {
      shapesRunningRef.current = false;
      setAutoShapes(false);
      if (autoShapesRef.current) {
        cancelAnimationFrame(autoShapesRef.current);
      }
    }
  };

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (isDragging.current)
        setPanelPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const handleMouseUp = () => { isDragging.current = false; };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        e.preventDefault();
        setIsMobile(false);
        const mouseX = mousePos.current.x || window.innerWidth / 2;
        const mouseY = mousePos.current.y || window.innerHeight / 2;
        const desiredY = Math.max(20, Math.min(mouseY - 50, window.innerHeight - 400));
        setPanelPos({ x: 24, y: desiredY });
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobile, panelPos]);

  const handleRowsChange = useCallback((newRows: number) => {
    setRows(newRows);
    setGrid(currentGrid => {
      const newGrid = createEmptyGrid(newRows, cols);
      const oldRows = currentGrid.length;
      for (let r = 0; r < Math.min(oldRows, newRows); r++) {
        const oldCols = currentGrid[r]?.length ?? 0;
        for (let c = 0; c < Math.min(oldCols, cols); c++) {
          newGrid[r][c] = currentGrid[r][c];
        }
      }
      return newGrid;
    });
  }, [cols]);

  const handleColsChange = useCallback((newCols: number) => {
    setCols(newCols);
    setGrid(currentGrid =>
      currentGrid.map(row => {
        const newRow = new Array(newCols).fill(0);
        const oldLength = row.length;
        for (let c = 0; c < Math.min(oldLength, newCols); c++) {
          newRow[c] = row[c];
        }
        return newRow;
      })
    );
  }, []);

  const handlePaletteClick = (index: number) => {
    if (isSavingColor) {
      setPalette(p => {
        const newPalette = [...p];
        newPalette[index] = customColor;
        return newPalette;
      });
      setIsSavingColor(false);
      setSelectedColor(index);
    } else {
      setSelectedColor(index);
    }
  };
  

  const resetGenerativeSettings = () => {
    setSpreadPattern(defaults.spreadPattern);
    setPulseSpeed(defaults.pulseSpeed);
    setDirectionalBias(defaults.directionalBias);
    setConwayRules(defaults.conwayRules);
    setTendrilsRules(defaults.tendrilsRules);
    setDirectionalBiasStrength(defaults.directionalBiasStrength);
    setPulseOvertakes(defaults.pulseOvertakes);
    setPulseDirection(defaults.pulseDirection);
    setRandomWalkSpreadCount(defaults.randomWalkSpreadCount);
    setRandomWalkMode(defaults.randomWalkMode);
    setVeinSeekStrength(defaults.veinSeekStrength);
    setVeinBranchChance(defaults.veinBranchChance);
    setCrystallizeThreshold(defaults.crystallizeThreshold);
    setErosionRate(defaults.erosionRate);
    setErosionSolidity(defaults.erosionSolidity);
    setFlowDirection(defaults.flowDirection);
    setFlowChance(defaults.flowChance);
    setJitterChance(defaults.jitterChance);
    setVortexCount(defaults.vortexCount);
    setStrobeExpandThreshold(defaults.strobeExpandThreshold);
    setStrobeContractThreshold(defaults.strobeContractThreshold);
    setScrambleSwaps(defaults.scrambleSwaps);
    setRippleChance(defaults.rippleChance);
  };

  const isAnyRunning = autoSpreading || autoDots || autoShapes;
  const anyEnabled = autoSpreadEnabled || autoDotsEnabled || autoShapesEnabled;

  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at center, #1a0f11 0%, #0f0a0b 60%, #0c0708 100%)',
      display: 'flex',
      flexDirection: isMobile ? 'column' : 'row',
      justifyContent: 'center',
      alignItems: 'center',
      color: '#d4c4c1',
      gap: '20px'
    }}>
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          left: '24px',
          top: '24px',
          bottom: '24px',
          width: '320px',
          background: 'linear-gradient(160deg, #1a1214 0%, #0c0708 100%)',
          padding: '0',
          borderRadius: '0',
          border: 'none',
          boxShadow: 'inset 0 0 0 1px #1c1315, 0 0 0 1px #0c0708, 0 8px 32px rgba(0,0,0,0.8)',
          overflow: 'hidden',
          zIndex: 10,
          backdropFilter: 'blur(24px)',
          clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))'
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            background: '#0c0708',
            borderBottom: '1px solid #1c1315',
            fontSize: '0.9rem',
            fontWeight: 400,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            userSelect: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#8a7a77'
          }}
        >
          <span>Rough Image Generator</span>
          <button
            onClick={() => setPanelMinimized(prev => !prev)}
            style={{
              background: '#241a1c',
              border: '1px solid #1c1315',
              color: '#d4c4c1',
              cursor: 'pointer',
              fontSize: '0.8rem',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0',
              marginLeft: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            {panelMinimized ? '+' : '-'}
          </button>
        </div>

        <div style={{
          height: panelMinimized ? '0px' : 'calc(100% - 60px)',
          overflow: 'hidden',
          transition: 'height 0.3s ease'
        }}>
          <div style={{
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '20px',
            opacity: panelMinimized ? 0 : 1,
            transition: 'opacity 0.3s ease',
            pointerEvents: panelMinimized ? 'none' : 'auto',
            background: 'linear-gradient(180deg, transparent 0%, rgba(12, 7, 8, 0.3) 100%)'
          }}>
            
            <div className="upload-area" onClick={() => document.getElementById('imageUpload')?.click()}>
              <div className="upload-text">
                {imageFile ? `Uploaded: ${imageFile.name}` : 'Click to upload an image'}
              </div>
              <div className="upload-button">
                {imageFile ? 'Change Image' : 'Upload Image'}
              </div>
              <input
                id="imageUpload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              {uploadedImage && (
                <img 
                  src={uploadedImage.src} 
                  alt="Preview" 
                  className="image-preview"
                />
              )}
            </div>
            
            
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setShowAutoControls(prev => !prev)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: showAutoControls ? 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)' : '#241a1c',
                    color: '#d4c4c1',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'normal',
                    fontSize: '0.95rem'
                  }}
                >
                  Auto
                </button>
                <button
                  onClick={() => setShowOptions(prev => !prev)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: showOptions ? 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)' : '#241a1c',
                    color: '#d4c4c1',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'normal',
                    fontSize: '0.95rem'
                  }}
                >
                  Options
                </button>
                <button
                  onClick={() => { clear(); setIsSavingColor(false); }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#241a1c',
                    color: '#d4c4c1',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 'normal',
                    fontSize: '0.95rem'
                  }}
                >
                  Reset
                </button>
              </div>
            </div>



            {showAutoControls && (
              <>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { toggleAutoSpread(); setIsSavingColor(false); }}
                    disabled={!autoSpreadEnabled}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: autoSpreading 
                        ? '#241a1c' 
                        : autoSpreadEnabled 
                          ? '#241a1c' 
                          : 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)',
                      color: '#d4c4c1',
                      border: 'none',
                      cursor: autoSpreadEnabled ? 'pointer' : 'not-allowed',
                      fontWeight: 'normal',
                      fontSize: '0.95rem',
                      whiteSpace: 'nowrap',
                      opacity: autoSpreadEnabled ? 1 : 0.6,
                      boxShadow: autoSpreading ? '0 0 8px rgba(255, 255, 255, 0.4)' : 'none',
                      transition: 'box-shadow 0.2s ease-in-out'
                    }}
                  >
                    {autoSpreading ? 'Stop Spread' : 'Start Spread'}
                  </button>
                  {[
                    { 
                      label: autoDots ? 'Stop Dots' : 'Start Dots', 
                      onClick: toggleAutoDots, 
                      active: autoDots,
                      enabled: autoDotsEnabled
                    },
                    { 
                      label: autoShapes ? 'Stop Shapes' : 'Start Shapes', 
                      onClick: toggleAutoShapes, 
                      active: autoShapes,
                      enabled: autoShapesEnabled
                    }
                  ].map(({ label, onClick, active, enabled }) => (
                    <button
                      key={label}
                      onClick={() => { onClick(); setIsSavingColor(false); }}
                      disabled={!enabled}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: enabled ? '#241a1c' : 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)',
                        color: '#d4c4c1',
                        border: 'none',
                        cursor: enabled ? 'pointer' : 'not-allowed',
                        fontWeight: 'normal',
                        fontSize: '0.95rem',
                        whiteSpace: 'nowrap',
                        opacity: enabled ? 1 : 0.6,
                        boxShadow: active ? '0 0 8px rgba(255, 255, 255, 0.4)' : 'none',
                        transition: 'box-shadow 0.2s ease-in-out'
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    onClick={() => { isAnyRunning ? stopAll() : startAllEnabled(); setIsSavingColor(false); }}
                    disabled={!anyEnabled && !isAnyRunning}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: anyEnabled || isAnyRunning ? '#241a1c' : 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)',
                      color: '#d4c4c1',
                      border: 'none',
                      cursor: anyEnabled || isAnyRunning ? 'pointer' : 'not-allowed',
                      fontWeight: 'normal',
                      fontSize: '0.95rem',
                      whiteSpace: 'nowrap',
                      opacity: anyEnabled || isAnyRunning ? 1 : 0.6,
                      boxShadow: isAnyRunning ? '0 0 8px rgba(255, 255, 255, 0.4)' : 'none',
                      transition: 'box-shadow 0.2s ease-in-out'
                    }}
                  >
                    {isAnyRunning ? 'Stop All' : 'Start All'}
                  </button>
                </div>
              </>
            )}

            {showOptions && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Speed', onClick: () => setShowSpeedSettings(prev => !prev), bg: showSpeedSettings ? 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)' : '#241a1c' },
                  { label: 'Canvas', onClick: () => setShowCanvasSettings(prev => !prev), bg: showCanvasSettings ? 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)' : '#241a1c' },
                  { label: 'Visual', onClick: () => setShowVisualSettings(prev => !prev), bg: showVisualSettings ? 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)' : '#241a1c' },
                  { label: 'Generative', onClick: () => setShowGenerativeSettings(prev => !prev), bg: showGenerativeSettings ? 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)' : '#241a1c' },
                  { label: 'Steps', onClick: () => setShowStepControls(prev => !prev), bg: showStepControls ? 'linear-gradient(135deg, #8b4a47 0%, #a15856 100%)' : '#241a1c' }
                ].map(({ label, onClick, bg }) => (
                  <button
                    key={label}
                    onClick={onClick}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: bg,
                      color: '#d4c4c1',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'normal',
                      fontSize: '0.95rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            
            {showOptions && showStepControls && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Spread Once', onClick: colorSpread }
                ].map(({ label, onClick }) => (
                  <button
                    key={label}
                    onClick={() => { onClick(); setIsSavingColor(false); }}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#241a1c',
                      color: '#d4c4c1',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'normal',
                      fontSize: '0.95rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {showOptions && (showSpeedSettings || showCanvasSettings) && (
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: showSpeedSettings && showCanvasSettings ? 'repeat(2, 1fr)' : '1fr',
                gap: '12px', 
                marginBottom: '12px' 
              }}>
                {showSpeedSettings && (
                  <div>
                    <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block', fontSize: '0.9rem', color: '#e5e7eb' }}>
                      Speed Controls
                    </label>
                    {[
                      ['Spread Rate', spreadProbability, 0, 1, 0.01, setSpreadProbability, '%'],
                      ['Spread Speed', autoSpreadSpeed, 0.25, 100, 0.25, setAutoSpreadSpeed, '/s'],
                      ['Dots Speed', autoDotsSpeed, 0.1, 100, 0.1, setAutoDotsSpeed, '/s'],
                      ['Shapes Speed', autoShapesSpeed, 0.1, 100, 0.1, setAutoShapesSpeed, '/s']
                    ].map(([label, value, min, max, step, setter, unit], idx) => (
                      <div key={idx} style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>{label}:</label>
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                            {label === 'Spread Rate' ? `${Math.round((value as number) * 100)}${unit}` : `${value}${unit}`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={min as number}
                          max={max as number}
                          step={step as number}
                          value={value as number}
                          onChange={(e) => (setter as any)(Number(e.target.value))}
                          style={{ width: '100%', height: '6px' }}
                        />
                      </div>
                    ))}
                  </div>
                )}

{showCanvasSettings && (
  <div>
    <label
      style={{
        fontWeight: 600,
        marginBottom: '8px',
        display: 'block',
        fontSize: '0.9rem',
        color: '#e5e7eb'
      }}
    >
      Canvas Settings
    </label>
    {[
      ['Cell Size', cellSize, 1, 30, 1, setCellSize, ' px'],
      ['Rows', rows, 10, 2000, 1, handleRowsChange, ''],
      ['Cols', cols, 10, 2000, 1, handleColsChange, '']
    ].map(([label, value, min, max, step, setter, unit], idx) => (
      <div key={idx} style={{ marginBottom: '8px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2px'
          }}
        >
          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
            {label}:
          </label>

          {/* Rows/Cols: editable number input instead of static span */}
          {label === 'Rows' || label === 'Cols' ? (
            <input
              type="number"
              min={min as number}
              max={max as number}
              step={step as number}
              value={value as number}
              onChange={(e) => {
                let newValue = Number(e.target.value);
                if (isNaN(newValue)) return;
                // Clamp immediately while typing
                if (newValue < (min as number)) newValue = min as number;
                if (newValue > (max as number)) newValue = max as number;
                (setter as any)(newValue);
              }}
              style={{
                width: '60px',
                fontSize: '0.8rem',
                color: '#9ca3af',
                textAlign: 'right',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                appearance: 'textfield',
                MozAppearance: 'textfield'
              }}
              onFocus={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = '#1f2937';
                e.currentTarget.style.border = '1px solid #4b5563';
                e.currentTarget.style.borderRadius = '4px';
                e.currentTarget.style.padding = '2px 4px';
              }}
              onBlur={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.border = 'none';
                e.currentTarget.style.padding = '0';
              }}
            />
          ) : (
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              {`${value}${unit}`}
            </span>
          )}
        </div>

        {/* Slider stays for all */}
        <input
          type="range"
          min={min as number}
          max={max as number}
          step={step as number}
          value={value as number}
          onChange={(e) => (setter as any)(Number(e.target.value))}
          style={{ width: '100%', height: '6px' }}
        />
      </div>
    ))}
  </div>
)}


              </div>
            )}
            
            {showOptions && (
              <>
                {showGenerativeSettings && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ flexGrow: 1}}>
                    <label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Spread Pattern:</label>
                    <select
                      value={spreadPattern}
                      onChange={(e) => {
                          if (e.target.value === 'vein') walkers.current = []; // Reset walkers
                          setSpreadPattern(e.target.value as any);
                      }}
                      style={{ 
                        padding: '4px 8px', 
                        borderRadius: '6px', 
                        background: '#241a1c', 
                        color: '#d4c4c1', 
                        border: 'none',
                        width: '100%'
                      }}
                    >
                      <option value="random">Random Walk</option>
                      <option value="conway">Game of Life</option>
                      <option value="tendrils">Tendrils</option>
                      <option value="pulse">Current</option>
                      <option value="directional">Directional</option>
                      <option value="vein">Vein Growth</option>
                      <option value="crystallize">Crystallize</option>
                      <option value="erosion">Erosion</option>
                      <option value="flow">Flow</option>
                      <option value="jitter">Jitter</option>
                      <option value="vortex">Vortex</option>
                      <option value="strobe">Strobe</option>
                      <option value="scramble">Scramble</option>
                      <option value="ripple">Ripple</option>
                    </select>
                  </div>
                   <button
                    onClick={resetGenerativeSettings}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: '#241a1c',
                      color: '#d4c4c1',
                      border: 'none',
                      cursor: 'pointer',
                      alignSelf: 'flex-end',
                      height: '29px'
                    }}
                    title="Reset generative settings to default"
                  >
                    Reset
                  </button>
                </div>
                
                {spreadPattern === 'ripple' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                      <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Ripple Chance:</label>
                              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{Math.round(rippleChance*100)}%</span>
                          </div>
                          <input type="range" min={0.01} max={0.5} step={0.01} value={rippleChance} onChange={(e) => setRippleChance(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                      </div>
                  </div>
                )}

                {spreadPattern === 'scramble' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                      <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Swaps per Step:</label>
                              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{scrambleSwaps}</span>
                          </div>
                          <input type="range" min={1} max={100} value={scrambleSwaps} onChange={(e) => setScrambleSwaps(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                      </div>
                  </div>
                )}
                
                {spreadPattern === 'vortex' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                      <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Vortex Count:</label>
                              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{vortexCount}</span>
                          </div>
                          <input type="range" min={1} max={50} value={vortexCount} onChange={(e) => setVortexCount(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                      </div>
                  </div>
                )}

                {spreadPattern === 'strobe' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                      <div style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Expand Threshold:</label>
                              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{strobeExpandThreshold} Neighbors</span>
                          </div>
                          <input type="range" min={1} max={8} value={strobeExpandThreshold} onChange={(e) => setStrobeExpandThreshold(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                      </div>
                      <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Contract Threshold:</label>
                              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{strobeContractThreshold} Neighbors</span>
                          </div>
                          <input type="range" min={1} max={8} value={strobeContractThreshold} onChange={(e) => setStrobeContractThreshold(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                      </div>
                  </div>
                )}
                
                {spreadPattern === 'jitter' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                      <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Jitter Chance:</label>
                              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{Math.round(jitterChance*100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={jitterChance} onChange={(e) => setJitterChance(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                      </div>
                  </div>
                )}
                
                {spreadPattern === 'flow' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                      <div style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Flow Direction:</label>
                          <select
                              value={flowDirection}
                              onChange={(e) => setFlowDirection(e.target.value as any)}
                              style={{ padding: '4px 8px', borderRadius: '6px', background: '#241a1c', color: '#d4c4c1', border: 'none', width: '100%' }}
                          >
                              <option value="down">Down</option>
                              <option value="up">Up</option>
                              <option value="left">Left</option>
                              <option value="right">Right</option>
                          </select>
                      </div>
                      <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Flow Chance:</label>
                              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{Math.round(flowChance*100)}%</span>
                          </div>
                          <input type="range" min={0} max={1} step={0.05} value={flowChance} onChange={(e) => setFlowChance(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                      </div>
                  </div>
                )}

                {spreadPattern === 'vein' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                    <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Seek Strength:</label>
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{Math.round(veinSeekStrength*100)}%</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.05} value={veinSeekStrength} onChange={(e) => setVeinSeekStrength(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Branching Chance:</label>
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{Math.round(veinBranchChance*100)}%</span>
                        </div>
                        <input type="range" min={0} max={0.5} step={0.01} value={veinBranchChance} onChange={(e) => setVeinBranchChance(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                    </div>
                  </div>
                )}

                {spreadPattern === 'crystallize' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Growth Threshold:</label>
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{crystallizeThreshold} Neighbors</span>
                        </div>
                        <input type="range" min={1} max={8} value={crystallizeThreshold} onChange={(e) => setCrystallizeThreshold(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                    </div>
                  </div>
                )}
                
                {spreadPattern === 'erosion' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                     <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Erosion Rate:</label>
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{Math.round(erosionRate*100)}%</span>
                        </div>
                        <input type="range" min={0.01} max={1} step={0.01} value={erosionRate} onChange={(e) => setErosionRate(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Core Protection:</label>
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{erosionSolidity} Neighbors</span>
                        </div>
                        <input type="range" min={1} max={8} value={erosionSolidity} onChange={(e) => setErosionSolidity(Number(e.target.value))} style={{ width: '100%', height: '6px' }} />
                    </div>
                  </div>
                )}

                {spreadPattern === 'random' && (
                    <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Walk Mode:</label>
                            <select
                                value={randomWalkMode}
                                onChange={(e) => setRandomWalkMode(e.target.value as any)}
                                style={{ padding: '4px 8px', borderRadius: '6px', background: '#241a1c', color: '#d4c4c1', border: 'none', width: '100%' }}
                            >
                                <option value="any">8 Directions (Any)</option>
                                <option value="cardinal">4 Directions (Cardinal)</option>
                            </select>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Spread Count:</label>
                            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{randomWalkSpreadCount}</span>
                            </div>
                            <input
                            type="range" min={1} max={8} step={1} value={randomWalkSpreadCount}
                            onChange={(e) => setRandomWalkSpreadCount(Number(e.target.value))}
                            style={{ width: '100%', height: '6px' }}
                            />
                        </div>
                    </div>
                )}

                {spreadPattern === 'conway' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                    <RuleEditor label="Survive Counts" rules={conwayRules.survive} onChange={(newSurvive) => setConwayRules(r => ({ ...r, survive: newSurvive }))} />

                    <RuleEditor label="Birth Counts" rules={conwayRules.born} onChange={(newBorn) => setConwayRules(r => ({ ...r, born: newBorn }))} />
                  </div>
                )}
                
                {spreadPattern === 'tendrils' && (
                  <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                     <RuleEditor label="Survive Counts" rules={tendrilsRules.survive} onChange={(newSurvive) => setTendrilsRules(r => ({ ...r, survive: newSurvive }))} />

                     <RuleEditor label="Birth Counts" rules={tendrilsRules.born} onChange={(newBorn) => setTendrilsRules(r => ({ ...r, born: newBorn }))} />
                  </div>
                )}
                
                {spreadPattern === 'pulse' && (
                    <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                        <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Pulse Speed:</label>
                            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{pulseSpeed}</span>
                            </div>
                            <input
                            type="range" min={1} max={60} value={pulseSpeed}
                            onChange={(e) => setPulseSpeed(Number(e.target.value))}
                            style={{ width: '100%', height: '6px' }}
                            />
                        </div>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Flow Direction:</label>
                            <select
                                value={pulseDirection}
                                onChange={(e) => setPulseDirection(e.target.value as any)}
                                style={{ padding: '4px 8px', borderRadius: '6px', background: '#241a1c', color: '#d4c4c1', border: 'none', width: '100%' }}
                            >
                                <option value="top-left">Top-Left</option>
                                <option value="top-right">Top-Right</option>
                                <option value="bottom-left">Bottom-Left</option>
                                <option value="bottom-right">Bottom-Right</option>
                            </select>
                        </div>
                        <div style={{ fontWeight: 500, marginTop: '10px', fontSize: '0.85rem' }}>
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={pulseOvertakes} 
                                    onChange={e => setPulseOvertakes(e.target.checked)} 
                                    style={{ marginRight: '6px' }}
                                /> 
                                New Drops Overtake Existing
                            </label>
                        </div>
                    </div>
                )}

                {spreadPattern === 'directional' && (
                    <div style={{background: 'linear-gradient(145deg, #1a1214 0%, #0c0708 100%)', border: '1px solid #1c1315', padding: '8px', borderRadius: '6px'}}>
                      <div style={{ marginBottom: '10px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Bias Direction:</label>
                          <select
                              value={directionalBias}
                              onChange={(e) => setDirectionalBias(e.target.value as any)}
                              style={{ padding: '4px 8px', borderRadius: '6px', background: '#241a1c', color: '#d4c4c1', border: 'none', width: '100%' }}
                          >
                                <option value="up">Up</option>
                                <option value="down">Down</option>
                                <option value="left">Left</option>
                                <option value="right">Right</option>
                                <option value="top-left">Top-Left</option>
                                <option value="top-right">Top-Right</option>
                                <option value="bottom-left">Bottom-Left</option>
                                <option value="bottom-right">Bottom-Right</option>
                          </select>
                      </div>
                      <div style={{ marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Bias Strength:</label>
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{Math.round(directionalBiasStrength * 100)}%</span>
                          </div>
                          <input
                          type="range" min={0} max={1} step={0.05} value={directionalBiasStrength}
                          onChange={(e) => setDirectionalBiasStrength(Number(e.target.value))}
                          style={{ width: '100%', height: '6px' }}
                          />
                      </div>
                    </div>
                )}

              </div>
                )}

                {showVisualSettings && (
                  <div>
                    <div style={{ marginBottom: '10px' }}>
                  
<label style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>Blend Mode:</label>
                  <select
                    value={blendMode}
                    onChange={(e) => setBlendMode(e.target.value)}
                    style={{ 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      background: '#241a1c', 
                      color: '#d4c4c1', 
                      border: 'none',
                      width: '100%'
                    }}
                  >
                    <option value="replace">Replace</option>
                    <option value="overlay">Overlay</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontWeight: 600 }}>Background:</label>
                  <input 
                    type="color" 
                    value={backgroundColor} 
                    onChange={e => setBackgroundColor(e.target.value)}
                    style={{ marginLeft: '8px' }}
                  />
                </div>

                <div style={{ fontWeight: 600, marginBottom: '10px' }}>
                  <label>
                    <input 
                      type="checkbox" 
                      checked={showGrid} 
                      onChange={e => setShowGrid(e.target.checked)} 
                    /> 
                    Show Grid
                  </label>
                </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      
      <div ref={canvasContainerRef} style={{ 
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: '380px',
        paddingRight: '24px',
        paddingTop: '24px',
        paddingBottom: '24px'
      }}>
        <canvas
          ref={canvasRef}
          style={{ 
            display: 'block', 
            cursor: 'default', 
            background: backgroundColor,
            border: 'none',
            boxShadow: 'inset 0 0 0 1px #1c1315, inset 2px 2px 8px rgba(0,0,0,0.8), inset -1px -1px 4px #1a1214',
            clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)'
          }}
        />
      </div>
      
      {/* Resize Dialog */}
      {showResizeDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(12, 7, 8, 0.95)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1a1a1a',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #333',
            maxWidth: '500px',
            color: '#d4c4c1'
          }}>
            <h3 style={{ marginTop: 0, color: '#d4c4c1', fontSize: '18px' }}>Large Image Detected</h3>
            <p style={{ marginBottom: '16px', lineHeight: '1.5' }}>
              Your image is {pendingImage?.width} × {pendingImage?.height} pixels, which may be too large for comfortable viewing. 
              A grid this size would create {pendingImage?.width && pendingImage?.height ? (pendingImage.width * pendingImage.height).toLocaleString() : 'many'} cells.
            </p>
            <p style={{ marginBottom: '20px', lineHeight: '1.5' }}>
              We recommend resizing to {suggestedSize.width} × {suggestedSize.height} pixels 
              ({(suggestedSize.width * suggestedSize.height).toLocaleString()} cells) for better performance.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={handleResizeAccept}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0066cc',
                  color: '#d4c4c1',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Resize Image
              </button>
              <button
                onClick={handleResizeReject}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#666',
                  color: '#d4c4c1',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Use Original Size
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}