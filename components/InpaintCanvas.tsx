
import React, { useRef, useEffect, useState } from 'react';

interface InpaintCanvasProps {
  imageSrc: string;
  onExportMask: (maskBase64: string | null) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  brushSoftness: number;
  onBrushSoftnessChange: (softness: number) => void;
  t: any;
}

const InpaintCanvas: React.FC<InpaintCanvasProps> = ({ 
  imageSrc, onExportMask, brushSize, onBrushSizeChange, brushSoftness, onBrushSoftnessChange, t 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); 
  const maskCanvasRef = useRef<HTMLCanvasElement>(null); 
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0, scale: 1 });
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  
  // Use a ref to track the last position for drawing smooth lines
  const lastPos = useRef<{ x: number, y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      updateCanvasDimensions();
    };
    window.addEventListener('resize', updateCanvasDimensions);
    return () => window.removeEventListener('resize', updateCanvasDimensions);
  }, [imageSrc]);

  const updateCanvasDimensions = () => {
    if (!containerRef.current || !imageRef.current) return;
    
    const container = containerRef.current;
    const img = imageRef.current;
    const containerRatio = container.clientWidth / container.clientHeight;
    const imageRatio = img.width / img.height;
    
    let canvasWidth, canvasHeight;
    if (imageRatio > containerRatio) {
      canvasWidth = container.clientWidth;
      canvasHeight = container.clientWidth / imageRatio;
    } else {
      canvasHeight = container.clientHeight;
      canvasWidth = container.clientHeight * imageRatio;
    }

    setDimensions({
      width: canvasWidth,
      height: canvasHeight,
      scale: img.width / canvasWidth
    });

    if (canvasRef.current) {
      canvasRef.current.width = canvasWidth;
      canvasRef.current.height = canvasHeight;
    }

    if (maskCanvasRef.current) {
      maskCanvasRef.current.width = img.width;
      maskCanvasRef.current.height = img.height;
      const mCtx = maskCanvasRef.current.getContext('2d');
      if (mCtx) {
        mCtx.fillStyle = '#000000';
        mCtx.fillRect(0, 0, img.width, img.height);
      }
      // Export empty mask on initialization
      onExportMask(maskCanvasRef.current.toDataURL('image/png'));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Prevent default to avoid scrolling while drawing
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
    setIsDrawing(true);
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastPos.current = { x, y };
    
    // Draw initial point
    performDraw(x, y, x, y);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (containerRef.current) {
      containerRef.current.releasePointerCapture(e.pointerId);
    }
    setIsDrawing(false);
    lastPos.current = null;
    
    if (maskCanvasRef.current) {
      onExportMask(maskCanvasRef.current.toDataURL('image/png'));
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCursorPos({ x, y });

    if (isDrawing && lastPos.current) {
      performDraw(lastPos.current.x, lastPos.current.y, x, y);
      lastPos.current = { x, y };
    }
  };

  const performDraw = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = canvasRef.current;
    const mCanvas = maskCanvasRef.current;
    if (!canvas || !mCanvas) return;

    const ctx = canvas.getContext('2d');
    const mCtx = mCanvas.getContext('2d');
    if (!ctx || !mCtx) return;

    // UI Feedback (Visual Mask on the drawing layer)
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 40, 40, 0.7)'; // More vivid red
    ctx.lineWidth = brushSize;
    
    // Add a slight glow to the visual stroke
    ctx.shadowBlur = brushSoftness / 2;
    ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Actual Data Mask (Higher Resolution based on original image)
    const scale = dimensions.scale;
    const mx1 = x1 * scale;
    const my1 = y1 * scale;
    const mx2 = x2 * scale;
    const my2 = y2 * scale;
    
    mCtx.lineJoin = 'round';
    mCtx.lineCap = 'round';
    mCtx.strokeStyle = '#FFFFFF';
    mCtx.lineWidth = brushSize * scale;
    
    // Use a much smaller blur for the actual data mask to keep it precise
    // but still slightly anti-aliased for blending.
    mCtx.shadowBlur = (brushSoftness * scale) / 4; 
    mCtx.shadowColor = '#FFFFFF';

    mCtx.beginPath();
    mCtx.moveTo(mx1, my1);
    mCtx.lineTo(mx2, my2);
    mCtx.stroke();
  };

  // Expose clear functionality via ref or just add a button inside for simplicity
  const clear = () => {
    if (canvasRef.current && maskCanvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      const mCtx = maskCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      if (mCtx) {
        mCtx.fillStyle = '#000000';
        mCtx.fillRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
      }
      onExportMask(null); // Explicitly set to null when cleared
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col gap-4">
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); clear(); }}
          className="px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-red-500 transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-eraser"></i> {t.clearMask}
        </button>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 bg-black/40 rounded-3xl overflow-hidden relative cursor-none border border-white/5 touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => { setIsHovering(false); if(isDrawing) handlePointerUp({ pointerId: -1 } as any); }}
        onPointerEnter={() => setIsHovering(true)}
      >
        {imageSrc && (
          <img 
            src={imageSrc} 
            style={{ width: dimensions.width, height: dimensions.height }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none object-contain" 
            alt="Source" 
          />
        )}
        <canvas 
          ref={canvasRef} 
          style={{ width: dimensions.width, height: dimensions.height }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10" 
        />
        <canvas ref={maskCanvasRef} className="hidden" />

        {isHovering && (
          <div 
            className="absolute pointer-events-none z-20 border-2 border-white/80 rounded-full bg-white/10"
            style={{ 
              width: brushSize, 
              height: brushSize, 
              left: cursorPos.x + (containerRef.current?.clientWidth || 0)/2 - dimensions.width/2, 
              top: cursorPos.y + (containerRef.current?.clientHeight || 0)/2 - dimensions.height/2, 
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 15px rgba(255,255,255,0.4)',
              transition: isDrawing ? 'none' : 'width 0.1s, height 0.1s, opacity 0.2s'
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 glass rounded-2xl border-white/10">
        <div className="flex gap-8 items-center flex-1">
          <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">{t.brushSize}</span>
              <span className="text-[10px] font-black text-indigo-400">{brushSize}px</span>
            </div>
            <input 
              type="range" min="5" max="150" value={brushSize} 
              onChange={(e) => onBrushSizeChange(parseInt(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500 cursor-pointer" 
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <div className="flex justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">{t.brushSoftness}</span>
              <span className="text-[10px] font-black text-indigo-400">{brushSoftness}</span>
            </div>
            <input 
              type="range" min="0" max="100" value={brushSoftness} 
              onChange={(e) => onBrushSoftnessChange(parseInt(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500 cursor-pointer" 
            />
          </div>
        </div>
        <button onClick={clear} className="px-6 py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-red-500/20">
          {t.clearMask}
        </button>
      </div>
    </div>
  );
};

export default InpaintCanvas;
