import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Player from './components/Player';
import Dashboard from './components/Dashboard';
import UploadModal from './components/UploadModal';
import SettingsPanel from './components/SettingsPanel';
import Playlists from './components/Playlists';
import Visualizer from './components/Visualizer';
import LyricsOverlay from './components/LyricsOverlay';
import DynamicBackground from './components/DynamicBackground';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel';
import OnboardingGuide from './components/OnboardingGuide';

// Secure fetch wrapper to automatically attach JWT tokens to backend requests
const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('cloud_lib_session');
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  const res = await fetch(url, options);
  if (res.status === 401 && !url.includes('/api/auth/')) {
    localStorage.removeItem('cloud_lib_session');
    localStorage.removeItem('cloud_lib_user');
    window.location.reload();
  }
  return res;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('cloud_lib_session'));
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem('has_seen_onboarding') !== 'true');
  const isAdmin = localStorage.getItem('cloud_lib_role') === 'admin';
  const [activeTab, setActiveTab] = useState('listen-now');
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [settings, setSettings] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      localStorage.setItem('sidebar_collapsed', String(!prev));
      return !prev;
    });
  };
  
  // Audio playback state
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  
  // Active queue
  const [playbackQueue, setPlaybackQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null);
  
  // Feature overlays
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Row dropdown menus
  const [activeRowMenuId, setActiveRowMenuId] = useState(null);
  const [activeAddToPlaylistId, setActiveAddToPlaylistId] = useState(null);

  // Audio nodes refs
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);

  // Load initial catalog only when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchSongs();
      fetchPlaylists();
      fetchSettings();
    }
  }, [isAuthenticated]);

  const fetchSongs = async () => {
    try {
      const res = await authFetch('/api/songs');
      if (res.ok) {
        const data = await res.json();
        setSongs(data);
      }
    } catch (err) {
      console.error('Error fetching songs:', err);
    }
  };

  const fetchPlaylists = async () => {
    try {
      const res = await authFetch('/api/playlists');
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
      }
    } catch (err) {
      console.error('Error fetching playlists:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await authFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleFavorite = async (song) => {
    if (!song) return;
    
    // Find Favorites playlist
    let favPlaylist = playlists.find(p => p.name.toLowerCase() === 'favorites');
    
    // Create it if it doesn't exist
    if (!favPlaylist) {
      try {
        const createRes = await authFetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Favorites', description: 'Your favorite tracks' })
        });
        if (createRes.ok) {
          favPlaylist = await createRes.json();
          setPlaylists(prev => [...prev, favPlaylist]);
        } else {
          return; // failed to create
        }
      } catch (err) {
        console.error('Error creating Favorites playlist', err);
        return;
      }
    }

    // Toggle song in Favorites playlist
    const isFavorited = (favPlaylist.songIds || []).includes(song.id);
    try {
      const endpoint = `/api/playlists/${favPlaylist.id}/${isFavorited ? 'remove' : 'add'}`;
      const actionRes = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: song.id })
      });
      if (actionRes.ok) {
        const updatedPl = await actionRes.json();
        setPlaylists(prev => prev.map(p => p.id === updatedPl.id ? updatedPl : p));
      }
    } catch (err) {
      console.error('Error toggling favorite', err);
    }
  };

  // Web Audio Context setup
  const initWebAudio = () => {
    if (audioContextRef.current) return; // Already setup

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      // Connect source to analyser and output
      // NOTE: audio element must have crossOrigin="anonymous" for cross-origin Cloudinary URLs
      if (audioRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);

        sourceRef.current = source;
        audioContextRef.current = ctx;
        analyserRef.current = analyser;
      }
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
      // Clean up any partial state so the audio element is never left disconnected
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    }
  };

  // Playback Control Triggers
  const handlePlaySong = (song, queue = songs) => {
    const trackChanged = !currentSong || currentSong.id !== song.id;

    if (trackChanged) {
      setCurrentSong(song);
      setPlaybackQueue(queue);
      setHistory(prev => [...prev, song.id]);

      // Set src directly on the DOM element immediately (don't wait for React re-render)
      // This keeps play() in the same user-gesture context — required for mobile autoplay
      if (audioRef.current) {
        audioRef.current.src = song.audioUrl;
        audioRef.current.load();
      }
    }

    if (audioRef.current) {
      // Initialize Web Audio API (must be inside a user gesture)
      initWebAudio();

      // Resume AudioContext if browser suspended it
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Audio play failed:', err));
    }
  };

  const handlePlayPause = () => {
    if (!currentSong) return;
    initWebAudio();

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (playbackQueue.length === 0) return;
    
    let nextIndex = 0;
    
    if (shuffle) {
      // Pick random index from queue
      nextIndex = Math.floor(Math.random() * playbackQueue.length);
    } else {
      const currentIndex = playbackQueue.findIndex(s => s.id === currentSong.id);
      nextIndex = (currentIndex + 1) % playbackQueue.length;
    }

    const nextSong = playbackQueue[nextIndex];
    if (nextSong) {
      handlePlaySong(nextSong, playbackQueue);
    }
  };

  const handlePrev = () => {
    if (playbackQueue.length === 0) return;

    let prevIndex = 0;
    const currentIndex = playbackQueue.findIndex(s => s.id === currentSong.id);
    
    if (currentTime > 5) {
      // Restart song if played more than 5s
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (shuffle) {
      prevIndex = Math.floor(Math.random() * playbackQueue.length);
    } else {
      prevIndex = currentIndex - 1;
      if (prevIndex < 0) prevIndex = playbackQueue.length - 1;
    }

    const prevSong = playbackQueue[prevIndex];
    if (prevSong) {
      handlePlaySong(prevSong, playbackQueue);
    }
  };

  const handleSeek = (newTime) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    setMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      audioRef.current.muted = newVol === 0;
    }
  };

  const handleMuteToggle = () => {
    const targetMute = !muted;
    setMuted(targetMute);
    if (audioRef.current) {
      audioRef.current.muted = targetMute;
    }
  };

  // Audio HTML5 Events
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    if (repeat) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      handleNext();
    }
  };

  // Manage custom lyrics update
  const handleUpdateSong = (updatedSong) => {
    setSongs(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
    if (currentSong && currentSong.id === updatedSong.id) {
      setCurrentSong(updatedSong);
    }
  };

  // Track deletion handler
  const handleDeleteSong = async (songId) => {
    if (!window.confirm('Are you sure you want to delete this track from your cloud library?')) return;
    
    try {
      const res = await authFetch(`/api/songs/${songId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // If playing the deleted song, stop
        if (currentSong && currentSong.id === songId) {
          setIsPlaying(false);
          setCurrentSong(null);
        }
        setSongs(prev => prev.filter(s => s.id !== songId));
        fetchPlaylists(); // Refresh playlists since songs might have been removed
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  // Quick Playlist Add helper
  const handleAddTrackToPlaylist = async (playlistId, songId) => {
    try {
      const res = await authFetch(`/api/playlists/${playlistId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId })
      });
      if (res.ok) {
        const updated = await res.json();
        setPlaylists(prev => prev.map(p => p.id === playlistId ? updated : p));
        alert('Song added to playlist!');
        setActiveRowMenuId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('cloud_lib_session');
    localStorage.removeItem('cloud_lib_user');
    setIsAuthenticated(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentSong(null);
  };

  // Filter songs by search query
  const filteredSongs = songs.filter(song => {
    const q = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(q) ||
      song.artist.toLowerCase().includes(q) ||
      song.album.toLowerCase().includes(q) ||
      song.genre.toLowerCase().includes(q)
    );
  });

  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Dynamic drifting colorful blurred backdrop */}
      <DynamicBackground currentSong={currentSong} />

      {/* Hidden HTML5 Audio Component */}
      {/* crossOrigin="anonymous" is required for Web Audio API to work with cross-origin Cloudinary URLs */}
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsMobileSidebarOpen(false);
        }}
        playlists={playlists}
        onSelectPlaylist={(pl) => {
          setActivePlaylist(pl);
          setActiveTab('playlist-view');
        }}
        onCreatePlaylist={(newPl) => {
          setPlaylists(prev => [...prev, newPl]);
        }}
        onDeletePlaylist={(playlistId) => {
          setPlaylists(prev => prev.filter(p => p.id !== playlistId));
          if (activePlaylist?.id === playlistId) {
            setActivePlaylist(null);
            setActiveTab('listen-now');
          }
        }}
        activePlaylistId={activePlaylist?.id}
        onLogout={handleLogout}
        isAdmin={isAdmin}
        isMobileOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Mobile Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Panel views */}
      <main className="main-content">
        {/* Render Tab views */}
        {activeTab === 'listen-now' && (
          <Dashboard 
            songs={songs} 
            playlists={playlists}
            history={history}
            onPlaySong={handlePlaySong} 
            setActiveTab={setActiveTab}
            onLogout={handleLogout}
            currentUser={localStorage.getItem('cloud_lib_user') || 'User'}
          />
        )}

        {activeTab === 'songs' && (
          <div>
            <div className="sticky-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '20px' }}>
              <h1 style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: '800', letterSpacing: '-0.5px', margin: 0 }}>
                All Songs
              </h1>
              <div className="search-bar-container" style={{ width: '100%', maxWidth: '400px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ pointerEvents: 'none' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="Search titles, albums, artists..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filteredSongs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-icon">🔎</span>
                <h3>No Tracks Found</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {songs.length === 0 ? 'Your library is empty. Upload some songs!' : 'Try refining your search keyword.'}
                </p>
                {songs.length === 0 && (
                  <button className="empty-state-btn" onClick={() => setActiveTab('upload')}>
                    Upload Song
                  </button>
                )}
              </div>
            ) : (
              <div className="songs-list-container">
                <div className="song-row" style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', cursor: 'default' }}>
                  <div>Art</div>
                  <div>Title</div>
                  <div className="row-album">Album</div>
                  <div className="row-duration" style={{ textAlign: 'right' }}>Time</div>
                  <div style={{ textAlign: 'center' }}>♥</div>
                  <div style={{ textAlign: 'center' }}>•••</div>
                </div>

                {/* Song rows */}
                {filteredSongs.map(song => {
                  const favPl = playlists.find(p => p.name.toLowerCase() === 'favorites');
                  const isSongFav = favPl ? (favPl.songIds || []).includes(song.id) : false;
                  return (
                    <div
                      key={song.id}
                      className={`song-row song-row-fav ${currentSong && currentSong.id === song.id ? 'active' : ''}`}
                      onClick={() => handlePlaySong(song, songs)}
                    >
                      <img
                        src={song.coverUrl}
                        className="row-artwork"
                        alt=""
                        onError={(e) => { e.target.src = '/placeholder-album.png'; }}
                      />
                      <div className="row-title-container">
                        <span className={`row-title ${currentSong && currentSong.id === song.id ? 'playing' : ''}`}>
                          {song.title}
                        </span>
                      </div>
                      <div className="row-artist">{song.artist}</div>
                      <div className="row-album">{song.album}</div>
                      <div className="row-duration">
                        {Math.floor(song.duration / 60)}:{(Math.floor(song.duration % 60) < 10 ? '0' : '') + Math.floor(song.duration % 60)}
                      </div>

                      {/* ❤️ Favorite toggle */}
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="fav-row-btn"
                          onClick={() => handleFavorite(song)}
                          title={isSongFav ? 'Remove from Favorites' : 'Add to Favorites'}
                          aria-label="Favorite"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24"
                            fill={isSongFav ? 'var(--accent-color)' : 'none'}
                            stroke={isSongFav ? 'var(--accent-color)' : 'currentColor'}
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                      </div>

                      {/* ••• Action dropdown */}
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="action-dot-btn"
                          onClick={() => setActiveRowMenuId(activeRowMenuId === song.id ? null : song.id)}
                        >
                          •••
                        </button>

                        {activeRowMenuId === song.id && (
                          <div className="action-menu">
                            <div
                              className="action-item"
                              onClick={() => {
                                setActiveAddToPlaylistId(activeAddToPlaylistId === song.id ? null : song.id);
                              }}
                            >
                              <span>Add to Playlist...</span>
                            </div>

                            {activeAddToPlaylistId === song.id && (
                              <div style={{ background: '#121217', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                {playlists.length === 0 ? (
                                  <div style={{ fontSize: '11px', padding: '8px 12px', color: 'var(--text-tertiary)' }}>No playlists. Create one!</div>
                                ) : (
                                  playlists.map(pl => (
                                    <div
                                      key={pl.id}
                                      className="action-item"
                                      style={{ paddingLeft: '24px', fontSize: '12px' }}
                                      onClick={() => handleAddTrackToPlaylist(pl.id, song.id)}
                                    >
                                      + {pl.name}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            <div
                              className="action-item delete"
                              onClick={() => {
                                handleDeleteSong(song.id);
                                setActiveRowMenuId(null);
                              }}
                            >
                              <span style={{ color: '#ff3b30' }}>Delete Track</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'upload' && (
          <UploadModal 
            onUploadSuccess={() => {
              fetchSongs();
              setActiveTab('songs');
            }} 
            isCloudActive={settings?.cloudinaryCloudName && settings?.cloudinaryApiKey && settings?.cloudinaryApiSecret}
          />
        )}

        {/* Admin Panel Overlay */}
        {activeTab === 'admin-panel' && isAdmin && (
          <AdminPanel onClose={() => setActiveTab('listen-now')} />
        )}

        {activeTab === 'settings' && isAdmin && (
          <SettingsPanel 
            settings={settings}
            onSaveSettings={(updated) => {
              setSettings(updated);
            }}
          />
        )}

        {activeTab === 'playlist-view' && (
          <Playlists 
            playlists={playlists}
            songs={songs}
            onCreatePlaylist={(newPl) => {
              setPlaylists(prev => [...prev, newPl]);
            }}
            onAddSongToPlaylist={(updatedPl) => {
              setPlaylists(prev => prev.map(p => p.id === updatedPl.id ? updatedPl : p));
            }}
            onRemoveSongFromPlaylist={(updatedPl) => {
              setPlaylists(prev => prev.map(p => p.id === updatedPl.id ? updatedPl : p));
            }}
            onUpdatePlaylist={(updatedPl) => {
              setPlaylists(prev => prev.map(p => p.id === updatedPl.id ? updatedPl : p));
            }}
            onDeletePlaylist={(playlistId) => {
              setPlaylists(prev => prev.filter(p => p.id !== playlistId));
              setActiveTab('listen-now'); // Go back to dashboard if deleted
            }}
            onPlaySong={handlePlaySong}
            activePlaylist={activePlaylist}
            setActivePlaylist={setActivePlaylist}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}
      </main>

      {/* Floating Audio Player Toolbar */}
      {currentSong && (
        <Player 
          currentSong={currentSong}
          isPlaying={isPlaying}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
          onPrev={handlePrev}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          volume={volume}
          onVolumeChange={handleVolumeChange}
          muted={muted}
          onMuteToggle={handleMuteToggle}
          shuffle={shuffle}
          onShuffleToggle={() => setShuffle(!shuffle)}
          repeat={repeat}
          onRepeatToggle={() => setRepeat(!repeat)}
          showLyrics={showLyrics}
          setShowLyrics={setShowLyrics}
          showVisualizer={showVisualizer}
          setShowVisualizer={setShowVisualizer}
          onFavorite={() => handleFavorite(currentSong)}
          isFavorited={currentSong && playlists.find(p => p.name.toLowerCase() === 'favorites') ? (playlists.find(p => p.name.toLowerCase() === 'favorites').songIds || []).includes(currentSong.id) : false}
        />
      )}


      {/* Interactive Feature Overlays */}
      {showLyrics && currentSong && (
        <LyricsOverlay 
          currentSong={currentSong}
          onClose={() => setShowLyrics(false)}
          onUpdateSong={handleUpdateSong}
        />
      )}

      {showVisualizer && currentSong && (
        <Visualizer 
          currentSong={currentSong}
          analyser={analyserRef.current}
          isPlaying={isPlaying}
          onClose={() => setShowVisualizer(false)}
        />
      )}
      {/* ── Mobile Bottom Navigation (hidden on desktop) ── */}
      <nav className="mobile-bottom-nav">
        <button 
          className={`mobile-nav-btn ${activeTab === 'listen-now' ? 'active' : ''}`}
          onClick={() => setActiveTab('listen-now')}
          aria-label="Home"
        >
          <svg viewBox="0 0 24 24" fill={activeTab === 'listen-now' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeTab === 'listen-now' ? "0" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>Home</span>
        </button>

        <button 
          className={`mobile-nav-btn ${activeTab === 'songs' ? 'active' : ''}`}
          onClick={() => setActiveTab('songs')}
          aria-label="Songs"
        >
          <svg viewBox="0 0 24 24" fill={activeTab === 'songs' ? "currentColor" : "none"} stroke="currentColor" strokeWidth={activeTab === 'songs' ? "0" : "1.5"} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
          </svg>
          <span>Songs</span>
        </button>

        <button 
          className={`mobile-nav-btn ${activeTab === 'playlist-view' && playlists.find(p => p.name.toLowerCase() === 'favorites')?.id === activePlaylist?.id ? 'active' : ''}`}
          onClick={() => {
            const fav = playlists.find(p => p.name.toLowerCase() === 'favorites');
            if (fav) {
              setActivePlaylist(fav);
              setActiveTab('playlist-view');
            }
          }}
          aria-label="Favorites"
        >
          <svg viewBox="0 0 24 24" 
            fill={activeTab === 'playlist-view' && playlists.find(p => p.name.toLowerCase() === 'favorites')?.id === activePlaylist?.id ? 'currentColor' : 'none'} 
            stroke="currentColor" 
            strokeWidth={activeTab === 'playlist-view' && playlists.find(p => p.name.toLowerCase() === 'favorites')?.id === activePlaylist?.id ? '0' : '1.5'} 
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
          </svg>
          <span>Favorites</span>
        </button>
      </nav>

      {/* Onboarding Guide Overlay */}
      {isAuthenticated && showOnboarding && (
        <OnboardingGuide onComplete={() => {
          localStorage.setItem('has_seen_onboarding', 'true');
          setShowOnboarding(false);
        }} />
      )}
    </div>
  );
}
