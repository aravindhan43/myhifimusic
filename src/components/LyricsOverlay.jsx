import React, { useState, useEffect } from 'react';

export default function LyricsOverlay({ currentSong, onClose, onUpdateSong }) {
  const [lyrics, setLyrics] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [typedLyrics, setTypedLyrics] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentSong) {
      setLyrics(currentSong.lyrics || '');
      setTypedLyrics(currentSong.lyrics || '');
      setIsEditing(!currentSong.lyrics);
    }
  }, [currentSong]);

  const handleSaveLyrics = async () => {
    if (!currentSong) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/songs/${currentSong.id}/lyrics`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({ lyrics: typedLyrics })
      });
      
      if (res.ok) {
        const updated = await res.json();
        setLyrics(typedLyrics);
        setIsEditing(false);
        if (onUpdateSong) {
          onUpdateSong(updated);
        }
      } else {
        alert('Failed to save lyrics');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to server');
    } finally {
      setSaving(false);
    }
  };

  const lyricLines = lyrics ? lyrics.split('\n') : [];

  return (
    <div className="lyrics-overlay-container">
      <button className="close-overlay-btn" onClick={onClose} style={{ zIndex: 30 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <span>Close Lyrics</span>
      </button>

      {/* Left Artwork Section */}
      <div className="lyrics-left-art">
        {currentSong && (
          <>
            <img 
              src={currentSong.coverUrl} 
              alt={currentSong.title} 
              className="lyrics-artwork-giga"
              onError={(e) => { e.target.src = '/placeholder-album.png'; }}
            />
            <div className="lyrics-track-title">{currentSong.title}</div>
            <div className="lyrics-track-artist">{currentSong.artist} • {currentSong.album}</div>
            
            {lyrics && (
              <button 
                className="test-btn" 
                onClick={() => setIsEditing(!isEditing)}
                style={{ marginTop: '20px', background: 'rgba(255,255,255,0.06)' }}
              >
                {isEditing ? 'View Lyrics' : 'Edit Lyrics'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Right Content Section */}
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {isEditing ? (
          <div className="lyrics-creator-container">
            <h3 style={{ fontFamily: 'Outfit', fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
              Add Lyrics for "{currentSong?.title}"
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Paste or type the lyrics below. Separate each line with a simple press of the Enter key.
            </p>
            <textarea
              className="lyrics-textarea"
              placeholder="e.g.&#10;Wise man said only fools rush in&#10;But I can't help falling in love with you..."
              value={typedLyrics}
              onChange={(e) => setTypedLyrics(e.target.value)}
            />
            <button 
              className="sync-button" 
              onClick={handleSaveLyrics} 
              disabled={saving}
              style={{ width: '100%' }}
            >
              {saving ? <div className="spinner"></div> : 'Save Lyrics to Cloud'}
            </button>
          </div>
        ) : (
          <div className="lyrics-right-scroller">
            {lyricLines.map((line, idx) => (
              <div 
                key={idx} 
                className={`lyric-line ${idx === 0 ? 'active' : ''}`} // Make first line highlighted as a premium mock
                style={{ marginBottom: '8px' }}
              >
                {line || '• • •'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
