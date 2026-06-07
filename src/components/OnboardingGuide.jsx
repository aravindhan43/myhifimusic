import React, { useState, useEffect } from 'react';

export default function OnboardingGuide({ onComplete }) {
  const [step, setStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Small delay for entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const steps = [
    {
      title: "Welcome to MyHifi",
      desc: "Your personal, ad-free cloud music library. Listen to your favorite tracks anywhere with a beautiful, immersive player.",
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" strokeWidth="1.5">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff2d55" />
              <stop offset="100%" stopColor="#8900ff" />
            </linearGradient>
          </defs>
          <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="6" cy="18" r="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="18" cy="16" r="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: "Upload & Sync",
      desc: "Easily upload MP3s, WAVs, or FLACs directly from your device. Your library instantly syncs across desktop and mobile.",
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: "Build Playlists",
      desc: "Curate your perfect mood by creating custom playlists. Easily manage your collections with our lightning-fast interface.",
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="9" y1="3" x2="9" y2="21" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      title: "Immersive Player",
      desc: "Experience your music with real-time visualizers, time-synced lyrics, and gorgeous dynamic backgrounds that match the album art.",
      icon: (
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
          <polygon points="10 8 16 12 10 16 10 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setIsVisible(false);
      setTimeout(onComplete, 300); // Wait for exit animation
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: isVisible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(28, 28, 30, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 30px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Glow effect */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at center, rgba(255,45,85,0.08) 0%, rgba(137,0,255,0.03) 30%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), 0 10px 20px rgba(0,0,0,0.2)'
          }}>
            {steps[step].icon}
          </div>

          <h2 style={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '28px',
            fontWeight: '800',
            letterSpacing: '-0.5px',
            margin: '0 0 12px',
            background: 'linear-gradient(135deg, #fff 0%, #a0a0a5 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {steps[step].title}
          </h2>
          
          <p style={{
            fontSize: '15px',
            color: 'var(--text-secondary)',
            lineHeight: '1.6',
            margin: '0 0 32px',
            minHeight: '72px'
          }}>
            {steps[step].desc}
          </p>

          {/* Dots Indicator */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: step === i ? '24px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: step === i ? 'var(--accent-color)' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s ease'
              }} />
            ))}
          </div>

          <button
            onClick={handleNext}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--accent-color) 0%, #8900ff 100%)',
              color: '#fff',
              border: 'none',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(255, 45, 85, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 12px 24px rgba(255, 45, 85, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(255, 45, 85, 0.3)';
            }}
          >
            {step < steps.length - 1 ? 'Next' : 'Get Started'}
          </button>
        </div>
      </div>
    </div>
  );
}
