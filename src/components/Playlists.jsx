import React, { useState } from 'react';
import { createPortal } from 'react-dom';

export default function Playlists({
  playlists = [],
  songs = [],
  onCreatePlaylist,
  onAddSongToPlaylist,
  onRemoveSongFromPlaylist,
  onPlaySong,
  activePlaylist,
  setActivePlaylist,
  activeTab,
  setActiveTab,
  onUpdatePlaylist,
  onDeletePlaylist
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [showAddTracksModal, setShowAddTracksModal] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);

  const handleDeleteClick = (e, playlistToDel) => {
    e.stopPropagation();
    setPlaylistToDelete(playlistToDel);
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
        if (activePlaylist?.id === playlistToDelete.id) {
          setActivePlaylist(null);
        }
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

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !activePlaylist) return;

    try {
      const res = await fetch(`/api/playlists/${activePlaylist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({ name: editName, description: editDesc })
      });
      if (res.ok) {
        const updatedPl = await res.json();
        if (onUpdatePlaylist) onUpdatePlaylist(updatedPl);
        setActivePlaylist(updatedPl);
        setShowEditForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!playlistName.trim()) return;

    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({ name: playlistName, description: playlistDesc })
      });
      if (res.ok) {
        const newPl = await res.json();
        if (onCreatePlaylist) onCreatePlaylist(newPl);
        setPlaylistName('');
        setPlaylistDesc('');
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTrack = async (songId) => {
    if (!activePlaylist) return;
    try {
      const res = await fetch(`/api/playlists/${activePlaylist.id}/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({ songId })
      });
      if (res.ok) {
        const updatedPl = await res.json();
        if (onRemoveSongFromPlaylist) onRemoveSongFromPlaylist(updatedPl);
        setActivePlaylist(updatedPl);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddTrack = async (songId) => {
    if (!activePlaylist) return;
    try {
      const res = await fetch(`/api/playlists/${activePlaylist.id}/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({ songId })
      });
      if (res.ok) {
        const updatedPl = await res.json();
        if (onAddSongToPlaylist) onAddSongToPlaylist(updatedPl);
        setActivePlaylist(updatedPl);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Resolve songs inside active playlist
  const playlistSongs = activePlaylist
    ? (activePlaylist.songIds || []).map(sid => songs.find(s => s.id === sid)).filter(Boolean)
    : [];

  // Exclude songs already in the playlist for "Add Songs" suggestions
  const remainingSongs = songs.filter(s => !((activePlaylist?.songIds || []).includes(s.id)));

  // Fallback image
  const handleImgError = (e) => {
    e.target.src = '/placeholder-album.png';
  };

  return (
    <div>
      {/* 1. Playlists Catalog View */}
      {!activePlaylist && (
        <div>
          <div className="sticky-header">
            <h1 style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px', margin: 0 }}>
              Playlists
            </h1>
            <button
              className="sync-button"
              style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '20px', margin: 0 }}
              onClick={() => setShowCreateForm(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px' }}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Playlist
            </button>
          </div>

          {/* Create Playlist Modal overlay */}
          {showCreateForm && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(10px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div className="sync-panel" style={{ width: '400px', pointerEvents: 'auto', opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="sync-header">Create Playlist</div>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Playlist Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Chill Vibes, Night Drive"
                      value={playlistName}
                      onChange={(e) => setPlaylistName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Give your playlist some context..."
                      value={playlistDesc}
                      onChange={(e) => setPlaylistDesc(e.target.value)}
                    />
                  </div>

                  <button type="submit" className="sync-button" style={{ width: '100%', margin: 0 }}>
                    Create Playlist
                  </button>
                </form>
              </div>
            </div>
          )}

          {playlists.length === 0 ? (
            <div className="empty-state" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
              <div className="empty-state-icon">📂</div>
              <h3>No Playlists Compiled</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Group your cloud songs into customized sets. Create your first playlist to begin.
              </p>
              <button className="empty-state-btn" onClick={() => setShowCreateForm(true)}>
                Build Playlist
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '24px' }}>
              {playlists.map(pl => {
                // Get artwork of the first song in playlist as playlist cover
                const firstSong = (pl.songIds || []).map(sid => songs.find(s => s.id === sid)).filter(Boolean)[0];
                const cover = firstSong ? firstSong.coverUrl : '/placeholder-album.png';

                return (
                  <div key={pl.id} className="music-card" onClick={() => setActivePlaylist(pl)} style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => handleDeleteClick(e, pl)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        zIndex: 10,
                        background: 'rgba(0,0,0,0.5)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)'
                      }}
                      title="Delete Playlist"
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b6b'; e.currentTarget.style.background = 'rgba(0,0,0,0.8)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                    <div className="artwork-wrapper" style={{ background: 'linear-gradient(135deg, #2c3e50 0%, #000000 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {firstSong ? (
                        <img src={cover} className="card-artwork" alt={pl.name} onError={handleImgError} />
                      ) : (
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5">
                          <path d="M9 18V5l12-2v13" />
                          <circle cx="6" cy="18" r="3" />
                          <circle cx="18" cy="16" r="3" />
                        </svg>
                      )}
                      <div className="hover-overlay">
                        <div className="play-btn-circle">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <div className="card-info">
                      <div className="card-title">{pl.name}</div>
                      <div className="card-artist">{(pl.songIds || []).length} songs</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Playlist Detailed View */}
      {activePlaylist && (
        <div>


          <div style={{ display: 'flex', gap: '32px', marginBottom: '32px', flexWrap: 'wrap' }}>


            {/* Playlist Info */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-color)', letterSpacing: '1px' }}>PLAYLIST</div>
              <h1 style={{ fontFamily: 'Outfit', fontSize: '32px', fontWeight: '800', margin: '4px 0 8px', letterSpacing: '-0.5px' }}>{activePlaylist.name}</h1>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: '1.4' }}>{activePlaylist.description || 'No description provided.'}</p>

              <div style={{ display: 'flex', gap: '16px', marginTop: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{playlistSongs.length} Songs • {playlistSongs.reduce((sum, s) => sum + Math.round(s.duration / 60), 0)} min</span>
                {playlistSongs.length > 0 && (
                  <button
                    className="sync-button"
                    style={{ padding: '6px 16px', fontSize: '12px', borderRadius: '15px', margin: 0 }}
                    onClick={() => onPlaySong(playlistSongs[0], playlistSongs)}
                  >
                    Play Set
                  </button>
                )}
                <button
                  className="test-btn"
                  style={{ padding: '6px 14px', borderRadius: '15px', fontSize: '12px' }}
                  onClick={() => setShowAddTracksModal(true)}
                >
                  Manage Tracks
                </button>
                <button
                  className="test-btn"
                  style={{ padding: '6px 14px', borderRadius: '15px', fontSize: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}
                  onClick={() => {
                    setEditName(activePlaylist.name);
                    setEditDesc(activePlaylist.description || '');
                    setShowEditForm(true);
                  }}
                >
                  Edit
                </button>
                <button
                  className="test-btn"
                  style={{ padding: '6px 14px', borderRadius: '15px', fontSize: '12px', background: 'rgba(255,50,50,0.1)', color: '#ff6b6b', border: '1px solid rgba(255,50,50,0.2)' }}
                  onClick={(e) => handleDeleteClick(e, activePlaylist)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>

          {/* Edit Playlist Modal */}
          {showEditForm && createPortal(
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
                padding: '24px',
                width: '400px',
                maxWidth: '90%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)'
              }}>
                <h3 style={{ margin: '0 0 20px', fontFamily: 'Outfit', fontSize: '20px' }}>Edit Playlist</h3>
                <form onSubmit={handleEdit}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>PLAYLIST NAME</label>
                    <input
                      type="text"
                      className="search-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. Chill Vibes"
                      required
                      style={{ width: '100%', paddingLeft: '14px', background: 'rgba(0,0,0,0.2)' }}
                      autoFocus
                    />
                  </div>
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>DESCRIPTION (OPTIONAL)</label>
                    <textarea
                      className="search-input"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Add an optional description..."
                      rows={3}
                      style={{ width: '100%', paddingLeft: '14px', paddingTop: '10px', resize: 'none', background: 'rgba(0,0,0,0.2)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button type="button" className="test-btn" onClick={() => setShowEditForm(false)}>Cancel</button>
                    <button type="submit" className="sync-button">Save Changes</button>
                  </div>
                </form>
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
                  Are you sure you want to delete "{playlistToDelete.name}"
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

          {/* Manage Tracks Modal Panel */}
          {showAddTracksModal && createPortal(
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(10px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div className="sync-panel" style={{ width: '480px', pointerEvents: 'auto', opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div className="sync-header">Manage Tracks</div>
                  <button
                    onClick={() => setShowAddTracksModal(false)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  <div className="form-label" style={{ marginBottom: '4px' }}>Add New Songs:</div>
                  {remainingSongs.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', padding: '12px', textAlign: 'center' }}>All library songs are in this playlist!</div>
                  ) : (
                    remainingSongs.map(song => (
                      <div key={song.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', overflow: 'hidden' }}>
                          <img src={song.coverUrl} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} onError={handleImgError} alt="" />
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{song.artist}</div>
                          </div>
                        </div>
                        <button
                          className="test-btn"
                          style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
                          onClick={() => handleAddTrack(song.id)}
                        >
                          Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}

          {/* Playlist Tracks Table */}
          {playlistSongs.length === 0 ? (
            <div className="empty-state" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '16px', padding: '40px' }}>
              <span className="empty-state-icon" style={{ fontSize: '32px' }}>📂</span>
              <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Playlist Empty</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Fill this set with songs from your library.
              </p>
              <button
                className="empty-state-btn"
                style={{ padding: '6px 16px', fontSize: '12px' }}
                onClick={() => setShowAddTracksModal(true)}
              >
                Add Songs
              </button>
            </div>
          ) : (
            <div className="songs-list-container">
              {/* Header row */}
              <div className="song-row" style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)', fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', cursor: 'default' }}>
                <div>Art</div>
                <div>Title</div>
                <div className="row-artist">Artist</div>
                <div className="row-album">Album</div>
                <div className="row-duration" style={{ textAlign: 'right' }}>Time</div>
                <div style={{ textAlign: 'center' }}>Remove</div>
              </div>

              {playlistSongs.map((song, idx) => (
                <div key={song.id} className="song-row" onClick={() => onPlaySong(song, playlistSongs)}>
                  <img src={song.coverUrl} className="row-artwork" alt="" onError={handleImgError} />
                  <div className="row-title-container">
                    <span className="row-title">{song.title}</span>
                  </div>
                  <div className="row-artist">{song.artist}</div>
                  <div className="row-album">{song.album}</div>
                  <div className="row-duration">
                    {Math.floor(song.duration / 60)}:{(Math.floor(song.duration % 60) < 10 ? '0' : '') + Math.floor(song.duration % 60)}
                  </div>
                  <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleRemoveTrack(song.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '6px' }}
                      title="Remove from playlist"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
