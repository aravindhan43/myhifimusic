import React, { useState } from 'react';

export default function Dashboard({ songs = [], playlists = [], history = [], onPlaySong, setActiveTab, onLogout, currentUser }) {
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // Recently uploaded songs (limit to last 6)
  const recentSongs = [...songs]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  // Recently played songs
  const uniqueHistoryIds = [...new Set([...history].reverse())];
  const recentlyPlayed = uniqueHistoryIds
    .map(id => songs.find(s => s.id === id))
    .filter(Boolean)
    .slice(0, 6);

  // Artist categories
  const artists = [...new Set(songs.map(s => s.artist).filter(Boolean))];
  const artistCategories = artists.map(artist => {
    const artistSongs = songs.filter(s => s.artist === artist);
    return {
      name: artist,
      coverUrl: artistSongs[0]?.coverUrl || '/placeholder-album.png',
      count: artistSongs.length
    };
  });

  // Favorites
  const favPlaylist = playlists.find(p => p.name.toLowerCase() === 'favorites');
  const favSongs = favPlaylist && favPlaylist.songIds 
    ? favPlaylist.songIds.map(id => songs.find(s => s.id === id)).filter(Boolean)
    : [];

  // Fallback covers
  const handleImgError = (e) => {
    e.target.src = '/placeholder-album.png';
  };

  return (
    <div>
      <div className="sticky-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h1 style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: '800', letterSpacing: '2px', margin: 0, textTransform: 'uppercase', display: 'flex', alignItems: 'center', color: '#fff' }}>
            MYHIF
            <svg width="24" height="36" viewBox="0 0 20 36" fill="currentColor" style={{ marginLeft: '1px', marginRight: '6px' }}>
              {/* Dot for the 'i' */}
              <circle cx="10" cy="10" r="2.5" />
              {/* Stem */}
              <rect x="9" y="15" width="2.5" height="14" />
              {/* Flag */}
              <path d="M11.5 15 C 16 15 17 19 17 22 C 15 18 13 18 11.5 18 Z" />
              {/* Note head */}
              <circle cx="7" cy="29" r="4" />
            </svg>
            <svg width="24" height="28" viewBox="0 0 24 32" fill="none">
              <rect x="0" y="0" width="24" height="32" rx="4" fill="white" />
              <circle cx="12" cy="10" r="3" fill="#141419" />
              <circle cx="12" cy="22" r="5" fill="#141419" />
            </svg>
          </h1>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="sync-button" 
            style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '20px', margin: 0 }}
            onClick={() => setActiveTab('upload')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
            Upload Music
          </button>
          
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAccountMenu(!showAccountMenu)}
              style={{ 
                width: '34px', 
                height: '34px', 
                borderRadius: '50%', 
                background: 'rgba(255,255,255,0.05)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                margin: 0,
                padding: 0
              }}
              aria-label="Account Settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </button>
            
            {showAccountMenu && (
              <>
                <div 
                  onClick={() => setShowAccountMenu(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    zIndex: 999
                  }}
                />
                <div 
                  style={{
                    position: 'fixed',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '90%',
                    maxWidth: '300px',
                    background: 'rgba(20, 20, 25, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
                    padding: '24px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px'
                  }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', textAlign: 'center', width: '100%' }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#fff', wordBreak: 'break-all' }}>{currentUser || 'Guest'}</span>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{currentUser ? `${currentUser.toLowerCase()}@antigravity.pro` : 'guest@antigravity.pro'}</span>
                  </div>
                  <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', width: '100%' }} />
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      if (onLogout) onLogout();
                    }}
                    style={{
                      width: '100%',
                      background: 'rgba(255, 59, 48, 0.1)',
                      color: '#ff3b30',
                      border: 'none',
                      padding: '12px',
                      borderRadius: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontSize: '15px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Log Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Last Played Featured Card */}
      {recentlyPlayed.length > 0 && (
        <div 
          onClick={() => onPlaySong(recentlyPlayed[0], songs)}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '20px', 
            background: 'linear-gradient(135deg, rgba(255, 45, 85, 0.15), rgba(88, 86, 214, 0.1))',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '32px',
            cursor: 'pointer',
            transition: 'transform 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 45, 85, 0.2), rgba(88, 86, 214, 0.15))';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 45, 85, 0.15), rgba(88, 86, 214, 0.1))';
          }}
        >
          <img 
            src={recentlyPlayed[0].coverUrl} 
            alt={recentlyPlayed[0].title}
            onError={handleImgError}
            style={{ width: '90px', height: '90px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <p style={{ fontSize: '13px', color: 'var(--accent-color)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '6px', margin: 0 }}>
              Jump Back In
            </p>
            <h3 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', margin: '0 0 4px 0', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {recentlyPlayed[0].title}
            </h3>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', margin: 0, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {recentlyPlayed[0].artist}
            </p>
          </div>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(255, 45, 85, 0.4)', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '4px' }}>
              <polygon points="5 3 19 12 5 21" />
            </svg>
          </div>
        </div>
      )}

      {/* Recently Played Section */}
      {recentlyPlayed.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header">
            <h2 className="section-title">Recently Played</h2>
          </div>
          <div className="carousel-container">
            {recentlyPlayed.map(song => (
              <div key={`recent-played-${song.id}`} className="music-card" onClick={() => onPlaySong(song, songs)}>
                <div className="artwork-wrapper">
                  <img 
                    src={song.coverUrl} 
                    alt={song.title} 
                    className="card-artwork" 
                    onError={handleImgError}
                  />
                  <div className="hover-overlay">
                    <div className="play-btn-circle">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="card-info">
                  <div className="card-title">{song.title}</div>
                  <div className="card-artist">{song.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Artist Categories Section */}
      {artistCategories.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <div className="section-header">
            <h2 className="section-title">Artists</h2>
            <button 
              onClick={() => setActiveTab('songs')}
              style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              See All
            </button>
          </div>
          <div className="carousel-container">
            {artistCategories.map(artist => (
              <div key={`artist-${artist.name}`} className="music-card" onClick={() => setActiveTab('songs')}>
                <div className="artwork-wrapper" style={{ borderRadius: '50%', overflow: 'hidden' }}>
                  <img 
                    src={artist.coverUrl} 
                    alt={artist.name} 
                    className="card-artwork" 
                    onError={handleImgError}
                  />
                  <div className="hover-overlay">
                    <div className="play-btn-circle" style={{ background: 'var(--accent-color)' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="card-info" style={{ textAlign: 'center' }}>
                  <div className="card-title">{artist.name}</div>
                  <div className="card-artist">{artist.count} {artist.count === 1 ? 'track' : 'tracks'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Added Section */}
      <div className="section-header">
        <h2 className="section-title">Recently Added</h2>
        <button 
          onClick={() => setActiveTab('songs')}
          style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >
          See All
        </button>
      </div>

      {recentSongs.length === 0 ? (
        <div className="empty-state" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
          <div className="empty-state-icon">🎵</div>
          <h3>Your Library is Empty</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '300px' }}>
            Start building your cloud catalog by uploading your first audio file.
          </p>
          <button className="empty-state-btn" onClick={() => setActiveTab('upload')}>
            Add First Song
          </button>
        </div>
      ) : (
        <div className="carousel-container">
          {recentSongs.map(song => (
            <div key={song.id} className="music-card" onClick={() => onPlaySong(song, songs)}>
              <div className="artwork-wrapper">
                <img 
                  src={song.coverUrl} 
                  alt={song.title} 
                  className="card-artwork" 
                  onError={handleImgError}
                />
                <div className="hover-overlay">
                  <div className="play-btn-circle">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="card-info">
                <div className="card-title">{song.title}</div>
                <div className="card-artist">{song.artist}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Favorites Section */}
      {favSongs.length > 0 && (
        <div style={{ marginTop: '32px' }}>
          <div className="section-header">
            <h2 className="section-title">Your Favorites</h2>
          </div>
          <div className="carousel-container">
            {favSongs.map(song => (
              <div key={song.id} className="music-card" onClick={() => onPlaySong(song, favSongs)}>
                <div className="artwork-wrapper">
                  <img 
                    src={song.coverUrl} 
                    alt={song.title} 
                    className="card-artwork" 
                    onError={handleImgError}
                  />
                  <div className="hover-overlay">
                    <div className="play-btn-circle">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21" />
                      </svg>
                    </div>
                  </div>
                  {/* Small heart badge on artwork */}
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '4px', borderRadius: '50%', display: 'flex' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--accent-color)" stroke="none">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                </div>
                <div className="card-info">
                  <div className="card-title">{song.title}</div>
                  <div className="card-artist">{song.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
