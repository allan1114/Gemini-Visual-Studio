
import { useState, useCallback } from 'react';
import { GeminiService } from '../services/geminiService';
import { ImageProcessingService } from '../services/imageProcessingService';
import { AspectRatio, ImageSize, ModelChoice } from '../types';
import { STORAGE_KEYS } from '../constants';

interface SynthesisOptions {
  model: ModelChoice;
  aspectRatio: AspectRatio;
  imageSize: ImageSize;
  negativePrompt: string;
  seed?: number;
  temperature: number;
}

export interface ExtendedPreview {
  id: string;
  url: string;
  aiTags: string[];
  aiDescription: string;
}

export const useImageSynthesis = (onStatsUpdate: (input: number, output: number) => void) => {
  const [isLoading, setIsLoading] = useState(false);
  const [previews, setPreviews] = useState<ExtendedPreview[]>([]);
  const [error, setError] = useState<string | null>(null);

  const checkApiKey = async (model: ModelChoice) => {
    // Only Pro models require specific user-selected keys in AI Studio
    if (model !== 'pro') return;

    // Check if we have a key in localStorage first
    const saved = localStorage.getItem(STORAGE_KEYS.API_KEYS);
    if (saved) {
      const keys = JSON.parse(saved);
      if (keys.some((k: any) => k.isActive)) return;
    }

    // If no local key, check AI Studio platform key
    try {
      if (typeof (window as any).aistudio !== 'undefined') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await (window as any).aistudio.openSelectKey();
        }
      }
    } catch (e) {
      console.warn("API Key selection failed or not supported in this environment.", e);
    }
  };

  const generateSingle = useCallback(async (prompt: string, options: SynthesisOptions, source?: { url: string; mime: string; context?: string; type?: 'edit' | 'avatar' }) => {
    setIsLoading(true);
    setError(null);
    setPreviews([]);
    
    try {
      await checkApiKey(options.model);
      
      const dynamicNeg = await GeminiService.generateDynamicNegativePrompt(prompt).catch(() => "");
      const enhancedNegative = [options.negativePrompt, dynamicNeg].filter(Boolean).join(', ');

      let result;
      if (source && source.type === 'edit') {
        const identityContext = await GeminiService.describeSourceImage(source.url, source.mime).catch(() => "");
        result = await GeminiService.editImage(
          prompt,
          source.context || "",
          source.url,
          source.mime,
          options.model,
          options.aspectRatio,
          options.imageSize,
          enhancedNegative,
          options.seed,
          options.temperature,
          identityContext
        );
      } else if (source && source.type === 'avatar') {
        result = await GeminiService.editImage(
          prompt,
          "Character consistent portrait synthesis",
          source.url,
          source.mime,
          options.model,
          options.aspectRatio,
          options.imageSize,
          enhancedNegative,
          options.seed,
          options.temperature
        );
      } else {
        result = await GeminiService.generateImage(
          prompt, 
          options.aspectRatio, 
          options.imageSize, 
          options.model, 
          enhancedNegative, 
          options.seed, 
          options.temperature
        );
      }
      
      const webpUrl = await ImageProcessingService.processToWebP(result.url);
      onStatsUpdate(result.inputTokens, result.outputTokens);

      const extended: ExtendedPreview = {
        id: crypto.randomUUID(),
        url: webpUrl,
        aiTags: [],
        aiDescription: ""
      };

      setPreviews([extended]);
      setIsLoading(false);

      // Background metadata analysis
      GeminiService.generateMetadata(webpUrl, 'image/webp').then(metadata => {
        setPreviews(prev => prev.map(p => p.id === extended.id ? { ...p, aiTags: metadata.tags, aiDescription: metadata.description } : p));
      }).catch(() => {});

      return extended;
    } catch (err: any) {
      // Automatic fallback to Flash if Pro fails with refusal/safety
      if (options.model === 'pro' && (err.message?.includes('REFUSAL') || err.message === 'SAFETY_BLOCK')) {
        console.log("Pro refused, falling back to Flash...");
        return await generateSingle(prompt, { ...options, model: 'flash' }, source);
      }

      if (err.message === 'API_KEY_MISSING') {
        try {
          if (typeof (window as any).aistudio !== 'undefined') {
            await (window as any).aistudio.openSelectKey();
            setError("Please select an API key from the dialog and try again.");
          } else {
            setError("API Key is missing. Please add a key in the Key Wallet.");
          }
        } catch (e) {
          setError("API Key is missing. Please add a key in the Key Wallet.");
        }
      } else if (err.message === 'SAFETY_BLOCK') {
        setError("Safety Block: Try using more artistic/fashion terminology.");
      } else if (err.message && err.message.includes("Model Refusal")) {
        setError(err.message);
      } else if (err.message === 'NETWORK_ERROR' || (err.message && err.message.includes('Failed to fetch'))) {
        setError("Network Connection Error: Please check your internet connection and try again.");
      } else {
        setError(err.message || "Generation failed.");
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onStatsUpdate]);

  const generateInpaint = useCallback(async (
    instruction: string,
    source: { url: string; mime: string; mask: string },
    options: SynthesisOptions & { semanticTarget?: string }
  ) => {
    setIsLoading(true);
    setError(null);
    setPreviews([]);
    
    try {
      await checkApiKey(options.model);
      
      // Use provided semantic target or analyze if not provided
      const semanticTarget = options.semanticTarget || 
        await GeminiService.analyzeMaskedRegion(source.url, source.mask, instruction).catch(() => "subject");
      
      const dynamicNeg = await GeminiService.generateDynamicNegativePrompt(instruction).catch(() => "");
      const enhancedNegative = [options.negativePrompt, dynamicNeg].filter(Boolean).join(', ');

      const result = await GeminiService.inpaintImage(
        instruction,
        source.url,
        source.mask,
        source.mime,
        options.model,
        options.aspectRatio,
        options.imageSize,
        enhancedNegative,
        options.seed,
        options.temperature,
        semanticTarget
      );
      
      const webpUrl = await ImageProcessingService.processToWebP(result.url);
      onStatsUpdate(result.inputTokens, result.outputTokens);

      const basePreview: ExtendedPreview = {
        id: crypto.randomUUID(),
        url: webpUrl,
        aiTags: [],
        aiDescription: ""
      };
      setPreviews([basePreview]);
      setIsLoading(false);

      // Background metadata analysis
      GeminiService.generateMetadata(webpUrl, 'image/webp').then(metadata => {
        setPreviews(prev => prev.map(p => p.id === basePreview.id ? { ...p, aiTags: metadata.tags, aiDescription: metadata.description } : p));
      }).catch(() => {});
      
      return basePreview;
    } catch (err: any) {
      // Automatic fallback to Flash if Pro fails with refusal/safety
      if (options.model === 'pro' && (err.message?.includes('REFUSAL') || err.message?.includes('SAFETY'))) {
        console.log("Pro inpaint refused, falling back to Flash...");
        return await generateInpaint(instruction, source, { ...options, model: 'flash' });
      }

      if (err.message === 'API_KEY_MISSING') {
        try {
          if (typeof (window as any).aistudio !== 'undefined') {
            await (window as any).aistudio.openSelectKey();
            setError("Please select an API key from the dialog and try again.");
          } else {
            setError("API Key is missing. Please add a key in the Key Wallet.");
          }
        } catch (e) {
          setError("API Key is missing. Please add a key in the Key Wallet.");
        }
      } else if (err.message === 'NETWORK_ERROR' || (err.message && err.message.includes('Failed to fetch'))) {
        setError("Network Connection Error: Please check your internet connection and try again.");
      } else {
        setError(err.message && err.message.includes('SAFETY') ? "Inpaint blocked by safety filters." : (err.message || "Inpaint failed."));
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [onStatsUpdate]);

  return {
    isLoading,
    previews,
    error,
    generateSingle,
    generateInpaint,
    setPreviews,
    setError
  };
};
