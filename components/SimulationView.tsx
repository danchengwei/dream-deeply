
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { generateSimulationTurn, generateSimulationImage, generateSceneConfiguration } from '../services/geminiService';
import { SimulationType, SimulationState, SavedRecord, SceneConfig } from '../types';
import { Icons } from '../constants';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

interface SimulationViewProps {
  type: SimulationType;
  title: string;          
  initialContext: string; 
  onExit: () => void;
  onSaveRecord: (record: SavedRecord) => void;
}

const TYPE_LABELS = {
  [SimulationType.HISTORY]: "历史",
  [SimulationType.CHEMISTRY]: "化学",
  [SimulationType.PHYSICS]: "物理",
  [SimulationType.LITERATURE]: "文学",
  [SimulationType.CODING]: "编程",
  [SimulationType.CUSTOM]: "自定义"
};

// --- Config-Driven 3D Simulation Engine ---
const ThreeSimulationCanvas = React.memo(({ config }: { config: SceneConfig | null | undefined }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameIdRef = useRef<number>(0);
  const objectsMapRef = useRef<Map<string, THREE.Object3D>>(new Map());

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene & Camera Setup
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 3, 8); 
    cameraRef.current = camera;

    // 2. Renderer (WebGL)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2b. Label Renderer (CSS2D)
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0px';
    labelRenderer.domElement.style.pointerEvents = 'none'; // Click through to canvas
    containerRef.current.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    // 3. Environment & Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // 4. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    // Allow controls to work through the label layer if we hadn't set pointer-events: none
    // But since label renderer is none, events go to webgl canvas which handles controls.
    controls.enableDamping = true;
    controls.target.set(0, 0.5, 0);
    controlsRef.current = controls;

    // 5. Initial Render
    if (config) {
        renderSceneFromConfig(scene, config);
    }

    // 6. Animation Loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
       if (!containerRef.current || !rendererRef.current || !cameraRef.current || !labelRendererRef.current) return;
       const w = containerRef.current.clientWidth;
       const h = containerRef.current.clientHeight;
       cameraRef.current.aspect = w / h;
       cameraRef.current.updateProjectionMatrix();
       rendererRef.current.setSize(w, h);
       labelRendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameIdRef.current);
      if (rendererRef.current && containerRef.current) {
         containerRef.current.removeChild(rendererRef.current.domElement);
         rendererRef.current.dispose();
      }
      if (labelRendererRef.current && containerRef.current) {
         containerRef.current.removeChild(labelRendererRef.current.domElement);
      }
      pmremGenerator.dispose();
    };
  }, []); 

  // Update scene when config changes
  useEffect(() => {
    if (sceneRef.current && config) {
        renderSceneFromConfig(sceneRef.current, config);
    }
  }, [config]);


  // --- ACCURATE Scene Rendering Logic ---
  const renderSceneFromConfig = (scene: THREE.Scene, config: SceneConfig) => {
    // Clear dynamic objects
    const objectsToRemove: THREE.Object3D[] = [];
    scene.traverse((child) => {
        if (child.userData.isDynamic) objectsToRemove.push(child);
    });
    objectsToRemove.forEach(o => scene.remove(o));
    objectsMapRef.current.clear();

    // Standard materials for color accuracy
    const standardMat = (col: string = '#cccccc', transparent = false, opacity = 1.0) => new THREE.MeshStandardMaterial({ 
        color: col, 
        roughness: 0.5, 
        metalness: 0.1,
        transparent,
        opacity
    });

    config.objects.forEach(obj => {
        let mesh: THREE.Object3D | null = null;
        const [x, y, z] = obj.position;
        const [sx, sy, sz] = obj.scale || [1, 1, 1];
        const color = obj.color || '#cccccc';

        // Geometry Generation based on Type
        if (obj.type === 'PLANE') {
            const geo = new THREE.BoxGeometry(1, 1, 1); 
            mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.9 }));
            mesh.scale.set(sx, sy, sz);
            mesh.receiveShadow = true;
        } 
        else if (obj.type === 'CUBE') {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), standardMat(color));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        }
        else if (obj.type === 'SPHERE') {
            mesh = new THREE.Mesh(new THREE.SphereGeometry(sx/2, 32, 32), standardMat(color));
            mesh.castShadow = true;
        }
        else if (obj.type === 'CYLINDER') {
            // New Type for Persons/Pillars
            mesh = new THREE.Mesh(new THREE.CylinderGeometry(sx/2, sx/2, sy, 32), standardMat(color));
            // Adjust cylinder origin to be center (ThreeJS cylinder origin is center, but often we want base)
            // But since our coords are usually center based, this is fine.
            mesh.castShadow = true;
        }
        else if (obj.type === 'BEAKER') {
             const radius = sx * 0.8;
             const height = sy * 2;
             
             // Simple Transparent Glass
             const glassMat = standardMat('#ffffff', true, 0.3);
             
             const geo = new THREE.CylinderGeometry(radius, radius, height, 32, 1, true);
             mesh = new THREE.Mesh(geo, glassMat);
             
             // Liquid
             if ((obj.liquidLevel || 0) > 0.01) {
                 const liqH = height * (obj.liquidLevel || 0.6);
                 const liqRadius = radius - 0.05; 
                 const liq = new THREE.Mesh(
                     new THREE.CylinderGeometry(liqRadius, liqRadius, liqH, 32),
                     standardMat(obj.liquidColor || '#3b82f6')
                 );
                 liq.position.y = -height/2 + liqH/2 + 0.05;
                 mesh.add(liq);
             }
             mesh.castShadow = true;
        }
        else if (obj.type === 'FLASK') {
             const radius = sx;
             const meshGroup = new THREE.Group();
             const glassMat = standardMat('#ffffff', true, 0.3);
             
             const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), glassMat);
             meshGroup.add(body);
             
             const neckH = sy * 1.5;
             const neck = new THREE.Mesh(new THREE.CylinderGeometry(radius/3, radius/3, neckH, 32, 1, true), glassMat);
             neck.position.y = radius + neckH/2 - 0.1;
             meshGroup.add(neck);

             if ((obj.liquidLevel || 0) > 0.01) {
                 const liqRadius = radius - 0.05;
                 const liq = new THREE.Mesh(
                    new THREE.SphereGeometry(liqRadius, 32, 32, 0, Math.PI * 2, 0, Math.PI/2 + 0.2), 
                    standardMat(obj.liquidColor || '#3b82f6')
                 );
                 liq.rotation.x = Math.PI; 
                 meshGroup.add(liq);
             }
             mesh = meshGroup;
             mesh.castShadow = true;
        }

        if (mesh) {
            mesh.position.set(x, y, z);
            mesh.userData.isDynamic = true;

            // --- FLOATING LABEL (ACCURACY BOOSTER) ---
            if (obj.label) {
                const div = document.createElement('div');
                div.className = 'px-2 py-1 bg-black/60 backdrop-blur-sm text-white text-[10px] rounded border border-white/20 shadow pointer-events-none whitespace-nowrap';
                div.textContent = obj.label;
                const labelObj = new CSS2DObject(div);
                // Position label slightly above the object
                labelObj.position.set(0, (sy/2) + 0.5, 0); 
                // Special case for spheres/flask which might be centered differently
                if(obj.type === 'SPHERE' || obj.type === 'FLASK') labelObj.position.set(0, (sx/2) + 0.5, 0);
                
                mesh.add(labelObj);
            }

            scene.add(mesh);
            objectsMapRef.current.set(obj.id, mesh);
        }
    });
  };

  return <div ref={containerRef} className="w-full h-full relative cursor-move bg-gradient-to-b from-slate-900 to-slate-950" />;
});


