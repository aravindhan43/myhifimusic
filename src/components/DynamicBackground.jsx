import React, { useEffect, useState, useRef } from 'react';

export default function DynamicBackground({ currentSong }) {
  const [colors, setColors] = useState(['#fa243c', '#5856d6', '#0070c9', '#ff9500']); // Default apple colors
  const imgRef = useRef(null);

  useEffect(() => {
    if (!currentSong || !currentSong.coverUrl) {
      // Default vibrant colors if no song is playing
      setColors(['#fa243c', '#5856d6', '#0070c9', '#ff9500']);
      return;
    }

    const coverUrl = currentSong.coverUrl;
    
    // Fallback if coverUrl is default placeholder
    if (coverUrl.includes('placeholder-album.png') || coverUrl === '') {
      setColors(['#fa243c', '#5856d6', '#0070c9', '#ff9500']);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = coverUrl;
    
    img.onload = () => {
      try {
        // Create tiny canvas to extract average colors
        const canvas = document.createElement('canvas');
        canvas.width = 4;
        canvas.height = 4;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(img, 0, 0, 4, 4);
        const imgData = ctx.getImageData(0, 0, 4, 4).data;
        
        // Pick four distinct pixels for our gradient colors
        const color1 = `rgb(${imgData[0]}, ${imgData[1]}, ${imgData[2]})`;
        const color2 = `rgb(${imgData[16]}, ${imgData[17]}, ${imgData[18]})`;
        const color3 = `rgb(${imgData[32]}, ${imgData[33]}, ${imgData[34]})`;
        const color4 = `rgb(${imgData[48]}, ${imgData[49]}, ${imgData[50]})`;
        
        setColors([color1, color2, color3, color4]);
      } catch (err) {
        console.warn('Could not extract color from cover image (CORS or canvas error):', err);
        // Set beautiful default fallbacks based on art if failed
        setColors(['#ff2d55', '#5856d6', '#8e8e93', '#1c1c1e']);
      }
    };

    img.onerror = () => {
      setColors(['#fa243c', '#5856d6', '#0070c9', '#ff9500']);
    };
  }, [currentSong]);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 0,
      background: 'radial-gradient(circle at center, #101014 0%, #060608 100%)',
      transition: 'background 1.5s'
    }}>
      {/* Drifting Color Bubbles */}
      <div style={{
        position: 'absolute',
        width: '500px',
        height: '500px',
        borderRadius: '50%',
        background: colors[0],
        filter: 'blur(120px)',
        opacity: 0.22,
        top: '-10%',
        left: '-10%',
        animation: 'drift-bubble-1 25s ease-in-out infinite alternate',
        transition: 'background 1.5s ease-in-out'
      }}></div>
      
      <div style={{
        position: 'absolute',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: colors[1],
        filter: 'blur(120px)',
        opacity: 0.18,
        bottom: '-20%',
        right: '-10%',
        animation: 'drift-bubble-2 30s ease-in-out infinite alternate',
        transition: 'background 1.5s ease-in-out'
      }}></div>

      <div style={{
        position: 'absolute',
        width: '450px',
        height: '450px',
        borderRadius: '50%',
        background: colors[2],
        filter: 'blur(110px)',
        opacity: 0.15,
        top: '30%',
        right: '20%',
        animation: 'drift-bubble-3 28s ease-in-out infinite alternate',
        transition: 'background 1.5s ease-in-out'
      }}></div>

      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: colors[3],
        filter: 'blur(120px)',
        opacity: 0.15,
        bottom: '20%',
        left: '20%',
        animation: 'drift-bubble-4 22s ease-in-out infinite alternate',
        transition: 'background 1.5s ease-in-out'
      }}></div>

      {/* Styled drifts animations inject */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes drift-bubble-1 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(120px, 80px) scale(1.15); }
        }
        @keyframes drift-bubble-2 {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-100px, -120px) scale(1.2); }
        }
        @keyframes drift-bubble-3 {
          0% { transform: translate(0, 0) scale(1.05); }
          100% { transform: translate(-80px, 100px) scale(0.9); }
        }
        @keyframes drift-bubble-4 {
          0% { transform: translate(0, 0) scale(0.9); }
          100% { transform: translate(90px, -90px) scale(1.1); }
        }
      `}} />
    </div>
  );
}
