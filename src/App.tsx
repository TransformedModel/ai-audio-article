/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  Link as LinkIcon, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  Mic2,
  Headphones,
  Share2,
  Calendar,
  User,
  ArrowLeft,
  ExternalLink
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const VOICES = [
  { id: 'Kore', name: 'Kore', description: 'Clear and professional' },
  { id: 'Puck', name: 'Puck', description: 'Energetic and bright' },
  { id: 'Charon', name: 'Charon', description: 'Deep and calm' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Warm and friendly' },
  { id: 'Zephyr', name: 'Zephyr', description: 'Smooth and airy' },
];

const SUGGESTIONS = [
  {
    publication: "The Verge",
    title: "The AI revolution is coming for your smartphone's battery life",
    author: "David Pierce",
    date: "Mar 10, 2025",
    url: "https://www.theverge.com/2025/3/10/ai-smartphone-battery-efficiency-report",
    label: "Technology"
  },
  {
    publication: "The New York Times",
    title: "How GLP-1 Drugs Are Transforming Modern Medicine",
    author: "Anahad O'Connor",
    date: "Mar 09, 2025",
    url: "https://www.nytimes.com/2025/03/09/health/glp1-weight-loss-longevity.html",
    label: "Health"
  },
  {
    publication: "Stratechery",
    title: "The Sovereign Individual and the AI Agent",
    author: "Ben Thompson",
    date: "Mar 08, 2025",
    url: "https://stratechery.com/2025/sovereign-individual-ai-agents/",
    label: "Analysis"
  },
  {
    publication: "Wired",
    title: "Inside the Race to Build a Truly Private LLM",
    author: "Steven Levy",
    date: "Mar 07, 2025",
    url: "https://www.wired.com/story/private-llm-encryption-privacy-ai/",
    label: "AI"
  },
  {
    publication: "Nature",
    title: "Quantum Computing Reaches a New Milestone in Error Correction",
    author: "Elizabeth Gibney",
    date: "Mar 06, 2025",
    url: "https://www.nature.com/articles/d41586-025-00123-x",
    label: "Science"
  },
  {
    publication: "The Washington Post",
    title: "The Hidden Environmental Cost of the AI Boom",
    author: "Chris Mooney",
    date: "Mar 05, 2025",
    url: "https://www.washingtonpost.com/climate-environment/2025/03/05/ai-data-centers-water-usage/",
    label: "Environment"
  },
  {
    publication: "MIT Tech Review",
    title: "Why 2025 is the year of the humanoid robot",
    author: "Will Knight",
    date: "Mar 04, 2025",
    url: "https://www.technologyreview.com/2025/03/04/humanoid-robots-factory-deployment/",
    label: "Robotics"
  },
  {
    publication: "Scientific American",
    title: "New Evidence Suggests Life Could Exist in Enceladus's Subsurface Ocean",
    author: "Lee Billings",
    date: "Mar 03, 2025",
    url: "https://www.scientificamerican.com/article/enceladus-ocean-habitable-conditions-new-data/",
    label: "Space"
  },
  {
    publication: "STAT News",
    title: "The FDA's New Approach to AI-Driven Diagnostics",
    author: "Casey Ross",
    date: "Mar 02, 2025",
    url: "https://www.statnews.com/2025/03/02/fda-ai-medical-devices-regulation-update/",
    label: "Medicine"
  }
];

export default function App() {
  const [url, setUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [articleText, setArticleText] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, audioUrl]);

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsExtracting(true);
    setError(null);
    setArticleText(null);
    setAudioUrl(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      if (!response.ok) {
        // Fallback to Gemini URL Context if backend fetch is forbidden or fails
        if (response.status === 403 || response.status === 500) {
          console.log("Backend fetch failed, trying Gemini URL Context fallback...");
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const geminiResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Extract the main article text from this URL for narration. Return ONLY the article text, no summary or intro: ${url}`,
            config: {
              tools: [{ urlContext: {} }]
            },
          });
          
          if (geminiResponse.text) {
            setArticleText(geminiResponse.text);
            return;
          }
        }
        throw new Error(data.error || 'Failed to extract article');
      }

      setArticleText(data.text);
    } catch (err: any) {
      // Final fallback attempt if the catch block was reached due to a network error
      try {
        console.log("Network error or exception, trying Gemini URL Context fallback...");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const geminiResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Extract the main article text from this URL for narration. Return ONLY the article text, no summary or intro: ${url}`,
          config: {
            tools: [{ urlContext: {} }]
          },
        });
        
        if (geminiResponse.text) {
          setArticleText(geminiResponse.text);
          return;
        }
      } catch (fallbackErr) {
        console.error("Fallback also failed:", fallbackErr);
      }
      setError(err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    try {
      const byteCharacters = atob(base64.replace(/\s/g, ''));
      const pcmData = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        pcmData[i] = byteCharacters.charCodeAt(i);
      }
      
      // Gemini TTS returns raw PCM 16-bit mono at 24000Hz
      // We need to add a WAV header for the <audio> element to play it
      const wavHeader = createWavHeader(pcmData.length, 24000);
      const wavData = new Uint8Array(wavHeader.length + pcmData.length);
      wavData.set(wavHeader, 0);
      wavData.set(pcmData, wavHeader.length);
      
      return new Blob([wavData], { type: 'audio/wav' });
    } catch (e) {
      console.error("Audio processing error:", e);
      throw new Error("Failed to process audio data.");
    }
  };

  const createWavHeader = (dataLength: number, sampleRate: number) => {
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // File length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // Format chunk identifier
    writeString(view, 12, 'fmt ');
    // Format chunk length
    view.setUint32(16, 16, true);
    // Sample format (raw PCM)
    view.setUint16(20, 1, true);
    // Channel count (mono)
    view.setUint16(22, 1, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * 2, true);
    // Block align (channel count * bytes per sample)
    view.setUint16(32, 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // Data chunk identifier
    writeString(view, 36, 'data');
    // Data chunk length
    view.setUint32(40, dataLength, true);
    
    return new Uint8Array(header);
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  const handleGenerateAudio = async () => {
    if (!articleText) return;

    setIsGenerating(true);
    setError(null);
    setAudioUrl(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ 
          parts: [{ 
            text: `Please read this article content naturally and clearly: ${articleText}` 
          }] 
        }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBlob = base64ToBlob(base64Audio, 'audio/wav');
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setIsPlaying(false);
      } else {
        throw new Error("No audio data received from the model.");
      }
    } catch (err: any) {
      console.error("Audio generation error:", err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlay = async () => {
    if (audioRef.current) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          await audioRef.current.play();
          setIsPlaying(true);
        }
      } catch (err: any) {
        console.error("Playback error:", err);
        setError(`Playback failed: ${err.message}. The audio format might be unsupported by your browser.`);
        setIsPlaying(false);
      }
    }
  };

  const resetAudio = async () => {
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err: any) {
        console.error("Reset playback error:", err);
        setError(`Playback failed: ${err.message}`);
        setIsPlaying(false);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingTime = Math.max(0, (duration - currentTime) / playbackSpeed);

  const handleShare = async () => {
    const shareData = {
      title: 'AudioArticle Narration',
      text: `Listen to this article: ${articleText?.substring(0, 100)}...`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleGoHome = () => {
    setArticleText(null);
    setUrl('');
    setAudioUrl(null);
    setError(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-emerald-100">
      <div className="max-w-3xl mx-auto px-6 py-12 md:py-24">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white shadow-sm border border-black/5 mb-6">
            <Headphones className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4">
            AudioArticle
          </h1>
          <p className="text-lg text-neutral-500 max-w-md mx-auto">
            Turn any article into a high-quality narrated experience.
          </p>
        </header>

        {/* Input Section */}
        <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-6 md:p-8 mb-8">
          <form onSubmit={handleExtract} className="space-y-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <LinkIcon className="w-5 h-5 text-neutral-400" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste article URL here..."
                required
                className="w-full pl-12 pr-4 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={isExtracting || !url}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-medium rounded-2xl transition-all flex items-center justify-center gap-2 text-lg shadow-sm"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Extracting Content...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Extract Article
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Suggestions */}
        {!articleText && !isExtracting && (
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="flex items-center justify-between mb-6 px-2">
              <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Suggested Reading</h3>
              <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase tracking-widest">Trending Now</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {SUGGESTIONS.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setUrl(suggestion.url)}
                  className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all text-left group flex flex-col h-full"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">{suggestion.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-400 font-medium">{suggestion.publication}</span>
                      <a 
                        href={suggestion.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 hover:bg-neutral-100 rounded-md transition-colors"
                        title="Open original article"
                      >
                        <ExternalLink className="w-3 h-3 text-neutral-400" />
                      </a>
                    </div>
                  </div>
                  <h4 className="text-base font-medium text-neutral-900 group-hover:text-emerald-700 transition-colors line-clamp-3 mb-4 flex-grow leading-snug">
                    {suggestion.title}
                  </h4>
                  <div className="pt-4 border-t border-neutral-50 flex items-center justify-between mt-auto">
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                      <User className="w-3 h-3" />
                      <span className="truncate max-w-[80px]">{suggestion.author}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                      <Calendar className="w-3 h-3" />
                      <span>{suggestion.date}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Article Preview & Voice Selection */}
        {articleText && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between px-2">
              <button
                onClick={handleGoHome}
                className="flex items-center gap-2 text-neutral-500 hover:text-emerald-600 transition-colors font-medium group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Home
              </button>
              <a 
                href={url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-neutral-500 hover:text-emerald-600 transition-colors font-medium group"
              >
                View Source
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-6 md:p-8">
              <h2 className="text-xl font-medium mb-6 flex items-center gap-2">
                <Mic2 className="w-5 h-5 text-emerald-600" />
                Customize Narration
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setSelectedVoice(voice.id)}
                    className={cn(
                      "p-4 rounded-2xl border text-left transition-all group",
                      selectedVoice === voice.id
                        ? "bg-emerald-50 border-emerald-500 ring-1 ring-emerald-500"
                        : "bg-white border-neutral-200 hover:border-neutral-300"
                    )}
                  >
                    <div className="font-medium mb-1 flex items-center justify-between">
                      {voice.name}
                      {selectedVoice === voice.id && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="text-xs text-neutral-500">{voice.description}</div>
                  </button>
                ))}
              </div>

              <div className="mb-8">
                <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-4">Narration Speed</h3>
                <div className="flex flex-wrap gap-2">
                  {[1, 1.25, 1.5, 1.75, 2].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={cn(
                        "px-4 py-2 rounded-xl border text-sm font-medium transition-all",
                        playbackSpeed === speed
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                          : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                      )}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGenerateAudio}
                disabled={isGenerating}
                className="w-full py-4 bg-black hover:bg-neutral-800 disabled:bg-neutral-300 text-white font-medium rounded-2xl transition-all flex items-center justify-center gap-2 text-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating High Quality Audio...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-5 h-5" />
                    Generate Audio
                  </>
                )}
              </button>
            </div>

            {/* Audio Player */}
            {audioUrl && (
              <div className="bg-emerald-600 rounded-3xl shadow-lg p-8 text-white animate-in zoom-in-95 duration-500">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
                    <Headphones className="w-10 h-10" />
                  </div>
                  
                  <div className="text-center">
                    <h3 className="text-xl font-medium mb-1">Your Audio is Ready</h3>
                    <p className="text-emerald-100 text-sm">Narrated by {selectedVoice} • {playbackSpeed}x</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <button
                      onClick={resetAudio}
                      className="p-3 rounded-full hover:bg-white/10 transition-colors"
                      title="Restart"
                    >
                      <RotateCcw className="w-6 h-6" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="w-16 h-16 rounded-full bg-white text-emerald-600 flex items-center justify-center hover:scale-105 transition-transform shadow-xl"
                    >
                      {isPlaying ? (
                        <Pause className="w-8 h-8 fill-current" />
                      ) : (
                        <Play className="w-8 h-8 fill-current ml-1" />
                      )}
                    </button>
                    <button
                      onClick={handleShare}
                      className="p-3 rounded-full hover:bg-white/10 transition-colors"
                      title="Share"
                    >
                      <Share2 className="w-6 h-6" />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium opacity-80 tabular-nums">
                      -{formatTime(remainingTime)}
                    </span>
                  </div>

                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onError={() => {
                      console.error("Audio element encountered an error");
                      setError("The audio player encountered an error. This might be due to an unsupported audio format.");
                      setIsPlaying(false);
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Content Preview */}
            <div className="bg-white rounded-3xl shadow-sm border border-black/5 p-6 md:p-8">
              <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider mb-4">Extracted Text Preview</h3>
              <div className="prose prose-neutral max-w-none">
                <p className="text-neutral-600 leading-relaxed line-clamp-[10]">
                  {articleText}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-6 py-12 text-center border-t border-black/5 mt-12">
        <p className="text-sm text-neutral-400">
          Powered by Gemini 2.5 Flash & AudioArticle Narration Engine
        </p>
      </footer>
    </div>
  );
}
