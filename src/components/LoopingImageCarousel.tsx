import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Upload, Sparkles, Image as ImageIcon, X, Play, Pause } from 'lucide-react';

// Default generated high-end images
import TechFellowshipImg from '../assets/images/tech_fellowship_1780923670010.png';
import BusinessLeadershipImg from '../assets/images/business_leadership_1780923684687.png';
import CreativeMindsImg from '../assets/images/creative_minds_1780923699552.png';
import FellowshipGatheringImg from '../assets/images/fellowship_gathering_1780923714427.png';

interface Slide {
  id: string;
  url: string;
  title: string;
  subtitle: string;
  badge: string;
}

const DEFAULT_SLIDES: Slide[] = [
  {
    id: 'slide-1',
    url: TechFellowshipImg,
    title: 'Technology Fellowship',
    subtitle: 'Where developers, architects, and designers build high-caliber solutions.',
    badge: 'Technology Hub'
  },
  {
    id: 'slide-2',
    url: BusinessLeadershipImg,
    title: 'Business & Entrepreneurship',
    subtitle: 'Connecting visionaries to incubate, fund, and scale ethical ventures.',
    badge: 'Business Hub'
  },
  {
    id: 'slide-3',
    url: CreativeMindsImg,
    title: 'Media & Divine Creativity',
    subtitle: 'uniting writers, designers, and visual artists to shape modern culture.',
    badge: 'Media Hub'
  },
  {
    id: 'slide-4',
    url: FellowshipGatheringImg,
    title: 'Kingdom Stewardship Assemblies',
    subtitle: 'Dynamic networking sessions aligning careers with church ministries.',
    badge: 'Joint Assemblies'
  }
];

export default function LoopingImageCarousel() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-play interval
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      handleNext();
    }, 4500);
    return () => clearInterval(interval);
  }, [currentIndex, isPlaying, slides.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  // Drag and drop processing
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const processFiles = (fileList: FileList) => {
    const validImageFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
    
    if (validImageFiles.length === 0) return;

    validImageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const base64Url = event.target.result as string;
          const newSlide: Slide = {
            id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            url: base64Url,
            title: file.name.split('.')[0].replace(/[-_]/g, ' '),
            subtitle: 'Successfully uploaded custom community slide.',
            badge: 'Custom Slide'
          };
          
          setSlides(prev => {
            const updated = [...prev, newSlide];
            // Immediately jump to the newly added slide
            setCurrentIndex(updated.length - 1);
            return updated;
          });
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeSlide = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (slides.length <= 1) return; // Prevent removing all slides
    
    setSlides(prev => {
      const filtered = prev.filter(s => s.id !== idToRemove);
      // Reset index to prevent indexing errors
      setCurrentIndex((prevIndex) => {
        if (prevIndex >= filtered.length) {
          return filtered.length - 1;
        }
        return prevIndex;
      });
      return filtered;
    });
  };

  return (
    <div className="w-full h-full flex flex-col space-y-5" id="carousel-outer-wrapper">
      {/* 1. Main Carousel Frame */}
      <div 
        className={`relative overflow-hidden aspect-[4/3] rounded-2xl border transition-all duration-300 shadow-2xl ${
          isDragging 
            ? 'border-[#c5a880] scale-[0.99] bg-[#c5a880]/10' 
            : 'border-neutral-800 bg-[#121319]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        id="carousel-main-viewport"
      >
        {/* Sliding images container */}
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              {/* Image element with required referrer policy */}
              <img 
                src={slides[currentIndex].url} 
                alt={slides[currentIndex].title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover select-none"
              />
              {/* Elegant dark overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent z-10" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel controls & headers */}
        <div className="absolute top-4 inset-x-4 flex justify-between items-center z-20">
          {/* Active Badge banner */}
          <span className="bg-black/70 backdrop-blur-md border border-[#c5a880]/30 text-[#c5a880] text-[9.5px] font-mono font-bold uppercase tracking-wider py-1 px-3 rounded-full flex items-center gap-1.5 shadow-md">
            <Sparkles size={10} className="text-yellow-400" />
            {slides[currentIndex].badge}
          </span>

          {/* Controls bar (Play/Pause, Remove if custom) */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayback}
              className="w-7 h-7 bg-black/70 hover:bg-neutral-900 border border-neutral-800 rounded-full flex items-center justify-center text-white transition cursor-pointer"
              title={isPlaying ? 'Pause auto-rotation' : 'Play auto-rotation'}
            >
              {isPlaying ? <Pause size={11} /> : <Play size={11} className="ml-[1px]" />}
            </button>

            {slides[currentIndex].id.startsWith('custom-') && (
              <button
                onClick={(e) => removeSlide(slides[currentIndex].id, e)}
                className="w-7 h-7 bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 rounded-full flex items-center justify-center transition cursor-pointer"
                title="Remove uploaded image"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Left/Right manual arrows */}
        <button
          onClick={handlePrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-neutral-900/80 border border-neutral-800/80 text-white flex items-center justify-center transition opacity-60 hover:opacity-100 cursor-pointer"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-neutral-900/80 border border-neutral-800/80 text-white flex items-center justify-center transition opacity-60 hover:opacity-100 cursor-pointer"
        >
          <ChevronRight size={16} />
        </button>

        {/* Captions Overlay at Bottom */}
        <div className="absolute bottom-0 inset-x-0 p-5 pt-10 z-20 text-left">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4 }}
              className="space-y-1.5"
            >
              <h4 className="font-serif text-lg font-bold text-white tracking-tight leading-tight uppercase font-sans">
                {slides[currentIndex].title}
              </h4>
              <p className="text-neutral-300 text-[11px] leading-relaxed max-w-[85%]">
                {slides[currentIndex].subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Drag and Drop visual notification mask */}
        {isDragging && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col justify-center items-center text-center p-6 pointer-events-none border-2 border-dashed border-[#c5a880]/80 rounded-2xl animate-fade-in">
            <Upload className="text-[#c5a880] w-12 h-12 mb-3 animate-bounce" />
            <span className="text-white font-bold text-sm">Drop Custom Images of Your Fellowships</span>
            <span className="text-neutral-400 text-xs mt-1">Files will load automatically in real time</span>
          </div>
        )}
      </div>
    </div>
  );
}
