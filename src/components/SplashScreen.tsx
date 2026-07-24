import { useEffect, useState } from 'react';
import petraLogo from '../assets/images/petra-logo.svg';

const KEYFRAMES = `
  @keyframes splashIn {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes splashOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
`;

interface SplashScreenProps {
  onDone: () => void;
}

export default function SplashScreen({ onDone }: SplashScreenProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const startExit = setTimeout(() => setExiting(true), 3000);
    const finish    = setTimeout(() => onDone(), 3600);
    return () => {
      clearTimeout(startExit);
      clearTimeout(finish);
    };
  }, [onDone]);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#1a0a00',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: exiting
            ? 'splashOut 0.6s ease forwards'
            : 'splashIn 1s ease forwards',
        }}
      >
        {/* Subtle warm radial glow centred behind the logo */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '520px',
            height: '520px',
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at center, rgba(201,120,40,0.12) 0%, transparent 68%)',
            pointerEvents: 'none',
          }}
        />

        {/* Logo — brightness(0) collapses all pixels to black, invert(1) flips to white */}
        <img
          src={petraLogo}
          alt=""
          width={260}
          style={{
            display: 'block',
            filter: 'brightness(0) invert(1)',
            position: 'relative',
          }}
        />

        {/* Petra */}
        <p
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: '60px',
            fontWeight: 400,
            color: '#1D2D5F',
            margin: '20px 0 8px',
            lineHeight: 1,
          }}
        >
          Petra
        </p>

        {/* Full Gospel Church */}
        <p
          style={{
            fontSize: '22px',
            fontWeight: 400,
            color: '#ffffff',
            opacity: 0.85,
            letterSpacing: '0.06em',
            margin: '0 0 14px',
          }}
        >
          Full Gospel Church
        </p>

        {/* KIRA · UGANDA */}
        <p
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#c97828',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          Kira · Uganda
        </p>
      </div>
    </>
  );
}
