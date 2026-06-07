import React, { useState, useEffect } from 'react';

export default function SettingsPanel({ onSaveSettings, settings }) {
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState({ status: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setCloudName(settings.cloudinaryCloudName || '');
      setApiKey(settings.cloudinaryApiKey || '');
      setApiSecret(settings.cloudinaryApiSecret || '');
      setGmailUser(settings.gmailUser || '');
      setGmailAppPassword(settings.gmailAppPassword || '');
    }
  }, [settings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({
          cloudinaryCloudName: cloudName,
          cloudinaryApiKey: apiKey,
          cloudinaryApiSecret: apiSecret,
          gmailUser,
          gmailAppPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccess(true);
        if (onSaveSettings) onSaveSettings(data.settings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!cloudName || !apiKey || !apiSecret) {
      setTestResult({ status: 'error', message: 'Please enter all credentials to test.' });
      return;
    }

    setTesting(true);
    setTestResult({ status: '', message: '' });

    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({
          cloudinaryCloudName: cloudName,
          cloudinaryApiKey: apiKey,
          cloudinaryApiSecret: apiSecret
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ status: 'success', message: 'Connection successful! Cloudinary is fully linked.' });
      } else {
        setTestResult({ status: 'error', message: data.error || 'Connection failed. Please check keys.' });
      }
    } catch (err) {
      setTestResult({ status: 'error', message: 'API connection failed. Ensure backend is running.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings-container">
      <h2 className="settings-title">Cloud Integration</h2>
      <p className="settings-desc">
        Link your free Cloudinary account to store your music files securely in the cloud and stream them from anywhere.
        If not configured, the app will save your songs in a local directory instead.
      </p>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-group">
          <label className="form-label">Cloudinary Cloud Name</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g. dxyz85721" 
            value={cloudName} 
            onChange={(e) => setCloudName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Cloudinary API Key</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g. 581729481948291" 
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Cloudinary API Secret</label>
          <input 
            type="password" 
            className="form-input" 
            placeholder="••••••••••••••••••••••••••••••••" 
            value={apiSecret} 
            onChange={(e) => setApiSecret(e.target.value)}
          />
        </div>

        <h2 className="settings-title" style={{ marginTop: '20px', fontSize: '20px' }}>Email Verification (SMTP)</h2>
        <p className="settings-desc" style={{ marginBottom: '10px' }}>
          Configure Gmail to send real 6-digit verification codes to new users. Leave blank to mock emails in the terminal.
        </p>

        <div className="form-group">
          <label className="form-label">Gmail Address</label>
          <input 
            type="email" 
            className="form-input" 
            placeholder="e.g. your.name@gmail.com" 
            value={gmailUser} 
            onChange={(e) => setGmailUser(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Gmail App Password (16 characters)</label>
          <input 
            type="password" 
            className="form-input" 
            placeholder="••••••••••••••••" 
            value={gmailAppPassword} 
            onChange={(e) => setGmailAppPassword(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
          <button 
            type="submit" 
            className="sync-button" 
            style={{ flex: '1 1 200px', margin: 0 }}
            disabled={saving}
          >
            {saving ? <div className="spinner"></div> : 'Save Configuration'}
          </button>
          
          <button 
            type="button" 
            className="test-btn" 
            style={{ flex: '1 1 150px' }}
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Cloud Connection'}
          </button>
        </div>

        {saveSuccess && (
          <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Credentials saved successfully!</span>
          </div>
        )}

        {testResult.message && (
          <div style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            background: testResult.status === 'success' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)', 
            color: testResult.status === 'success' ? '#2ecc71' : '#e74c3c', 
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {testResult.status === 'success' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </form>

      <div style={{ marginTop: '32px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#fff' }}>How to set up your Cloudinary account:</h4>
        <ol style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
          <li>Go to <a href="https://cloudinary.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>cloudinary.com</a> and sign up for a <strong>Free Account</strong>.</li>
          <li>Log in to access your <strong>Dashboard</strong>.</li>
          <li>Locate your <strong>Cloud Name</strong>, <strong>API Key</strong>, and <strong>API Secret</strong> on the home tab.</li>
          <li>Copy and paste them above, save, and enjoy infinite cloud streaming!</li>
        </ol>
      </div>
    </div>
  );
}
