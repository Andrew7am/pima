import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
  variant?: 'full' | 'icon' | 'header';
}

export default function Logo({ className = '', size = 120, variant = 'full' }: LogoProps) {
  // Deep Navy blue: #0A2342
  // Elegant Gold: #C5A059
  // Light Cream background: #F7F4EB

  if (variant === 'icon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        {/* House Outline */}
        <path
          d="M20 45 L50 20 L80 45 V75 C80 77 78 79 76 79 H24 C22 79 20 77 20 75 V45 Z"
          stroke="#0A2342"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="white"
        />
        {/* Chimney */}
        <rect x="68" y="24" width="6" height="12" fill="#0A2342" />

        {/* Beautiful Ornate Coptic Cross */}
        <g transform="translate(50, 44) scale(0.7)">
          {/* Main circle in center */}
          <circle cx="0" cy="0" r="4" fill="#C5A059" />
          <circle cx="0" cy="0" r="2.5" fill="none" stroke="#0A2342" strokeWidth="0.8" />
          
          {/* Top Arm */}
          <path d="M-3,-4 L-5,-14 C-5,-16 -2,-17 0,-17 C2,-17 5,-16 5,-14 L3,-4 Z" fill="#C5A059" />
          <circle cx="0" cy="-14" r="1.5" fill="#0A2342" />
          
          {/* Bottom Arm */}
          <path d="M-3,4 L-5,14 C-5,16 -2,17 0,17 C2,17 5,16 5,14 L3,4 Z" fill="#C5A059" />
          <circle cx="0" cy="14" r="1.5" fill="#0A2342" />
          
          {/* Left Arm */}
          <path d="M-4,-3 L-14,-5 C-16,-5 -17,-2 -17,0 C-17,2 -16,5 -14,5 L-4,3 Z" fill="#C5A059" />
          <circle cx="-14" cy="0" r="1.5" fill="#0A2342" />
          
          {/* Right Arm */}
          <path d="M4,-3 L14,-5 C-14,-5 17,-2 17,0 C17,2 16,5 14,5 L4,3 Z" fill="#C5A059" />
          <circle cx="14" cy="0" r="1.5" fill="#0A2342" />

          {/* Ornate diagonal petals/crossbeams */}
          <circle cx="-6" cy="-6" r="1" fill="#C5A059" />
          <circle cx="6" cy="-6" r="1" fill="#C5A059" />
          <circle cx="-6" cy="6" r="1" fill="#C5A059" />
          <circle cx="6" cy="6" r="1" fill="#C5A059" />
        </g>

        {/* Arched Window under cross */}
        <path
          d="M44 72 V63 C44 59.7 46.7 57 50 57 C53.3 57 56 59.7 56 63 V72 Z"
          fill="#0A2342"
          stroke="#C5A059"
          strokeWidth="1.5"
        />
        {/* Window panes */}
        <line x1="50" y1="57" x2="50" y2="72" stroke="#fff" strokeWidth="0.8" />
        <line x1="44" y1="64" x2="56" y2="64" stroke="#fff" strokeWidth="0.8" />
      </svg>
    );
  }

  if (variant === 'header') {
    return (
      <div className={`flex items-center gap-2 select-none ${className}`} dir="rtl">
        <div className="relative p-1 rounded-xl bg-[#F7F4EB] border border-[#C5A059]/30">
          <svg
            width={size * 0.35}
            height={size * 0.35}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* House Outline */}
            <path
              d="M20 45 L50 20 L80 45 V75 C80 77 78 79 76 79 H24 C22 79 20 77 20 75 V45 Z"
              stroke="#0A2342"
              strokeWidth="5"
              strokeLinejoin="round"
              fill="#FDFBF7"
            />
            {/* Chimney */}
            <rect x="68" y="24" width="6" height="12" fill="#0A2342" />

            {/* Cross */}
            <g transform="translate(50, 44) scale(0.65)">
              <circle cx="0" cy="0" r="5" fill="#C5A059" />
              <path d="M-3,-5 L-5,-15 C-5,-17 5,-17 5,-15 L3,-5 Z" fill="#C5A059" />
              <path d="M-3,5 L-5,15 C-5,17 5,17 5,15 L3,5 Z" fill="#C5A059" />
              <path d="M-5,-3 L-15,-5 C-17,-5 -17,5 -15,5 L-5,3 Z" fill="#C5A059" />
              <path d="M5,-3 L15,-5 C17,-5 17,5 15,5 L5,3 Z" fill="#C5A059" />
            </g>

            {/* Window */}
            <path
              d="M44 72 V63 C44 59.7 46.7 57 50 57 C53.3 57 56 59.7 56 63 V72 Z"
              fill="#0A2342"
              stroke="#C5A059"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="flex flex-col text-right">
          <span className="text-xs font-black text-[#0A2342] leading-none tracking-wide">بيما | PiMa</span>
          <span className="text-[8px] text-[#C5A059] font-extrabold mt-0.5">بيوت المؤتمرات القبطية</span>
        </div>
      </div>
    );
  }

  // Full brand representation
  return (
    <div className={`flex flex-col items-center text-center select-none bg-[#FDFBF7] p-6 rounded-[36px] border border-[#D6D6C2] shadow-lg max-w-sm mx-auto ${className}`}>
      {/* 1. App Logo House with Cross */}
      <div className="relative mb-2">
        <svg
          width={size}
          height={size * 0.85}
          viewBox="0 0 160 130"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Main House Base and Roof */}
          <path
            d="M25 65 L80 20 L135 65 V110 C135 112.2 133.2 114 131 114 H29 C26.8 114 25 112.2 25 110 V65 Z"
            stroke="#0A2342"
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="#FDFBF7"
          />
          {/* Chimney */}
          <rect x="115" y="27" width="9" height="20" fill="#0A2342" />

          {/* Golden Coptic Cross - Stylized Ornate */}
          <g transform="translate(80, 60) scale(1.15)">
            {/* Center concentric rings */}
            <circle cx="0" cy="0" r="5.5" fill="#C5A059" />
            <circle cx="0" cy="0" r="3.5" fill="none" stroke="#0A2342" strokeWidth="0.8" />
            
            {/* Top Arm with small flares */}
            <path d="M-3,-5 L-6,-18 C-6,-20.5 -1,-21.5 0,-21.5 C1,-21.5 6,-20.5 6,-18 L3,-5 Z" fill="#C5A059" />
            <circle cx="0" cy="-18" r="2.2" fill="#0A2342" />
            
            {/* Bottom Arm */}
            <path d="M-3,5 L-6,18 C-6,20.5 -1,21.5 0,21.5 C1,21.5 6,20.5 6,18 L3,5 Z" fill="#C5A059" />
            <circle cx="0" cy="18" r="2.2" fill="#0A2342" />
            
            {/* Left Arm */}
            <path d="M-5,-3 L-18,-6 C-20.5,-6 -21.5,-1 -21.5,0 C-21.5,1 -20.5,6 -18,6 L-5,3 Z" fill="#C5A059" />
            <circle cx="-18" cy="0" r="2.2" fill="#0A2342" />
            
            {/* Right Arm */}
            <path d="M5,-3 L18,-6 C20.5,-6 21.5,-1 21.5,0 C21.5,1 20.5,6 18,6 L5,3 Z" fill="#C5A059" />
            <circle cx="18" cy="0" r="2.2" fill="#0A2342" />

            {/* Dots inside arms */}
            <circle cx="-11" cy="0" r="1.2" fill="#0A2342" />
            <circle cx="11" cy="0" r="1.2" fill="#0A2342" />
            <circle cx="0" cy="-11" r="1.2" fill="#0A2342" />
            <circle cx="0" cy="11" r="1.2" fill="#0A2342" />

            {/* Corner blessings dots */}
            <circle cx="-10" cy="-10" r="1.5" fill="#C5A059" />
            <circle cx="10" cy="-10" r="1.5" fill="#C5A059" />
            <circle cx="-10" cy="10" r="1.5" fill="#C5A059" />
            <circle cx="10" cy="10" r="1.5" fill="#C5A059" />
          </g>

          {/* Window shape */}
          <path
            d="M71 114 V94 C71 89 75 85 80 85 C85 85 89 89 89 94 V114 Z"
            fill="#0A2342"
            stroke="#C5A059"
            strokeWidth="2.5"
          />
          {/* Window divider */}
          <line x1="80" y1="85" x2="80" y2="114" stroke="#FDFBF7" strokeWidth="1.2" />
          <line x1="71" y1="99" x2="89" y2="99" stroke="#FDFBF7" strokeWidth="1.2" />
        </svg>
      </div>

      {/* 2. Separation Golden Arc */}
      <div className="w-full h-1 relative overflow-visible mb-3">
        <svg viewBox="0 0 100 10" className="w-full absolute top-[-10px]" preserveAspectRatio="none">
          <path d="M0,10 Q50,-4 100,10" stroke="#C5A059" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {/* 3. Main Brand Text */}
      <div className="flex items-center justify-between w-full border-b border-[#D6D6C2]/40 pb-3" dir="rtl">
        {/* Arabic Brand */}
        <div className="text-right flex-1">
          <div className="text-2xl font-black text-[#0A2342] tracking-normal leading-tight">بيما</div>
          <div className="text-[8.5px] font-bold text-[#C5A059] tracking-tighter mt-0.5">بيوت المؤتمرات القبطية</div>
        </div>

        {/* Separator Line */}
        <div className="h-9 w-[1px] bg-[#C5A059]/40 mx-3" />

        {/* English Brand */}
        <div className="text-left flex-1">
          <div className="text-2xl font-serif font-black text-[#0A2342] tracking-wider leading-tight">PiMa</div>
          {/* Coptic letters for 'Pima' */}
          <div className="text-[9px] font-extrabold text-[#C5A059] mt-0.5" dir="ltr">
            • ⲡⲓⲙⲁ •
          </div>
        </div>
      </div>

      {/* 4. Bottom Blessing Slogan & Calendar */}
      <div className="flex items-center justify-between w-full pt-3" dir="rtl">
        <span className="text-[9.5px] font-bold text-[#8A8A70]">احجز مكانك</span>
        
        {/* Calendar Icon Badge */}
        <div className="bg-[#0A2342] p-1.5 rounded-xl border border-[#C5A059]/40 flex items-center justify-center shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <polyline points="9 16 11 18 15 14" />
          </svg>
        </div>

        <span className="text-[9.5px] font-bold text-[#8A8A70]">للقاء وبركة</span>
      </div>
    </div>
  );
}
