/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';
import { Settings, Zap, MousePointer2, Sliders, Play, Pause, AlertTriangle, RefreshCw, Monitor, Folder, FileText, Terminal, HardDrive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';

const PARTICLE_COUNT = 1000;
const NEON_COLORS = [
  '#00f2ff', '#00ff9d', '#ff00ea', '#ff9d00', '#7000ff', '#ff003c',
];

const DESKTOP_ICONS = [
  { id: 1, name: 'My Computer', icon: Monitor, x: 40, y: 40 },
  { id: 2, name: 'Documents', icon: Folder, x: 40, y: 130 },
  { id: 3, name: 'Physics_Engine.exe', icon: Terminal, x: 40, y: 220 },
  { id: 4, name: 'README.txt', icon: FileText, x: 40, y: 310 },
  { id: 5, name: 'System_Root', icon: HardDrive, x: 40, y: 400 },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uiLayerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const particlesRef = useRef<Matter.Body[]>([]);
  const requestRef = useRef<number | null>(null);
  
  const [gravity, setGravity] = useState(0.5);
  const [isSlowMo, setIsSlowMo] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isAttracting, setIsAttracting] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  const [instabilityTime, setInstabilityTime] = useState(0);
  const instabilityRef = useRef(0);
  const [isDead, setIsDead] = useState(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);

  useEffect(() => {
    let interval: any;
    if (isAttracting && !isDead) {
      interval = setInterval(async () => {
        instabilityRef.current += 0.1;
        setInstabilityTime(instabilityRef.current);
        
        // Take screenshot just before death
        if (instabilityRef.current >= 14.2 && !screenshot) {
          if (uiLayerRef.current) {
            const canvas = await html2canvas(uiLayerRef.current, {
              backgroundColor: null,
              logging: false,
              useCORS: true
            });
            setScreenshot(canvas.toDataURL());
          }
        }

        if (instabilityRef.current >= 15) {
          setIsDead(true);
          clearInterval(interval);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isAttracting, isDead, screenshot]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || isDead) return;

    const engine = Matter.Engine.create();
    engineRef.current = engine;
    engine.gravity.y = gravity;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const updateSize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      
      Matter.Composite.clear(engine.world, false);
      const wallThickness = 100;
      const walls = [
        Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness, wallThickness, { isStatic: true }),
        Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness, wallThickness, { isStatic: true }),
        Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness, { isStatic: true }),
        Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness, { isStatic: true }),
      ];
      Matter.Composite.add(engine.world, walls);
      
      if (particlesRef.current.length === 0) {
        const particles: Matter.Body[] = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const radius = Math.random() * 4 + 2;
          const x = Math.random() * width;
          const y = Math.random() * height;
          const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
          const particle = Matter.Bodies.circle(x, y, radius, {
            restitution: 0.8,
            friction: 0.005,
          });
          (particle as any).neonColor = color;
          particles.push(particle);
        }
        particlesRef.current = particles;
        Matter.Composite.add(engine.world, particles);
      } else {
        Matter.Composite.add(engine.world, particlesRef.current);
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const render = () => {
      const timeScale = isSlowMo ? 0.2 : 1;
      Matter.Engine.update(engine, 16.666 * timeScale);

      const instability = instabilityRef.current;
      const isCatastrophic = instability > 5;
      const catastrophicFactor = Math.max(0, (instability - 5) / 10);

      if (isAttracting) {
        const forceMultiplier = 0.0005 + (catastrophicFactor * 0.0045);
        particlesRef.current.forEach(p => {
          const dx = mousePos.x - p.position.x;
          const dy = mousePos.y - p.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1) return;
          const force = forceMultiplier * p.mass;
          Matter.Body.applyForce(p, p.position, {
            x: (dx / dist) * force,
            y: (dy / dist) * force
          });
          if (isCatastrophic && dist < (20 + catastrophicFactor * 80)) {
            Matter.Body.setPosition(p, { x: Math.random() * canvas.width, y: -50 });
            Matter.Body.setVelocity(p, { x: 0, y: 0 });
          }
        });
      }

      ctx.fillStyle = isCatastrophic ? '#000000' : '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (isAttracting) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const singularityRadius = 50 + catastrophicFactor * 250;
        const grad = ctx.createRadialGradient(mousePos.x, mousePos.y, 0, mousePos.x, mousePos.y, singularityRadius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.1, isCatastrophic ? '#ff003c' : '#00f2ff');
        grad.addColorStop(0.3, '#7000ff');
        grad.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, singularityRadius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        
        ctx.globalCompositeOperation = 'source-over';
        const coreRadius = 10 + catastrophicFactor * 60;
        ctx.beginPath();
        ctx.arc(mousePos.x, mousePos.y, coreRadius + Math.sin(Date.now() * 0.01) * 5, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 + catastrophicFactor * 4;
        ctx.stroke();
        ctx.restore();
      }

      ctx.globalCompositeOperation = 'lighter';
      particlesRef.current.forEach(p => {
        const { x, y } = p.position;
        const radius = (p as any).circleRadius;
        const color = (p as any).neonColor;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius * 2.5);
        gradient.addColorStop(0, color + '66');
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      ctx.globalCompositeOperation = 'source-over';
      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      Matter.Engine.clear(engine);
    };
  }, [isSlowMo, isAttracting, mousePos, isDead]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (e.button === 0) setIsAttracting(true);
    else if (e.button === 2) {
      particlesRef.current.forEach(p => {
        const dx = p.position.x - (e.clientX - rect.left);
        const dy = p.position.y - (e.clientY - rect.top);
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = Math.max(0, (500 - dist) / 500) * 0.05 * p.mass;
        Matter.Body.applyForce(p, p.position, { x: (dx / dist) * force, y: (dy / dist) * force });
      });
    }
  };

  const getSuckEffect = (elementX: number, elementY: number) => {
    if (instabilityTime < 5) return {};
    const catastrophicFactor = Math.max(0, (instabilityTime - 5) / 10);
    const dx = mousePos.x - elementX;
    const dy = mousePos.y - elementY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const strength = catastrophicFactor * Math.max(0, (1500 - dist) / 1500);
    
    return {
      x: dx * strength * 1.2,
      y: dy * strength * 1.2,
      scale: 1 - strength * 0.98,
      rotate: strength * 180,
      filter: `blur(${strength * 30}px)`,
      opacity: 1 - strength * 0.95
    };
  };

  const handleReset = () => {
    instabilityRef.current = 0;
    setInstabilityTime(0);
    setIsDead(false);
    setScreenshot(null);
    particlesRef.current = [];
  };

  if (isDead) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center font-serif text-white overflow-hidden">
        <motion.h2 initial={{ opacity: 0, letterSpacing: '0.5em' }} animate={{ opacity: 1, letterSpacing: '0.1em' }} transition={{ duration: 4 }} className="text-4xl italic font-light mb-12">
          Only darkness remains
        </motion.h2>
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 5 }} onClick={handleReset} className="flex items-center gap-2 px-6 py-3 border border-white/20 rounded-full hover:bg-white/10 transition-colors text-sm uppercase tracking-widest">
          <RefreshCw className="w-4 h-4" /> Reconstitute Reality
        </motion.button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-screen bg-[#050505] overflow-hidden font-sans text-white select-none">
      <canvas ref={canvasRef} onMouseDown={handleMouseDown} onMouseUp={() => setIsAttracting(false)} onMouseMove={(e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }} onContextMenu={(e) => e.preventDefault()} className="block cursor-crosshair" />

      {/* Screenshot Layer (Final Collapse) */}
      {screenshot && instabilityTime > 14 && (
        <motion.img
          src={screenshot}
          animate={getSuckEffect(window.innerWidth / 2, window.innerHeight / 2)}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-50"
        />
      )}

      {/* Simulated Desktop Layer */}
      <div ref={uiLayerRef} className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${screenshot && instabilityTime > 14.2 ? 'opacity-0' : 'opacity-100'}`}>
        {/* Desktop Icons */}
        {DESKTOP_ICONS.map(icon => (
          <motion.div
            key={icon.id}
            animate={getSuckEffect(icon.x + 30, icon.y + 30)}
            className="absolute flex flex-col items-center gap-1 w-20 pointer-events-auto cursor-pointer group"
            style={{ left: icon.x, top: icon.y }}
          >
            <div className="p-3 bg-[#ffffff0d] rounded-lg border border-transparent group-hover:bg-[#ffffff1a] group-hover:border-[#ffffff1a] transition-all">
              <icon.icon className="w-8 h-8 text-[#00f2ff]" />
            </div>
            <span className="text-[10px] text-center font-medium text-[#ffffffb3] group-hover:text-white transition-colors">{icon.name}</span>
          </motion.div>
        ))}

        {/* Fake Taskbar */}
        <motion.div
          animate={getSuckEffect(window.innerWidth / 2, window.innerHeight - 20)}
          className="absolute bottom-0 left-0 right-0 h-12 bg-[#00000099] backdrop-blur-md border-t border-[#ffffff1a] flex items-center px-4 gap-4 pointer-events-auto"
        >
          <div className="w-8 h-8 bg-[#06b6d433] rounded-md flex items-center justify-center border border-[#06b6d44d]">
            <div className="w-4 h-4 bg-[#22d3ee] rounded-sm" />
          </div>
          <div className="flex-1 flex items-center gap-2">
            <div className="w-32 h-8 bg-[#ffffff0d] rounded-md border border-[#ffffff1a]" />
            <div className="w-8 h-8 bg-[#ffffff0d] rounded-md border border-[#ffffff1a]" />
          </div>
          <div className="text-[10px] font-mono text-[#ffffff66]">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </motion.div>

        {/* Main Control Panel */}
        <motion.div 
          animate={getSuckEffect(150, 200)}
          transition={{ type: 'spring', damping: 25, stiffness: 40 }}
          className={`absolute top-6 left-6 transition-all duration-500 pointer-events-auto ${showControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10 pointer-events-none'}`}
        >
          <div className="bg-[#00000066] backdrop-blur-xl border border-[#ffffff1a] rounded-2xl p-6 w-72 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#22d3ee] to-[#a855f7] bg-clip-text text-transparent">
                {instabilityTime > 5 ? 'SYSTEM FAILURE' : 'NEON PHYSICS'}
              </h1>
              <Settings className={`w-5 h-5 ${instabilityTime > 5 ? 'text-[#ef4444] animate-spin' : 'text-[#ffffff66]'}`} />
            </div>
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-[#ffffff99]">
                  <span>Gravity</span>
                  <span className="text-[#22d3ee]">{gravity.toFixed(2)}</span>
                </div>
                <input type="range" min="-1" max="2" step="0.01" value={gravity} onChange={(e) => setGravity(parseFloat(e.target.value))} className="w-full h-1.5 bg-[#ffffff1a] rounded-lg appearance-none cursor-pointer accent-[#22d3ee]" />
              </div>
              <div className="flex items-center justify-between p-3 bg-[#ffffff0d] rounded-xl border border-[#ffffff0d] hover:border-[#ffffff1a] transition-colors cursor-pointer" onClick={() => setIsSlowMo(!isSlowMo)}>
                <div className="flex items-center gap-3">
                  {isSlowMo ? <Pause className="w-4 h-4 text-[#c084fc]" /> : <Play className="w-4 h-4 text-[#22d3ee]" />}
                  <span className="text-sm font-medium">Slow Motion</span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${isSlowMo ? 'bg-[#a855f7]' : 'bg-[#ffffff1a]'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isSlowMo ? 'left-6' : 'left-1'}`} />
                </div>
              </div>
              <div className="pt-4 border-t border-[#ffffff1a] space-y-3">
                <div className="flex items-center gap-3 text-xs text-[#ffffff66]">
                  <MousePointer2 className="w-3.5 h-3.5" />
                  <span>{instabilityTime > 10 ? 'VOID CONSUMPTION' : instabilityTime > 5 ? 'CRITICAL PULL' : 'Left Click: Attract'}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#ffffff66]">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Right Click: Explosion</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Toggle Controls Button */}
        <motion.button animate={getSuckEffect(40, 900)} onClick={() => setShowControls(!showControls)} className="absolute bottom-16 left-6 p-3 bg-[#00000066] backdrop-blur-xl border border-[#ffffff1a] rounded-full hover:bg-[#ffffff1a] transition-all active:scale-95 pointer-events-auto">
          <Sliders className="w-5 h-5 text-[#ffffffb3]" />
        </motion.button>

        {/* Particle Count Badge */}
        <motion.div animate={getSuckEffect(window.innerWidth - 100, window.innerHeight - 100)} className="absolute bottom-16 right-6 px-4 py-2 bg-[#00000066] backdrop-blur-xl border border-[#ffffff1a] rounded-full text-[10px] font-mono tracking-widest text-[#ffffff66] uppercase">
          {instabilityTime > 12 ? 'REALITY COLLAPSE' : 'Active Particles'}: <span className="text-[#ffffffcc]">{PARTICLE_COUNT}</span>
        </motion.div>
      </div>

      {/* Warning Overlay */}
      <AnimatePresence>
        {instabilityTime > 10 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none border-[20px] border-red-900/20 animate-pulse z-40" />
        )}
      </AnimatePresence>

      {/* Cinematic Vignette */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 ${instabilityTime > 10 ? 'shadow-[inset_0_0_300px_rgba(0,0,0,1)] bg-black/20' : 'shadow-[inset_0_0_150px_rgba(0,0,0,0.8)]'} z-30`} />
    </div>
  );
}
