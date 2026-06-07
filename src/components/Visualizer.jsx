import React, { useEffect, useRef, useState } from 'react';

export default function Visualizer({ currentSong, analyser, isPlaying, onClose }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const [visualMode, setVisualMode] = useState('bars'); // 'bars' | 'wave' | 'ring'

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas resolution for crisp lines
    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth * window.devicePixelRatio;
      canvas.height = canvas.clientHeight * window.devicePixelRatio;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Set up buffers
    const bufferLength = analyser ? analyser.frequencyBinCount : 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      const width = canvas.width;
      const height = canvas.height;

      // Clear with slight alpha to create motion trails
      ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
      ctx.fillRect(0, 0, width, height);

      if (!analyser || !isPlaying) {
        // Render a gentle idle wave if nothing is playing
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 45, 85, 0.4)';
        ctx.beginPath();
        for (let i = 0; i < width; i++) {
          const x = i;
          const y = height / 2 + Math.sin(i * 0.01 + Date.now() * 0.003) * 15;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        return;
      }

      if (visualMode === 'bars') {
        analyser.getByteFrequencyData(dataArray);
        
        const barWidth = (width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * height * 0.75;

          // Gradient color from neon red to deep purple
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, '#ff2d55');
          gradient.addColorStop(0.5, '#fa243c');
          gradient.addColorStop(1, '#a254f2');

          ctx.fillStyle = gradient;
          
          // Draw rounded bars
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, height - barHeight, barWidth - 4, barHeight, [4, 4, 0, 0]);
            ctx.fill();
          } else {
            ctx.fillRect(x, height - barHeight, barWidth - 4, barHeight);
          }

          x += barWidth;
        }
      } 
      else if (visualMode === 'wave') {
        analyser.getByteTimeDomainData(dataArray);

        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff2d55';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(255, 45, 85, 0.8)';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }
      else if (visualMode === 'ring') {
        analyser.getByteFrequencyData(dataArray);
        
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.2;
        
        // Sum bass values to expand the ring
        let bassSum = 0;
        for (let i = 0; i < 10; i++) bassSum += dataArray[i];
        const bassAverage = bassSum / 10;
        const radiusBoost = (bassAverage / 255) * 45;
        const activeRadius = baseRadius + radiusBoost;

        // Draw rotating radial visualizer
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fa243c';
        ctx.beginPath();

        for (let i = 0; i < bufferLength; i++) {
          const angle = (i / bufferLength) * Math.PI * 2 + (Date.now() * 0.0005);
          const value = (dataArray[i] / 255) * 60;
          const r = activeRadius + value;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        
        ctx.closePath();
        ctx.stroke();
        
        // Draw inner glowing core
        const coreGradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, activeRadius);
        coreGradient.addColorStop(0, 'rgba(255, 45, 85, 0.35)');
        coreGradient.addColorStop(0.7, 'rgba(162, 84, 242, 0.05)');
        coreGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, activeRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [analyser, isPlaying, visualMode]);

  return (
    <div className="visualizer-overlay-container">
      <button className="close-overlay-btn" onClick={onClose}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span>Close Stage View</span>
      </button>

      <div style={{ display: 'flex', gap: '8px', position: 'absolute', top: '32px', left: '48px', zIndex: 30 }}>
        <button 
          className={`control-btn ${visualMode === 'bars' ? 'active' : ''}`}
          onClick={() => setVisualMode('bars')}
          style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '15px', fontSize: '12px' }}
        >
          Spectral Bars
        </button>
        <button 
          className={`control-btn ${visualMode === 'wave' ? 'active' : ''}`}
          onClick={() => setVisualMode('wave')}
          style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '15px', fontSize: '12px' }}
        >
          Fluid Wave
        </button>
        <button 
          className={`control-btn ${visualMode === 'ring' ? 'active' : ''}`}
          onClick={() => setVisualMode('ring')}
          style={{ background: 'rgba(255,255,255,0.06)', padding: '6px 12px', borderRadius: '15px', fontSize: '12px' }}
        >
          Symmetric Ring
        </button>
      </div>

      <canvas ref={canvasRef} className="visualizer-canvas" />

      {currentSong && (
        <div className="visualizer-title-info" style={{ position: 'absolute', bottom: '100px', left: '32px', right: '32px', textAlign: 'left' }}>
          <div className="player-song-title" style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>{currentSong.title}</div>
          <div className="player-song-artist" style={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)' }}>{currentSong.artist} • {currentSong.album}</div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '16px',
            fontSize: '11px',
            color: 'var(--accent-color)',
            background: 'rgba(255,45,85,0.1)',
            padding: '4px 12px',
            borderRadius: '12px',
            fontWeight: '600'
          }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-color)', animation: 'spin 1.5s linear infinite' }}></span>
            Web Audio API Analyser Active
          </div>
        </div>
      )}
    </div>
  );
}
