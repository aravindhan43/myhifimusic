import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Sidebar({
  activeTab,
  setActiveTab,
  playlists = [],
  onSelectPlaylist,
  activePlaylistId,
  onLogout,
  isAdmin,
  isMobileOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  onCreatePlaylist,
  onDeletePlaylist
}) {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

  const handleDeleteSidebarPlaylist = (e, pl) => {
    e.stopPropagation();
    setPlaylistToDelete(pl);
    setShowDeleteDialog(true);
  };

  const confirmDeletePlaylist = async () => {
    if (!playlistToDelete) return;

    try {
      const res = await fetch(`/api/playlists/${playlistToDelete.id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        }
      });
      if (res.ok) {
        if (onDeletePlaylist) onDeletePlaylist(playlistToDelete.id);
        setShowDeleteDialog(false);
        setPlaylistToDelete(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to delete playlist. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error occurred while trying to delete.');
    }
  };

  // Track screen size for conditional rendering
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // On mobile: close sidebar after selecting an item
  const handleNav = (tab) => {
    setActiveTab(tab);
    if (isMobile) onClose?.();
  };

  const handlePlaylistClick = (playlist) => {
    onSelectPlaylist(playlist);
    setActiveTab('playlist-view');
    if (isMobile) onClose?.();
  };

  const handleCreatePlaylistClick = () => {
    setNewPlaylistName('');
    setShowCreateDialog(true);
  };

  const submitCreatePlaylist = async () => {
    if (!newPlaylistName || !newPlaylistName.trim()) return;
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({ name: newPlaylistName.trim() })
      });
      if (res.ok) {
        const newPl = await res.json();
        if (onCreatePlaylist) onCreatePlaylist(newPl);
        onSelectPlaylist(newPl);
        setActiveTab('playlist-view');
        setShowCreateDialog(false);
        setNewPlaylistName('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const collapsed = !isMobile && isCollapsed;

  return (
    <div className={`sidebar ${isMobileOpen ? 'mobile-open' : ''} ${collapsed ? 'collapsed' : ''}`}>

      {/* ── Desktop collapse toggle (chevron on right edge) ── */}
      {!isMobile && (
        <button
          className="sidebar-collapse-btn"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            width="16" height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      {/* ── Mobile close button (top-right X) ── */}
      {isMobile && (
        <button className="sidebar-mobile-close" onClick={onClose} aria-label="Close sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* ── Logo ── */}
      <div className="logo-section">
        <div className="logo-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" fill="currentColor" />
            <circle cx="18" cy="16" r="3" fill="currentColor" />
          </svg>
        </div>
        <span className="logo-text">My Music</span>
      </div>

      {/* ── Navigation ── */}
      <div className="sidebar-menu">
        <div className="menu-group">
          <span className="group-title">Discover</span>

          <button
            className={`menu-item ${activeTab === 'listen-now' ? 'active' : ''}`}
            onClick={() => handleNav('listen-now')}
            title="MyHifi"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
            <span>MyHifi</span>
          </button>

          <button
            className={`menu-item ${activeTab === 'songs' ? 'active' : ''}`}
            onClick={() => handleNav('songs')}
            title="All Songs"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            <span>All Songs</span>
          </button>

          {isAdmin && (
            <button
              className={`menu-item ${activeTab === 'admin-panel' ? 'active' : ''}`}
              onClick={() => handleNav('admin-panel')}
              title="Admin Panel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Admin Panel</span>
            </button>
          )}
        </div>

        <div className="menu-group">
          <span className="group-title">Library</span>
          
          <button
            className={`menu-item ${activeTab === 'playlist-view' && activePlaylistId === playlists.find(p => p.name.toLowerCase() === 'favorites')?.id ? 'active' : ''}`}
            onClick={() => {
              const fav = playlists.find(p => p.name.toLowerCase() === 'favorites');
              if (fav) {
                onSelectPlaylist(fav);
                setActiveTab('playlist-view');
                if (window.innerWidth <= 768) onClose?.();
              }
            }}
            title="Favorites"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
            <span>Favorites</span>
          </button>
        </div>

        <div className="menu-group">
          <span className="group-title">Cloud Actions</span>

          <button
            className={`menu-item ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => handleNav('upload')}
            title="Add Songs"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Add Songs</span>
          </button>

          {isAdmin && (
            <button
              className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => handleNav('settings')}
              title="Cloud Config"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Cloud Config</span>
            </button>
          )}
        </div>

        <div className="menu-group">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px' }}>
            <span className="group-title" style={{ margin: 0, padding: '16px 20px 8px' }}>Playlists</span>
            <button 
              onClick={handleCreatePlaylistClick}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '16px 4px 8px', display: 'flex', alignItems: 'center' }}
              title="Create Playlist"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          <div className="sidebar-playlists">
            {playlists.length === 0 ? (
              <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', paddingLeft: '12px' }}>
                No playlists
              </span>
            ) : (
              playlists.map(pl => (
                <div
                  key={pl.id}
                  className={`playlist-link ${activeTab === 'playlist-view' && activePlaylistId === pl.id ? 'active' : ''}`}
                  onClick={() => handlePlaylistClick(pl)}
                  title={pl.name}
                  style={{
                    color: activeTab === 'playlist-view' && activePlaylistId === pl.id ? 'var(--accent-color)' : '',
                    fontWeight: activeTab === 'playlist-view' && activePlaylistId === pl.id ? '600' : 'normal',
                  }}
                >
                  {/* Mini music note icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span className="playlist-link-name" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pl.name}</span>
                  <button 
                    className="sidebar-delete-btn"
                    onClick={(e) => handleDeleteSidebarPlaylist(e, pl)}
                    title="Delete Playlist"
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-tertiary)', 
                      cursor: 'pointer', 
                      padding: '2px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      opacity: 0.5 
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff6b6b'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="sidebar-footer">
        {onLogout && (
          <button
            className="menu-item sidebar-signout"
            onClick={onLogout}
            title="Sign Out"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            <span>Sign Out</span>
          </button>
        )}

        <div className="sidebar-version">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>MyHifi 1.0</span>
        </div>
      </div>

      {/* Custom Create Playlist Modal */}
      {showCreateDialog && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '24px',
            width: '350px',
            maxWidth: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'Outfit', fontSize: '20px' }}>Create Playlist</h3>
            <input 
              type="text"
              autoFocus
              value={newPlaylistName}
              placeholder="Playlist name..."
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitCreatePlaylist();
                if (e.key === 'Escape') setShowCreateDialog(false);
              }}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#fff',
                fontSize: '15px',
                outline: 'none',
                marginBottom: '24px',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-color)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="test-btn" 
                onClick={() => setShowCreateDialog(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button 
                className="sync-button" 
                onClick={submitCreatePlaylist}
                style={{ flex: 1 }}
              >
                Create
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Playlist Confirmation Modal */}
      {showDeleteDialog && playlistToDelete && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '16px',
            padding: '20px',
            width: '350px',
            maxWidth: '90%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 8px', fontFamily: 'Outfit', fontSize: '18px' }}>Delete Playlist?</h3>
            <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Are you sure you want to delete "{playlistToDelete.name}"? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                className="test-btn" 
                onClick={() => {
                  setShowDeleteDialog(false);
                  setPlaylistToDelete(null);
                }}
                style={{ flex: 1, margin: 0, height: '42px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}
              >
                Cancel
              </button>
              <button 
                className="sync-button" 
                onClick={confirmDeletePlaylist}
                style={{ flex: 1, background: '#ff4d4d', color: '#fff', margin: 0, height: '42px', padding: '0', fontSize: '14px' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
