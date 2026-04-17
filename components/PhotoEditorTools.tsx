
import React, { useState, useEffect } from 'react';
import CurvesEditor from './CurvesEditor';

interface PhotoEditorToolsProps {
  imageSrc: string;
  maskSrc?: string | null;
  onApply: (processedImageUrl: string) => void;
  t: any;
}

const PhotoEditorTools: React.FC<PhotoEditorToolsProps> = ({ imageSrc, maskSrc, onApply, t }) => {
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [lut, setLut] = useState<number[]>(Array.from({ length: 256 }, (_, i) => i));
  const [activeTab, setActiveTab] = useState<'basic' | 'curves'>('basic');

  const applyAdjustments = () => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // If we have a mask, we need to load it to apply selective adjustments
      if (maskSrc) {
        const maskImg = new Image();
        maskImg.crossOrigin = "anonymous";
        maskImg.src = maskSrc;
        maskImg.onload = () => {
          const mCanvas = document.createElement('canvas');
          mCanvas.width = canvas.width;
          mCanvas.height = canvas.height;
          const mCtx = mCanvas.getContext('2d');
          if (!mCtx) return;
          mCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
          const maskData = mCtx.getImageData(0, 0, canvas.width, canvas.height).data;

          processImageData(data, maskData);
          ctx.putImageData(imageData, 0, 0);
          onApply(canvas.toDataURL('image/webp'));
        };
      } else {
        processImageData(data);
        ctx.putImageData(imageData, 0, 0);
        onApply(canvas.toDataURL('image/webp'));
      }
    };
  };

  const processImageData = (data: Uint8ClampedArray, maskData?: Uint8ClampedArray) => {
    const b = brightness / 100;
    const c = contrast / 100;
    const s = saturation / 100;

    for (let i = 0; i < data.length; i += 4) {
      // Use the red channel of the mask for weighting (white = 255, black = 0)
      const maskWeight = maskData ? maskData[i] / 255 : 1;
      
      if (maskWeight <= 0.01) continue; // Optimization for unmasked areas

      const r_orig = data[i];
      const g_orig = data[i + 1];
      const b_orig = data[i + 2];

      let r = r_orig;
      let g = g_orig;
      let b_val = b_orig;

      // 1. Apply Curves LUT
      r = lut[Math.round(r)];
      g = lut[Math.round(g)];
      b_val = lut[Math.round(b_val)];

      // 2. Brightness
      r *= b;
      g *= b;
      b_val *= b;

      // 3. Contrast
      r = ((r / 255 - 0.5) * c + 0.5) * 255;
      g = ((g / 255 - 0.5) * c + 0.5) * 255;
      b_val = ((b_val / 255 - 0.5) * c + 0.5) * 255;

      // 4. Saturation (Luminance preserving)
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b_val;
      r = gray + (r - gray) * s;
      g = gray + (g - gray) * s;
      b_val = gray + (b_val - gray) * s;

      // Final Clamp and Blend with original based on mask weight
      data[i] = r_orig * (1 - maskWeight) + Math.max(0, Math.min(255, r)) * maskWeight;
      data[i + 1] = g_orig * (1 - maskWeight) + Math.max(0, Math.min(255, g)) * maskWeight;
      data[i + 2] = b_orig * (1 - maskWeight) + Math.max(0, Math.min(255, b_val)) * maskWeight;
    }
  };

  return (
    <div className="glass p-6 rounded-3xl border border-white/10 space-y-6">
      <div className="flex gap-4 border-b border-white/10 pb-4">
        <button 
          onClick={() => setActiveTab('basic')}
          className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'basic' ? 'text-indigo-400' : 'text-gray-500'}`}
        >
          Basic Adjustments
        </button>
        <button 
          onClick={() => setActiveTab('curves')}
          className={`text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'curves' ? 'text-indigo-400' : 'text-gray-500'}`}
        >
          Curves
        </button>
      </div>

      {activeTab === 'basic' ? (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[9px] font-black uppercase text-gray-500">Brightness</span>
              <span className="text-[9px] font-black text-indigo-400">{brightness}%</span>
            </div>
            <input type="range" min="0" max="200" value={brightness} onChange={(e) => setBrightness(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[9px] font-black uppercase text-gray-500">Contrast</span>
              <span className="text-[9px] font-black text-indigo-400">{contrast}%</span>
            </div>
            <input type="range" min="0" max="200" value={contrast} onChange={(e) => setContrast(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[9px] font-black uppercase text-gray-500">Saturation</span>
              <span className="text-[9px] font-black text-indigo-400">{saturation}%</span>
            </div>
            <input type="range" min="0" max="200" value={saturation} onChange={(e) => setSaturation(parseInt(e.target.value))} className="w-full h-1 bg-white/10 rounded-full appearance-none accent-indigo-500" />
          </div>
        </div>
      ) : (
        <CurvesEditor onUpdate={setLut} />
      )}

      <button 
        onClick={applyAdjustments}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
      >
        Apply Adjustments {maskSrc ? '(Selective)' : '(Global)'}
      </button>
    </div>
  );
};

export default PhotoEditorTools;