const ParticleBackground = React.memo(() => {
  const particles = useMemo(() => {
    return Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      width: `${Math.random() * 3 + 1}px`,
      height: `${Math.random() * 3 + 1}px`,
      opacity: Math.random() * 0.5 + 0.1,
      animationDuration: `${1.5 + Math.random()}s`,
      animationDelay: `${Math.random() * 2}s`
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
       {particles.map((p) => (
         <div 
            key={p.id}
            className="absolute bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-jump will-change-transform"
            style={{
               top: p.top, 
               left: p.left,
               width: p.width,
               height: p.height,
               opacity: p.opacity,
               animationDuration: p.animationDuration, 
               animationDelay: p.animationDelay
            }}
         />
       ))}
    </div>
  );
});

const SimulationView: React.FC<SimulationViewProps> = ({ type, title, initialContext, onExit, onSaveRecord }) => {
  const [simState, setSimState] = useState<SimulationState>({
    description: "正在初始化模拟环境...",
    imageBase64: null,
    options: [],
    history: [],
    isLoading: true,
    isImageLoading: true, 
    waitingForVisualChoice: false,
    isEnded: false,
    report: null,
    sceneConfig: null 
  });

  const [visualStyle, setVisualStyle] = useState<'ARTISTIC' | 'SCHEMATIC' | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  
  const initialized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reportSaved = useRef(false);

  const isScientificMode = type === SimulationType.PHYSICS || type === SimulationType.CHEMISTRY || type === SimulationType.HISTORY;

  const scrollToBottom = () => {
    setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Fake logs
  useEffect(() => {
    if(simState.isLoading) {
        const logs = [
            `> Initializing ${type} Module...`,
            "> Connecting to Neural Core...",
            "> Analyzing scenario parameters...",
            "> Awaiting User Input..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            const text = i < logs.length ? logs[i] : `> Computing probability fields...`;
            setLoadingLogs(prev => [...prev.slice(-4), text]);
            i++;
        }, 400); 
        return () => clearInterval(interval);
    }
  }, [simState.isLoading, type]);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const startSimulation = async () => {
      try {
        // Parallel requests
        const turnPromise = generateSimulationTurn([], initialContext || "Start", "开始模拟，请描述初始场景");
        const scenePromise = isScientificMode ? generateSceneConfiguration(title, initialContext, null) : Promise.resolve(null);

        const [turn, sceneConfig] = await Promise.all([turnPromise, scenePromise]);
        
        setSimState(prev => ({
          ...prev,
          description: turn.description,
          options: turn.options,
          history: [{ role: 'model' as const, text: turn.description }],
          isLoading: false,
          isEnded: turn.isEnded || false,
          report: turn.report,
          isImageLoading: false, 
          waitingForVisualChoice: false,
          sceneConfig: sceneConfig 
        }));
        
        scrollToBottom();

        if (isScientificMode) {
          setSimState(prev => ({ ...prev, waitingForVisualChoice: true }));
        } else {
          setVisualStyle('ARTISTIC');
          triggerImageGeneration(turn.description, 'ARTISTIC', turn.isEnded || false);
        }
        
      } catch (e) {
        console.error(e);
        setSimState(prev => ({ 
            ...prev, 
            description: "初始化失败，请重试。", 
            isLoading: false, 
            isImageLoading: false,
            waitingForVisualChoice: false
        }));
      }
    };

    startSimulation();
  }, [type, initialContext, isScientificMode, title]);

  // --- 2. USER ACTION ---
  const handleAction = async (actionText: string) => {
    if (!actionText.trim() || simState.isLoading || simState.isEnded || simState.waitingForVisualChoice) return;

    setSimState(prev => ({ ...prev, isLoading: true }));
    setCustomInput('');

    try {
      const newHistory: { role: 'user' | 'model'; text: string }[] = [...simState.history, { role: 'user', text: actionText }];
      const context = initialContext || ""; 
      
      const turn = await generateSimulationTurn(newHistory, context, actionText);

      // --- DYNAMIC SCENE UPDATE LOGIC ---
      // Only generate new SceneConfig if the AI explicitly says visuals need updating
      let newSceneConfig = simState.sceneConfig;
      
      if (isScientificMode) {
         if (turn.shouldUpdateVisuals) {
            console.log("Visual Update Triggered: Physical State Change Detected");
            try {
                // Pass the current config as previousState to ensure persistence
                newSceneConfig = await generateSceneConfiguration(title, turn.description, simState.sceneConfig);
            } catch(err) {
                console.warn("Failed to update scene", err);
            }
         } else {
            console.log("Skipping Visual Update: Dialogue/Logic only");
         }
      }

      setSimState(prev => ({
        ...prev,
        description: turn.description,
        options: turn.options || [],
        history: [...newHistory, { role: 'model' as const, text: turn.description }],
        isLoading: false,
        isEnded: turn.isEnded,
        report: turn.report,
        sceneConfig: newSceneConfig || prev.sceneConfig // Update or Keep Existing
      }));
      
      scrollToBottom();

      // Only generate new Image if style is artistic and visuals changed (or it's the end)
      if (visualStyle === 'ARTISTIC' && (turn.shouldUpdateVisuals || turn.isEnded)) {
          triggerImageGeneration(turn.description, 'ARTISTIC', turn.isEnded);
      } else if (visualStyle === 'SCHEMATIC') {
          if (turn.isEnded) setTimeout(() => setShowReportModal(true), 1200);
      }

    } catch (e) {
      console.error(e);
      setSimState(prev => ({ ...prev, isLoading: false }));
    }
  };

  // --- 3. VISUAL LOGIC ---
  const triggerImageGeneration = async (description: string, style: 'ARTISTIC' | 'SCHEMATIC', isEnded: boolean) => {
      if (style === 'SCHEMATIC') return;

      setSimState(prev => ({ ...prev, isImageLoading: true, waitingForVisualChoice: false }));
      
      try {
        const image = await generateSimulationImage(description, style);
        setSimState(prev => ({ ...prev, imageBase64: image, isImageLoading: false }));

        if (isEnded) setTimeout(() => setShowReportModal(true), 1200);
      } catch (e) {
        setSimState(prev => ({ ...prev, isImageLoading: false }));
        if (isEnded) setShowReportModal(true);
      }
  };

  const handleVisualChoice = (style: 'ARTISTIC' | 'SCHEMATIC') => {
      setVisualStyle(style);
      
      if (style === 'ARTISTIC') {
         triggerImageGeneration(simState.description, style, simState.isEnded);
      } else {
         // Switch to 3D, we already have sceneConfig from init
         setSimState(prev => ({ ...prev, isImageLoading: false, waitingForVisualChoice: false }));
      }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(customInput);
  };

  // Auto Save Report Logic
  useEffect(() => {
    if (simState.isEnded && simState.report && !reportSaved.current) {
       reportSaved.current = true;
       const record: SavedRecord = {
         id: Date.now().toString(),
         timestamp: Date.now(),
         type,
         topic: title || simState.history[0]?.text.substring(0, 50) || "Unknown Simulation",
         report: simState.report,
         transcript: simState.history
       };
       onSaveRecord(record);
    }
  }, [simState.isEnded, simState.report, type, title, simState.history, onSaveRecord]);


  // --- Initial Full Screen Loader (unchanged) ---
  if (simState.isLoading && simState.history.length === 0) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#020617] text-slate-200 font-mono">
           <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0f172a] to-black opacity-90 animate-pulse-slow"></div>
           <ParticleBackground />
           <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-6">
              <div className="text-center space-y-2">
                 <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(99,102,241,0.3)] animate-spin-slow">
                    <Icons.Sparkles />
                 </div>
                 <h2 className="text-2xl font-bold tracking-[0.2em] uppercase text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-white">
                    {TYPE_LABELS[type]} SIMULATION
                 </h2>
                 <p className="text-[10px] text-indigo-400/60 tracking-widest">ESTABLISHING NEURAL LINK</p>
              </div>
              <div className="w-full bg-black/40 backdrop-blur-md border-l-2 border-indigo-500/50 p-4 h-32 flex flex-col justify-end font-mono text-xs text-indigo-300 shadow-inner rounded-r-lg transition-all">
                 {loadingLogs.map((log, i) => (
                    <div key={i} className="animate-fade-in-up truncate">
                       <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                       {log}
                    </div>
                 ))}
                 <div className="animate-pulse text-indigo-500">_</div>
              </div>
           </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-dark text-slate-200 font-sans animate-fade-in relative">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-surface/80 backdrop-blur-md z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
           <button onClick={onExit} className="p-2 hover:bg-white/10 rounded-full transition text-slate-400 hover:text-white">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
           </button>
           <div className="flex items-center gap-2">
             <h2 className="text-lg font-bold text-white max-w-[200px] md:max-w-md truncate">
               {title || TYPE_LABELS[type]}
             </h2>
             {visualStyle === 'SCHEMATIC' && (
                <span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                   3D 引擎: Three.js (WebGL)
                </span>
             )}
           </div>
        </div>
        <div className={`px-3 py-1 text-xs rounded-full font-bold uppercase tracking-wide border transition-all duration-500 ${
          simState.isEnded ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse' : 'bg-green-500/10 text-green-400 border-green-500/20'
        }`}>
          {simState.isEnded ? '模拟结束' : '进行中'}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-10">
        
        {/* Visual Viewport */}
        <div className="w-full md:w-1/2 h-[35vh] md:h-full relative bg-black flex items-center justify-center overflow-hidden border-r border-white/5 shrink-0 group">
           
           {/* LAYER 1: THREE.JS CANVAS (Context Aware) */}
           {/* Only render if style is schematic and NOT waiting for choice */}
           {visualStyle === 'SCHEMATIC' && !simState.waitingForVisualChoice && (
              <div className="w-full h-full relative animate-fade-in">
                 <ThreeSimulationCanvas 
                    config={simState.sceneConfig}
                 />
                 <div className="absolute top-4 left-4 bg-black/60 backdrop-blur text-[10px] text-white/70 px-3 py-1.5 rounded-full border border-white/10 pointer-events-none select-none z-10 max-w-[80%] truncate">
                     <span className="w-2 h-2 inline-block bg-green-500 rounded-full mr-2 animate-pulse"></span>
                     Realtime 3D View
                 </div>
                 <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur text-[10px] text-slate-400 px-2 py-1 rounded border border-white/5 pointer-events-none">
                     左键旋转 · 右键平移 · 滚轮缩放
                 </div>
              </div>
           )}

           {/* LAYER 2: AI IMAGE */}
           {visualStyle === 'ARTISTIC' && !simState.waitingForVisualChoice && (
               simState.imageBase64 ? (
                <div className="absolute inset-0">
                    <img 
                      src={simState.imageBase64} 
                      alt="Simulation State" 
                      className={`w-full h-full object-cover transition-all duration-700 ${simState.isImageLoading ? 'opacity-30 blur-md scale-105 saturate-0' : 'opacity-100 scale-100 group-hover:scale-110'}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-transparent to-transparent md:bg-gradient-to-l md:from-dark/50" />
                </div>
               ) : (
                <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center">
                    {!simState.isImageLoading && (
                        <div className="text-slate-600 flex flex-col items-center">
                          <Icons.Sparkles />
                          <span className="text-xs mt-2">准备生成...</span>
                        </div>
                    )}
                </div>
               )
           )}

           {/* LAYER 3: SELECTION OVERLAY (Scientific Mode Only) */}
           {simState.waitingForVisualChoice && (
              <div className="absolute inset-0 z-30 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in p-6 text-center">
                 <div className="mb-8">
                    <h3 className="text-2xl font-bold text-white mb-2">选择模拟引擎</h3>
                    <p className="text-sm text-slate-400">检测到科学场景，请选择一种可视化方式</p>
                 </div>
                 
                 <div className="flex flex-col md:flex-row gap-6 w-full max-w-lg">
                     <button 
                       onClick={() => handleVisualChoice('SCHEMATIC')}
                       className="flex-1 group relative overflow-hidden bg-slate-800 border border-white/10 rounded-xl p-6 hover:border-blue-500/50 transition-all hover:bg-slate-800/80 active:scale-95"
                     >
                        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                           <div className="p-4 bg-blue-500/20 text-blue-400 rounded-full group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                              <Icons.Physics />
                           </div>
                           <div className="text-left">
                              <div className="font-bold text-slate-200 text-center text-lg">3D 实时仿真</div>
                              <div className="text-xs text-slate-500 text-center mt-1">
                                 AI 生成场景布局 · Three.js 渲染
                              </div>
                           </div>
                        </div>
                     </button>

                     <button 
                       onClick={() => handleVisualChoice('ARTISTIC')}
                       className="flex-1 group relative overflow-hidden bg-slate-800 border border-white/10 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:bg-slate-800/80 active:scale-95"
                     >
                        <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex flex-col items-center gap-4">
                           <div className="p-4 bg-purple-500/20 text-purple-400 rounded-full group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                              <Icons.Sparkles />
                           </div>
                           <div className="text-left">
                              <div className="font-bold text-slate-200 text-center text-lg">AI 场景生成</div>
                              <div className="text-xs text-slate-500 text-center mt-1">
                                 Imagen 3 · 艺术渲染 · 概念图
                              </div>
                           </div>
                        </div>
                     </button>
                 </div>
              </div>
           )}

           {/* LAYER 4: LOADING SPINNER (Only for AI Image) */}
           {simState.isImageLoading && visualStyle === 'ARTISTIC' && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-8">
                 <div className="relative mb-6">
                    <div className="w-20 h-20 border-2 border-white/10 border-t-indigo-400 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="w-10 h-10 bg-indigo-500/20 rounded-full animate-pulse"></div>
                    </div>
                 </div>
                 <div className="text-center space-y-2 max-w-xs w-full">
                    <p className="text-xs font-bold tracking-widest text-white uppercase animate-pulse">Rendering Scene</p>
                 </div>
              </div>
           )}

           <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 to-transparent md:hidden z-20">
             <p className="text-xs text-white/90 line-clamp-2">{simState.description}</p>
           </div>
        </div>

        {/* Narrative & Controls (Right Side) */}
        <div className="w-full md:w-1/2 flex flex-col flex-1 min-h-0 bg-dark relative overflow-hidden">
           
           {/* Chat History */}
           <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
              {simState.history.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                  <div className={`max-w-[90%] rounded-2xl p-4 shadow-sm transition-transform hover:scale-[1.01] ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-br-none shadow-primary/20' 
                      : 'bg-surface border border-white/5 text-slate-200 rounded-bl-none shadow-black/20'
                  }`}>
                    <p className="text-sm md:text-base leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
              
              {simState.isLoading && (
                 <div className="flex items-center gap-2 text-slate-500 text-sm p-4 animate-fade-in">
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" />
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce animation-delay-100" />
                   <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce animation-delay-200" />
                 </div>
              )}
              
              <div ref={bottomRef} className="h-4"></div>
           </div>

           {/* Input Area */}
           {!simState.isEnded && (
             <div className="shrink-0 p-4 md:p-6 bg-surface/50 border-t border-white/5 backdrop-blur-sm z-20 animate-slide-in-right">
                
                {/* Options */}
                {simState.options.length > 0 && !simState.isLoading && (
                  <div className="grid gap-2 mb-4">
                    {simState.options.map((option, idx) => (
                      <button
                        key={idx}
                        disabled={simState.isLoading || simState.waitingForVisualChoice}
                        onClick={() => handleAction(option)}
                        className="w-full text-left px-5 py-3 rounded-xl bg-dark hover:bg-white/5 border border-white/5 hover:border-primary/50 transition-all text-sm text-slate-300 hover:text-white group flex items-center justify-between hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <span>{option}</span>
                        <span className="text-white/20 group-hover:text-primary transition-colors"><Icons.ArrowRight /></span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Text Input */}
                <form onSubmit={handleCustomSubmit} className="relative flex items-center bg-dark rounded-xl border border-white/10 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all shadow-inner">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder={simState.waitingForVisualChoice ? "请先选择视觉引擎..." : "输入你的行动..."}
                    className="flex-1 bg-transparent px-4 py-3 text-white placeholder-slate-500 focus:outline-none text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={simState.isLoading || simState.waitingForVisualChoice}
                  />
                  <button 
                    type="submit"
                    disabled={!customInput.trim() || simState.isLoading || simState.waitingForVisualChoice}
                    className="p-2 m-1 rounded-lg bg-primary/20 text-primary hover:bg-primary hover:text-white transition-all disabled:opacity-30 active:scale-95"
                  >
                    <Icons.Send />
                  </button>
                </form>

             </div>
           )}

        </div>
      </div>

      {/* RESULT MODAL POPUP */}
      {showReportModal && simState.report && (
         <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4">
            <div className="bg-surface border border-white/10 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative animate-scale-in flex flex-col max-h-[90vh]">
               {/* Same Result Modal Content as before */}
               <div className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                     <div className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/30">
                        <Icons.Report />
                     </div>
                     <div>
                        <h3 className="text-lg font-bold text-white">模拟评估报告</h3>
                        <p className="text-xs text-indigo-200">Simulation Complete</p>
                     </div>
                  </div>
                  <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                     </svg>
                  </button>
               </div>
               <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                   <div className="flex items-center justify-center py-4">
                      <div className="relative">
                         <svg className="w-32 h-32 -rotate-90">
                            <circle cx="64" cy="64" r="56" stroke="#0f172a" strokeWidth="8" fill="none" />
                            <circle 
                               cx="64" cy="64" r="56" 
                               stroke={simState.report.score > 80 ? '#4ade80' : simState.report.score > 60 ? '#facc15' : '#f43f5e'} 
                               strokeWidth="8" 
                               fill="none" 
                               strokeDasharray="351" 
                               strokeDashoffset={351 - (351 * simState.report.score) / 100}
                               strokeLinecap="round"
                               className="transition-all duration-1000 ease-out"
                            />
                         </svg>
                         <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-extrabold text-white">{simState.report.score}</span>
                            <span className="text-xs font-bold uppercase text-slate-500 font-bold">Score</span>
                         </div>
                      </div>
                   </div>
                   <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">综合评价</h4>
                      <p className="text-sm text-slate-200 leading-relaxed">{simState.report.evaluation}</p>
                   </div>
                   <div className="grid grid-cols-1 gap-4">
                      <div>
                         <h4 className="text-xs font-bold text-indigo-400 uppercase mb-2">关键收获</h4>
                         <ul className="space-y-1">
                            {simState.report.keyLearnings.map((k, i) => (
                               <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                  <span className="text-indigo-500 mt-1">•</span> {k}
                               </li>
                            ))}
                         </ul>
                      </div>
                      <div>
                         <h4 className="text-xs font-bold text-pink-400 uppercase mb-2">建议</h4>
                         <p className="text-sm text-slate-300 italic">"{simState.report.suggestions}"</p>
                      </div>
                   </div>
               </div>
               <div className="p-4 border-t border-white/10 bg-dark/50 shrink-0 flex gap-3">
                  <button onClick={() => setShowReportModal(false)} className="flex-1 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-sm transition-colors">
                     查看最终场景
                  </button>
                  <button onClick={onExit} className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all">
                     返回主页
                  </button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default SimulationView;
