"use client";
import React from 'react';

const DotLoadingSpinner = ({ size = 180, text = "OneVega..." }) => {
  // Number of dots in the circle
  const dotCount = 18;
  
  // Generate dots positioned in a circle
  const dots = Array.from({ length: dotCount }, (_, i) => {
    // Calculate position around the circle
    const angle = (i * 360) / dotCount;
    const radians = (angle * Math.PI) / 180;
    
    // Calculate x,y coordinates
    const radius = size / 2 - 14; // slight inset from edge
    const x = size / 2 + radius * Math.sin(radians);
    const y = size / 2 - radius * Math.cos(radians);
    
    return {
      id: i,
      angle,
      x,
      y
    };
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-55 z-50">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {dots.map((dot, index) => (
            <circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={3} // Small fixed size for dots
              fill="white"
              className="loading-dot"
              style={{
                animationDelay: `${-index * (1.2 / dotCount)}s`
              }}
            />
          ))}
          
          {/* Center text */}
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize={size / 12}
            fontFamily="Arial, sans-serif"
            letterSpacing="1"
          >
            {text}
          </text>
        </svg>

        <style jsx>{`
          .loading-dot {
            animation: glow 1.2s linear infinite;
          }
          
          @keyframes glow {
            0%, 100% {
              opacity: 0.2;
            }
            50% {
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
};

// Optional: Create a wrapper component to control when to show the spinner
const LoadingOverlay: React.FC<{ isLoading: boolean; children: React.ReactNode }> = ({ isLoading, children }) => {
  return (
    <>
      {children}
      {isLoading && <DotLoadingSpinner />}
    </>
  );
};

export { DotLoadingSpinner, LoadingOverlay };
export default DotLoadingSpinner;