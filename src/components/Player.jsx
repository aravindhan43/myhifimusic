import React, { useState } from 'react';

export default function Player({
  currentSong,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  currentTime = 0,
  duration = 0,
  onSeek,
  volume = 0.8,
  onVolumeChange,
  muted = false,
  onMuteToggle,
  shuffle = false,
  onShuffleToggle,
  repeat = false,
  onRepeatToggle,
  showLyrics,
  setShowLyrics,
  showVisualizer,
  setShowVisualizer,
  onFavorite,
  isFavorited
}) {
  const [showMobileSeek, setShowMobileSeek] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [isWidgetMinimized, setIsWidgetMinimized] = useState(false);

  // Format seconds → mm:ss
  const formatTime = (secs) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeekChange = (e) => {
    if (onSeek) onSeek(parseFloat(e.target.value));
  };

  const handleVolumeSliderChange = (e) => {
    if (onVolumeChange) onVolumeChange(parseFloat(e.target.value));
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleImgError = (e) => {
    e.target.src = '/placeholder-album.png';
  };

  // ── Animated music note bars (playing indicator) ──────────────────
  const MusicPlayingIcon = ({ size = 20 }) => (
    <span className="music-playing-icon" aria-label="Now Playing" style={{ width: size, height: size }}>
      <span className="bar bar1" />
      <span className="bar bar2" />
      <span className="bar bar3" />
      <span className="bar bar4" />
    </span>
  );

  return (
    <div className={`now-playing-bar ${isMobileExpanded ? 'expanded' : ''} ${isWidgetMinimized && !isMobileExpanded ? 'widget-minimized' : ''}`}>

      {/* ════════════════════════════════════════
          DESKTOP LAYOUT & MOBILE FULL (UNIVERSAL)
          ════════════════════════════════════════ */}

      {/* Expanded Player Blurred Background */}
      {isMobileExpanded && currentSong && (
        <div 
          className="expanded-bg-blur"
          style={{ backgroundImage: `url(${currentSong.coverUrl})` }}
        />
      )}

      {/* 0. Mobile Collapse Button */}
      <button 
        className="mobile-collapse-btn" 
        onClick={(e) => { e.stopPropagation(); setIsMobileExpanded(false); }}
        aria-label="Collapse Player"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {/* 1. Left — Song Info */}
      <div className="player-left" onClick={() => { if (!isMobileExpanded) setIsMobileExpanded(true); }}>
        {currentSong ? (
          <>
            <div className="player-artwork-wrap">
              <img
                src={currentSong.coverUrl}
                alt={currentSong.title}
                className="player-artwork"
                onError={handleImgError}
              />
              {isPlaying && (
                <div className="artwork-playing-badge">
                  <MusicPlayingIcon size={14} />
                </div>
              )}
            </div>
            <div className="player-info-container">
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, flex: 1 }}>
                <div className="player-song-title" title={currentSong.title}>{currentSong.title}</div>
                <div className="player-song-artist" title={currentSong.artist}>{currentSong.artist}</div>
              </div>
              <div className="player-expanded-actions-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button 
                  className={`favorite-btn ${isMobileExpanded ? 'expanded-circle-btn' : ''}`}
                  onClick={(e) => { e.stopPropagation(); if (onFavorite) onFavorite(); }}
                  style={{ 
                    background: isMobileExpanded ? 'rgba(255,255,255,0.15)' : 'none', 
                    border: 'none', cursor: 'pointer', padding: isMobileExpanded ? '6px' : '8px', 
                    color: isFavorited ? (isMobileExpanded ? '#fff' : 'var(--accent-color)') : 'rgba(255,255,255,0.8)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: isMobileExpanded ? '36px' : 'auto',
                    height: isMobileExpanded ? '36px' : 'auto'
                  }}
                  aria-label="Favorite"
                >
                  {/* Star icon instead of heart for expanded view matching screenshot */}
                  {isMobileExpanded ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={isFavorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  )}
                </button>

                {isMobileExpanded && (
                  <button 
                    className="expanded-circle-btn visualizer-btn"
                    onClick={(e) => { e.stopPropagation(); setShowVisualizer(!showVisualizer); setShowLyrics(false); }}
                    style={{ 
                      background: 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.8)', borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px'
                    }}
                    title="3D Audio Visualizer"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                  </button>
                )}
                
                {isWidgetMinimized && !isMobileExpanded && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onPlayPause(); }}
                    style={{ background: 'none', border: 'none', color: '#fff', padding: '8px', cursor: 'pointer', marginLeft: '4px' }}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>
                    )}
                  </button>
                )}

                {!isMobileExpanded && (
                  <button 
                    className="widget-minimize-btn"
                    onClick={(e) => { e.stopPropagation(); setIsWidgetMinimized(!isWidgetMinimized); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', padding: '8px', cursor: 'pointer', marginLeft: '4px' }}
                    aria-label={isWidgetMinimized ? "Expand Widget" : "Minimize Widget"}
                  >
                    {isWidgetMinimized ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    )}
                  </button>
                )}
              </div>
            </div>
            <span className="format-badge" style={{ marginLeft: '8px' }}>
              {currentSong.isCloud ? 'Cloud' : 'Local'} Lossless
            </span>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '6px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div className="player-info-container">
              <div className="player-song-title" style={{ color: 'var(--text-tertiary)' }}>No Song Selected</div>
              <div className="player-song-artist" style={{ color: 'var(--text-tertiary)' }}>Select a track to stream</div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Center — Playback controls + seekbar */}
      <div className="player-center">
        <div className="player-buttons">
          {/* Previous */}
          <button className="control-btn" onClick={onPrev} title="Previous" disabled={!currentSong}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19 20 9 12 19 4 19 20"/><rect x="5" y="4" width="4" height="16"/>
            </svg>
          </button>

          {/* Play / Pause */}
          <button className="control-btn play-pause-btn" onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'} disabled={!currentSong}>
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ transform: 'translateX(1px)' }}>
                <polygon points="5 3 19 12 5 21"/>
              </svg>
            )}
          </button>

          {/* Next */}
          <button className="control-btn" onClick={onNext} title="Next" disabled={!currentSong}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"/><rect x="15" y="4" width="4" height="16"/>
            </svg>
          </button>


        </div>

        {/* Timeline Slider */}
        <div className="player-timeline">
          <span className="time-current">{formatTime(currentTime)}</span>
          <div className="timeline-slider-wrapper">
            <input type="range" className="custom-slider" min="0" max={duration || 100} value={currentTime} onChange={handleSeekChange} disabled={!currentSong} />
            <div className="timeline-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="time-remaining">
            {isMobileExpanded && duration > 0 ? `-${formatTime(duration - currentTime)}` : formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 3. Right — Volume + Feature Toggles */}
      <div className="player-right">
        <div className="volume-container">
          <button className="control-btn" style={{ padding: 0 }} onClick={onMuteToggle} title={muted ? 'Unmute' : 'Mute'} disabled={!currentSong}>
            {muted || volume === 0 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            ) : volume < 0.4 ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            )}
          </button>
          <input type="range" className="custom-slider" min="0" max="1" step="0.05" value={muted ? 0 : volume} onChange={handleVolumeSliderChange} disabled={!currentSong} style={{ width: '80px' }} />
        </div>

        {/* Lyrics */}
        <button className={`control-btn ${showLyrics ? 'active' : ''}`} onClick={() => { setShowLyrics(!showLyrics); setShowVisualizer(false); }} title="Lyrics" disabled={!currentSong}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </button>

        {/* Visualizer */}
        <button className={`control-btn ${showVisualizer ? 'active' : ''}`} onClick={() => { setShowVisualizer(!showVisualizer); setShowLyrics(false); }} title="Visualizer Stage View" disabled={!currentSong}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
