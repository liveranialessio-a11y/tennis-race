import React from 'react';

interface TennisLoadingAnimationProps {
  text?: string;
}

const TennisLoadingAnimation: React.FC<TennisLoadingAnimationProps> = ({ text = 'Caricamento...' }) => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        {/* Tennis Animation Container */}
        <div className="relative w-64 h-64 mx-auto mb-8">
          {/* Tennis Ball */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg
              className="tennis-ball"
              width="60"
              height="60"
              viewBox="0 0 60 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Ball shadow */}
              <ellipse
                cx="30"
                cy="55"
                rx="20"
                ry="3"
                fill="currentColor"
                className="text-muted-foreground/20"
              />
              {/* Ball */}
              <circle cx="30" cy="30" r="25" fill="#C0E64D" />
              {/* Ball curves */}
              <path
                d="M 15 10 Q 30 30 15 50"
                stroke="white"
                strokeWidth="2"
                fill="none"
              />
              <path
                d="M 45 10 Q 30 30 45 50"
                stroke="white"
                strokeWidth="2"
                fill="none"
              />
              {/* Ball shine */}
              <circle cx="20" cy="20" r="6" fill="white" opacity="0.4" />
            </svg>
          </div>

          {/* Tennis Racket */}
          <svg
            className="tennis-racket"
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Racket Handle */}
            <rect
              x="55"
              y="70"
              width="10"
              height="40"
              rx="2"
              fill="#8B4513"
              stroke="#654321"
              strokeWidth="1"
            />
            {/* Racket Head (outer) */}
            <ellipse
              cx="60"
              cy="45"
              rx="28"
              ry="32"
              fill="none"
              stroke="#8B7355"
              strokeWidth="6"
            />
            {/* Racket Head (inner frame) */}
            <ellipse
              cx="60"
              cy="45"
              rx="22"
              ry="26"
              fill="none"
              stroke="#6B5345"
              strokeWidth="2"
            />
            {/* String pattern - vertical */}
            <line x1="45" y1="20" x2="45" y2="70" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="50" y1="18" x2="50" y2="72" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="55" y1="17" x2="55" y2="73" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="60" y1="17" x2="60" y2="73" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="65" y1="17" x2="65" y2="73" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="70" y1="18" x2="70" y2="72" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="75" y1="20" x2="75" y2="70" stroke="#E0E0E0" strokeWidth="0.5" />
            {/* String pattern - horizontal */}
            <line x1="35" y1="30" x2="85" y2="30" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="34" y1="35" x2="86" y2="35" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="33" y1="40" x2="87" y2="40" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="33" y1="45" x2="87" y2="45" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="33" y1="50" x2="87" y2="50" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="34" y1="55" x2="86" y2="55" stroke="#E0E0E0" strokeWidth="0.5" />
            <line x1="35" y1="60" x2="85" y2="60" stroke="#E0E0E0" strokeWidth="0.5" />
          </svg>

          {/* Trail effect */}
          <div className="trail trail-1"></div>
          <div className="trail trail-2"></div>
          <div className="trail trail-3"></div>
        </div>

        {/* Loading Text */}
        <h1 className="text-2xl font-bold text-tennis-court animate-pulse">
          {text}
        </h1>
      </div>

      <style>{`
        @keyframes swing-racket {
          0%, 100% {
            transform: translate(-50%, -50%) rotate(-45deg) translateX(-80px);
          }
          50% {
            transform: translate(-50%, -50%) rotate(45deg) translateX(80px);
          }
        }

        @keyframes bounce-ball {
          0%, 100% {
            transform: translate(-80px, 0) scale(1);
          }
          25% {
            transform: translate(-40px, -20px) scale(0.9);
          }
          50% {
            transform: translate(0, 0) scale(1);
          }
          75% {
            transform: translate(40px, -20px) scale(0.9);
          }
        }

        @keyframes trail-fade {
          0% {
            opacity: 0.6;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.5);
          }
        }

        .tennis-racket {
          position: absolute;
          top: 50%;
          left: 50%;
          transform-origin: center;
          animation: swing-racket 2s ease-in-out infinite;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
        }

        .tennis-ball {
          animation: bounce-ball 2s ease-in-out infinite;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
        }

        .trail {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: radial-gradient(circle, #C0E64D 0%, transparent 70%);
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .trail-1 {
          animation: trail-fade 2s ease-out infinite;
          animation-delay: 0s;
        }

        .trail-2 {
          animation: trail-fade 2s ease-out infinite;
          animation-delay: 0.15s;
        }

        .trail-3 {
          animation: trail-fade 2s ease-out infinite;
          animation-delay: 0.3s;
        }
      `}</style>
    </div>
  );
};

export default TennisLoadingAnimation;
