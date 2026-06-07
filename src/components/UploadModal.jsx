import React, { useState, useEffect, useRef } from 'react';

export default function UploadModal({ onUploadSuccess, isCloudActive }) {
  const [dragActive, setDragActive] = useState(false);
  const [queue, setQueue] = useState([]); // List of tracks: { id, file, name, status, error, parsed }
  const [selectedQueueId, setSelectedQueueId] = useState(null); // Currently selected for editing
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [parsingActive, setParsingActive] = useState(false);

  // Edit fields for selected song
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editAlbum, setEditAlbum] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editTempCoverPath, setEditTempCoverPath] = useState('');

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const editCoverInputRef = useRef(null);

  // Recursive Directory Scanner for Dropped Items
  const scanDroppedItems = async (items) => {
    const filesList = [];

    // Helper to recursively traverse a directory entry
    const traverseEntry = (entry) => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          entry.file((file) => {
            if (isAudioFile(file)) {
              filesList.push(file);
            }
            resolve();
          });
        } else if (entry.isDirectory) {
          const dirReader = entry.createReader();
          dirReader.readEntries(async (entries) => {
            const promises = [];
            for (let i = 0; i < entries.length; i++) {
              promises.push(traverseEntry(entries[i]));
            }
            await Promise.all(promises);
            resolve();
          });
        } else {
          resolve();
        }
      });
    };

    const entryPromises = [];
    for (let i = 0; i < items.length; i++) {
      if (typeof items[i].webkitGetAsEntry === 'function') {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          entryPromises.push(traverseEntry(entry));
        }
      } else if (items[i].getAsFile) {
        const file = items[i].getAsFile();
        if (file && isAudioFile(file)) {
          filesList.push(file);
        }
      }
    }

    if (entryPromises.length > 0) {
      await Promise.all(entryPromises);
    }
    
    addFilesToQueue(filesList);
  };

  const isAudioFile = (file) => {
    return file.type.startsWith('audio/') || 
           file.name.endsWith('.mp3') || 
           file.name.endsWith('.m4a') || 
           file.name.endsWith('.wav') ||
           file.name.endsWith('.flac');
  };

  const addFilesToQueue = (files) => {
    const newItems = files.map(file => ({
      id: `queue_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      file,
      name: file.name,
      status: 'pending', // 'pending' | 'parsing' | 'ready' | 'uploading' | 'success' | 'error'
      error: '',
      parsed: null
    }));

    setQueue(prev => [...prev, ...newItems]);
  };

  // Start parsing automatically when pending items exist
  useEffect(() => {
    const pendingItem = queue.find(item => item.status === 'pending');
    if (pendingItem && !parsingActive) {
      parseQueueItem(pendingItem.id);
    }
  }, [queue, parsingActive]);

  // ID3 Parser worker
  const parseQueueItem = async (itemId) => {
    setParsingActive(true);
    updateItemStatus(itemId, 'parsing');

    const item = queue.find(i => i.id === itemId);
    if (!item) {
      setParsingActive(false);
      return;
    }

    const formData = new FormData();
    formData.append('audio', item.file);

    try {
      const res = await fetch('/api/upload-preview', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: formData
      });

      if (!res.ok) throw new Error('ID3 scan failed');

      const parsedData = await res.json();
      
      setQueue(prev => prev.map(q => {
        if (q.id === itemId) {
          return {
            ...q,
            status: 'ready',
            parsed: parsedData
          };
        }
        return q;
      }));
    } catch (err) {
      console.error(err);
      setQueue(prev => prev.map(q => {
        if (q.id === itemId) {
          return {
            ...q,
            status: 'error',
            error: err.message || 'Metadata extraction failed'
          };
        }
        return q;
      }));
    } finally {
      setParsingActive(false);
    }
  };

  const updateItemStatus = (id, status, error = '') => {
    setQueue(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, status, error };
      }
      return item;
    }));
  };

  // Trigger quick edit when row is selected
  useEffect(() => {
    if (selectedQueueId) {
      const item = queue.find(i => i.id === selectedQueueId);
      if (item && item.parsed) {
        setEditTitle(item.parsed.title || '');
        setEditArtist(item.parsed.artist || '');
        setEditAlbum(item.parsed.album || '');
        setEditGenre(item.parsed.genre || '');
        setEditCoverUrl(item.parsed.coverUrl || '');
        setEditTempCoverPath(item.parsed.tempCoverPath || '');
      }
    } else {
      setEditTitle('');
      setEditArtist('');
      setEditAlbum('');
      setEditGenre('');
      setEditCoverUrl('');
      setEditTempCoverPath('');
    }
  }, [selectedQueueId, queue]);

  // Apply edits back to the queue item
  const handleApplyEdits = (e) => {
    e.preventDefault();
    if (!selectedQueueId) return;

    setQueue(prev => prev.map(item => {
      if (item.id === selectedQueueId) {
        return {
          ...item,
          parsed: {
            ...item.parsed,
            title: editTitle,
            artist: editArtist,
            album: editAlbum,
            genre: editGenre,
            coverUrl: editCoverUrl,
            tempCoverPath: editTempCoverPath
          }
        };
      }
      return item;
    }));

    setSelectedQueueId(null); // Close edit panel
  };

  // Custom cover upload for edit panel
  const handleEditCoverUpload = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('cover', file);

      try {
        const res = await fetch('/api/upload-cover', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
          },
          body: formData
        });
        const data = await res.json();
        setEditTempCoverPath(data.tempCoverPath);
        setEditCoverUrl(data.coverUrl);
      } catch (err) {
        console.error('Cover upload error:', err);
      }
    }
  };

  // Sync all ready songs to cloud sequentially
  const handleSyncAll = async () => {
    const readyItems = queue.filter(item => item.status === 'ready');
    if (readyItems.length === 0) return;

    setIsSyncingAll(true);

    for (let i = 0; i < readyItems.length; i++) {
      const item = readyItems[i];
      updateItemStatus(item.id, 'uploading');

      try {
        const res = await fetch('/api/songs/confirm', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
          },
          body: JSON.stringify({
            title: item.parsed.title,
            artist: item.parsed.artist,
            album: item.parsed.album,
            genre: item.parsed.genre,
            duration: item.parsed.duration,
            tempAudioPath: item.parsed.tempAudioPath,
            tempCoverPath: item.parsed.tempCoverPath,
            customCoverUrl: item.parsed.coverUrl
          })
        });

        if (!res.ok) throw new Error('Cloud sync failed');

        updateItemStatus(item.id, 'success');
      } catch (err) {
        console.error(err);
        updateItemStatus(item.id, 'error', err.message || 'Upload sync failed');
      }
    }

    setIsSyncingAll(false);
    
    // Notify parent to fetch new music list
    if (onUploadSuccess) {
      // Small timeout to let visual state settle
      setTimeout(() => {
        onUploadSuccess();
      }, 1000);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.items) {
      await scanDroppedItems(e.dataTransfer.items);
    } else if (e.dataTransfer.files) {
      addFilesToQueue(Array.from(e.dataTransfer.files).filter(isAudioFile));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files) {
      addFilesToQueue(Array.from(e.target.files).filter(isAudioFile));
    }
  };

  const handleFolderChange = (e) => {
    if (e.target.files) {
      addFilesToQueue(Array.from(e.target.files).filter(isAudioFile));
    }
  };

  const handleRemoveFromQueue = (id) => {
    setQueue(prev => prev.filter(item => item.id !== id));
    if (selectedQueueId === id) setSelectedQueueId(null);
  };

  const handleClearQueue = () => {
    setQueue([]);
    setSelectedQueueId(null);
  };

  // Stats computed
  const pendingCount = queue.filter(i => i.status === 'pending' || i.status === 'parsing').length;
  const readyCount = queue.filter(i => i.status === 'ready').length;
  const successCount = queue.filter(i => i.status === 'success').length;
  const errorCount = queue.filter(i => i.status === 'error').length;

  return (
    <div>
      <div className="sticky-header" style={{ position: 'relative', top: 0, margin: 0, paddingBottom: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontFamily: 'Outfit', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            Cloud Folder Upload
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Drag and drop an entire folder of music. The uploader recursively scans directories, decodes tags in parallel, and batch syncs them to Cloudinary.
          </p>
        </div>

        {queue.length > 0 && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="test-btn" style={{ fontSize: '12px', borderRadius: '20px' }} onClick={handleClearQueue} disabled={isSyncingAll}>
              Clear Queue
            </button>
            <button 
              className="sync-button" 
              style={{ padding: '8px 20px', fontSize: '12px', borderRadius: '20px', margin: 0 }}
              onClick={handleSyncAll}
              disabled={readyCount === 0 || isSyncingAll}
            >
              {isSyncingAll ? (
                <>
                  <div className="spinner" style={{ width: '12px', height: '12px' }}></div>
                  <span>Syncing... ({successCount}/{readyCount + successCount})</span>
                </>
              ) : (
                `Sync ${readyCount} tracks`
              )}
            </button>
          </div>
        )}
      </div>

      <div className="upload-view-container" style={{ marginTop: '20px' }}>
        {/* Left Column: Dropzone & Queue List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Uploader Dropzone */}
          <div 
            className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            style={{ height: '180px', padding: '24px' }}
          >
            <input 
              type="file" 
              className="hidden-file-input" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              accept="audio/*"
              multiple
            />
            <input 
              type="file" 
              className="hidden-file-input" 
              ref={folderInputRef} 
              onChange={handleFolderChange}
              webkitdirectory=""
              directory=""
            />

            <div className="upload-icon" style={{ fontSize: '32px', marginBottom: '8px' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="dropzone-title" style={{ fontSize: '14px' }}>Drag Files or Folder Here</div>
            <div className="dropzone-desc" style={{ fontSize: '11px' }}>Traversal reads subfolders dynamically.</div>
            
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }} onClick={(e) => e.stopPropagation()}>
              <button 
                className="test-btn" 
                style={{ padding: '4px 12px', fontSize: '11px', borderRadius: '12px' }}
                onClick={() => fileInputRef.current.click()}
              >
                Select Files
              </button>
              <button 
                className="test-btn" 
                style={{ padding: '4px 12px', fontSize: '11px', borderRadius: '12px' }}
                onClick={() => folderInputRef.current.click()}
              >
                Select Folder
              </button>
            </div>
          </div>

          {/* Queue List Table */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px', maxHeight: '350px', overflowY: 'auto' }}>
            <div className="form-label" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Upload Queue ({queue.length} items)</span>
              {pendingCount > 0 && <span style={{ textTransform: 'none', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1px' }}></span> ID3 Scanning...
              </span>}
            </div>

            {queue.length === 0 ? (
              <div style={{ padding: '40px', color: 'var(--text-tertiary)', textAlign: 'center', fontSize: '13px' }}>
                Queue is empty. Select files/folders or drag them above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {queue.map((item, idx) => {
                  const cover = item.parsed && item.parsed.coverUrl ? item.parsed.coverUrl : '/placeholder-album.png';
                  const title = item.parsed ? item.parsed.title : item.name;
                  const artist = item.parsed ? item.parsed.artist : 'Pending tag scan...';
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`song-row ${selectedQueueId === item.id ? 'active' : ''}`}
                      style={{ 
                        gridTemplateColumns: '32px 1fr 1fr 90px 32px', 
                        padding: '6px 12px', 
                        background: selectedQueueId === item.id ? 'rgba(255, 45, 85, 0.08)' : 'rgba(255,255,255,0.01)',
                        borderRadius: '6px'
                      }}
                      onClick={() => item.parsed && setSelectedQueueId(item.id)}
                    >
                      {/* 1. Mini Art */}
                      <img 
                        src={cover} 
                        style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', background: 'var(--bg-tertiary)' }}
                        onError={(e) => { e.target.src = '/placeholder-album.png'; }}
                        alt=""
                      />
                      
                      {/* 2. Track Title */}
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '13px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: item.status === 'error' ? '#ff3b30' : '#fff' }}>
                          {title}
                        </span>
                      </div>
                      
                      {/* 3. Artist */}
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {artist}
                      </span>
                      
                      {/* 4. Status Badge */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        {item.status === 'pending' && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>Waiting</span>}
                        {item.status === 'parsing' && <span style={{ fontSize: '10px', color: 'var(--accent-color)' }}>Scanning</span>}
                        {item.status === 'ready' && <span style={{ fontSize: '10px', color: '#2ecc71', background: 'rgba(46,204,113,0.12)', padding: '2px 6px', borderRadius: '10px' }}>Ready</span>}
                        {item.status === 'uploading' && <span style={{ fontSize: '10px', color: '#3498db', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="spinner" style={{ width: '8px', height: '8px', borderWidth: '1px' }}></span> Syncing
                        </span>}
                        {item.status === 'success' && <span style={{ fontSize: '10px', color: '#fff', background: '#2ecc71', padding: '2px 6px', borderRadius: '10px' }}>Synced</span>}
                        {item.status === 'error' && <span style={{ fontSize: '10px', color: '#e74c3c' }} title={item.error}>Failed</span>}
                      </div>

                      {/* 5. Delete queue item */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromQueue(item.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        disabled={isSyncingAll}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Metadata Quick Editor Drawer */}
        <div className="sync-panel" style={{ opacity: selectedQueueId ? 1 : 0.4, pointerEvents: selectedQueueId ? 'auto' : 'none', minHeight: '380px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="sync-header">Track Metadata Editor</div>
            {selectedQueueId && (
              <button 
                onClick={() => setSelectedQueueId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {selectedQueueId ? (
            <form onSubmit={handleApplyEdits} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="metadata-preview-card">
                <div className="preview-artwork-container" onClick={() => editCoverInputRef.current.click()}>
                  <img 
                    src={editCoverUrl || '/placeholder-album.png'} 
                    alt="Cover preview" 
                    className="preview-artwork"
                    onError={(e) => { e.target.src = '/placeholder-album.png'; }}
                  />
                  <div className="preview-artwork-overlay">Edit Cover</div>
                  <input 
                    type="file" 
                    className="hidden-file-input" 
                    ref={editCoverInputRef} 
                    onChange={handleEditCoverUpload}
                    accept="image/*"
                  />
                </div>
                <div className="preview-details">
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-color)', textTransform: 'uppercase' }}>EDITING METADATA</div>
                  <div className="preview-title" style={{ fontSize: '14px', marginTop: '2px' }}>{editTitle || 'Untitled'}</div>
                  <div className="preview-artist" style={{ fontSize: '12px' }}>{editArtist || 'Unknown Artist'}</div>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Song Title</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editTitle} 
                    onChange={(e) => setEditTitle(e.target.value)} 
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Artist Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editArtist} 
                    onChange={(e) => setEditArtist(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Album Title</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editAlbum} 
                    onChange={(e) => setEditAlbum(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Genre</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={editGenre} 
                    onChange={(e) => setEditGenre(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="sync-button" 
                style={{ width: '100%', margin: '10px 0 0' }}
              >
                Apply Details
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '260px', color: 'var(--text-tertiary)', fontSize: '13px', textAlign: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px' }}>
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              <span>Click on any track in the queue to quickly edit its Title, Artist, Album, Genre, or Artwork before cloud syncing.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
