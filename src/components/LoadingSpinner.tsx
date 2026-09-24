import React from 'react';

const DOT_COUNT = 8;
const DOT_SIZE = 10;
const ORBIT_RADIUS = 68;

export default function LoadingSpinner() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <div style={{ position: 'relative', width: 170, height: 170 }}>
        {Array.from({ length: DOT_COUNT }).map((_, i) => {
          const angle = (i / DOT_COUNT) * 2 * Math.PI - Math.PI / 2;
          const x = 85 + ORBIT_RADIUS * Math.cos(angle) - DOT_SIZE / 2;
          const y = 85 + ORBIT_RADIUS * Math.sin(angle) - DOT_SIZE / 2;
          const delay = `${(i / DOT_COUNT) * 0.9}s`;
          return (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: '50%',
                backgroundColor: '#F59E0B',
                animation: `petra-spin-fade 0.9s ease-in-out ${delay} infinite`,
              }}
            />
          );
        })}
        <style>{`
          @keyframes petra-spin-fade {
            0%,100% { opacity: 1;    transform: scale(1); }
            50%      { opacity: 0.12; transform: scale(0.55); }
          }
        `}</style>
      </div>
    </div>
  );
}
