import React, { useState, useEffect } from 'react';

export default function SettingsPanel({ onSaveSettings, settings }) {
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState({ status: '', message: '' });
  const [testingEmail, setTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState({ status: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setCloudName(settings.cloudinaryCloudName || '');
      setApiKey(settings.cloudinaryApiKey || '');
      setApiSecret(settings.cloudinaryApiSecret || '');
      setGmailUser(settings.gmailUser || '');
      setGmailAppPassword(settings.gmailAppPassword || '');
      setResendApiKey(settings.resendApiKey || '');
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
          gmailAppPassword,
          resendApiKey
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

  const handleTestEmail = async () => {
    if (!resendApiKey && (!gmailUser || !gmailAppPassword)) {
      setEmailTestResult({ status: 'error', message: 'Please enter a Resend API Key or Gmail credentials to test.' });
      return;
    }

    setTestingEmail(true);
    setEmailTestResult({ status: '', message: '' });

    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('cloud_lib_session')}`
        },
        body: JSON.stringify({
          gmailUser,
          gmailAppPassword,
          resendApiKey
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailTestResult({ status: 'success', message: data.message || 'Test email sent successfully! Check your inbox.' });
      } else {
        setEmailTestResult({ status: 'error', message: data.error || 'Email test failed.' });
      }
    } catch (err) {
      setEmailTestResult({ status: 'error', message: 'Failed to reach backend email service.' });
    } finally {
      setTestingEmail(false);
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

        <h2 className="settings-title" style={{ marginTop: '20px', fontSize: '20px' }}>Email Verification Setup</h2>
        <p className="settings-desc" style={{ marginBottom: '10px' }}>
          Configure email delivery to send 6-digit verification codes to new users.
        </p>

        <div className="form-group" style={{ background: 'rgba(250, 45, 72, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(250, 45, 72, 0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label className="form-label" style={{ margin: 0, color: '#ff375f', fontWeight: '700' }}>
              Resend API Key (Recommended for Render / Cloud)
            </label>
            <a href="https://resend.com" target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#ff375f', textDecoration: 'underline' }}>
              Get Free Key at resend.com →
            </a>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
            Works 100% on Render Free Tier via HTTPS (Port 443). Zero port blocks, 3,000 free emails/month.
          </p>
          <input 
            type="password" 
            className="form-input" 
            placeholder="re_123456789abcdef..." 
            value={resendApiKey} 
            onChange={(e) => setResendApiKey(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Gmail Address (Optional Alternative)</label>
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
            style={{ flex: '1 1 180px', margin: 0 }}
            disabled={saving}
          >
            {saving ? <div className="spinner"></div> : 'Save Configuration'}
          </button>
          
          <button 
            type="button" 
            className="test-btn" 
            style={{ flex: '1 1 140px' }}
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Cloudinary'}
          </button>

          <button 
            type="button" 
            className="test-btn" 
            style={{ flex: '1 1 140px', background: 'rgba(250, 45, 72, 0.1)', borderColor: 'rgba(250, 45, 72, 0.3)', color: '#fa2d48' }}
            onClick={handleTestEmail}
            disabled={testingEmail}
          >
            {testingEmail ? 'Sending Test...' : 'Test Email Delivery'}
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

        {emailTestResult.message && (
          <div style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            background: emailTestResult.status === 'success' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)', 
            color: emailTestResult.status === 'success' ? '#2ecc71' : '#e74c3c', 
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {emailTestResult.status === 'success' ? (
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
            <span>{emailTestResult.message}</span>
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

      <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#fff' }}>How to set up Gmail App Password:</h4>
        <ol style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
          <li>Go to your Google Account and ensure <strong>2-Step Verification</strong> is turned on.</li>
          <li>Search for <strong>App Passwords</strong> in your Google Account search bar.</li>
          <li>Create a new app password (select "Other (Custom name)" and type "MyHIF App").</li>
          <li>Google will generate a 16-character password (e.g. <code style={{background: '#000', padding: '2px 4px', borderRadius: '4px'}}>abcd efgh ijkl mnop</code>).</li>
          <li>Paste the 16 characters (without spaces) into the "Gmail App Password" field above and save!</li>
        </ol>
      </div>
    </div>
  );
}
