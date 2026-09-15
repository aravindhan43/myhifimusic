import React, { useState, useEffect } from 'react';

export default function SettingsPanel({ onSaveSettings, settings }) {
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [brevoApiKey, setBrevoApiKey] = useState('');
  const [brevoSenderEmail, setBrevoSenderEmail] = useState('');
  const [resendApiKey, setResendApiKey] = useState('');
  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [showAdvancedEmail, setShowAdvancedEmail] = useState(false);

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
      setBrevoApiKey(settings.brevoApiKey || '');
      setBrevoSenderEmail(settings.brevoSenderEmail || '');
      setResendApiKey(settings.resendApiKey || '');
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
          brevoApiKey,
          brevoSenderEmail,
          resendApiKey,
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
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!cloudName || !apiKey || !apiSecret) {
      setTestResult({ status: 'error', message: 'Please enter all Cloudinary credentials to test.' });
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
    if (!brevoApiKey && !resendApiKey && (!gmailUser || !gmailAppPassword)) {
      setEmailTestResult({ 
        status: 'error', 
        message: 'Please enter a Brevo API Key (or Resend/Gmail credentials) to test email delivery.' 
      });
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
          brevoApiKey,
          brevoSenderEmail,
          resendApiKey,
          gmailUser,
          gmailAppPassword,
          recipientEmail: brevoSenderEmail || gmailUser || undefined
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEmailTestResult({ 
          status: 'success', 
          message: data.message || 'Test email sent successfully! Check your inbox (or spam folder).' 
        });
      } else {
        setEmailTestResult({ 
          status: 'error', 
          message: data.error || 'Email test failed. Please verify your Brevo API key and sender email.' 
        });
      }
    } catch (err) {
      setEmailTestResult({ status: 'error', message: 'Failed to reach backend email service.' });
    } finally {
      setTestingEmail(false);
    }
  };

  return (
    <div className="settings-container">
      <h2 className="settings-title">Cloud Storage Integration</h2>
      <p className="settings-desc">
        Link your free Cloudinary account to store music files securely in the cloud and stream hi-res audio from anywhere.
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

        {/* EMAIL VERIFICATION SECTION */}
        <div style={{ marginTop: '16px' }}>
          <h2 className="settings-title" style={{ fontSize: '20px', marginBottom: '6px' }}>
            Email Verification Setup (OTP)
          </h2>
          <p className="settings-desc" style={{ marginBottom: '14px' }}>
            Configure Brevo API to send 6-digit email OTP verification codes to new users upon registration.
          </p>
        </div>

        {/* BREVO API (PRIMARY & RECOMMENDED) */}
        <div style={{ 
          background: 'rgba(250, 45, 72, 0.05)', 
          padding: '18px', 
          borderRadius: '12px', 
          border: '1px solid rgba(250, 45, 72, 0.2)' 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
            <label className="form-label" style={{ margin: 0, color: '#fa2d48', fontWeight: '700', fontSize: '14px' }}>
              Brevo Mail API (Recommended for Render / Cloud)
            </label>
            <a 
              href="https://app.brevo.com/settings/keys/api" 
              target="_blank" 
              rel="noreferrer" 
              style={{ fontSize: '12px', color: '#fa2d48', textDecoration: 'underline', fontWeight: '600' }}
            >
              Get Free Key at Brevo (300 emails/day free) →
            </a>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
            Uses HTTPS REST API (Port 443). 100% reliable on Render Free Tier with zero blocked ports.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>Brevo API Key</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" 
                value={brevoApiKey} 
                onChange={(e) => setBrevoApiKey(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" style={{ fontSize: '12px', marginBottom: '4px' }}>Brevo Sender Email (Verified Email on Brevo)</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="e.g. yourname@gmail.com" 
                value={brevoSenderEmail} 
                onChange={(e) => setBrevoSenderEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ALTERNATIVE PROVIDERS (COLLAPSIBLE) */}
        <div>
          <button 
            type="button"
            onClick={() => setShowAdvancedEmail(!showAdvancedEmail)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 0'
            }}
          >
            <span>{showAdvancedEmail ? '▼' : '▶'}</span>
            <span>Alternative Providers (Resend / Gmail SMTP)</span>
          </button>

          {showAdvancedEmail && (
            <div style={{ 
              marginTop: '12px', 
              padding: '16px', 
              borderRadius: '12px', 
              background: 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Resend API Key</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="re_xxxxxxxxxxxxxxxxxxxxxxxx" 
                  value={resendApiKey} 
                  onChange={(e) => setResendApiKey(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Gmail User (SMTP)</label>
                <input 
                  type="email" 
                  className="form-input" 
                  placeholder="your.email@gmail.com" 
                  value={gmailUser} 
                  onChange={(e) => setGmailUser(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Gmail App Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="16-character App Password" 
                  value={gmailAppPassword} 
                  onChange={(e) => setGmailAppPassword(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
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
            style={{ 
              flex: '1 1 160px', 
              background: 'rgba(250, 45, 72, 0.1)', 
              borderColor: 'rgba(250, 45, 72, 0.3)', 
              color: '#fa2d48' 
            }}
            onClick={handleTestEmail}
            disabled={testingEmail}
          >
            {testingEmail ? 'Sending Test...' : 'Test Email Delivery'}
          </button>
        </div>

        {saveSuccess && (
          <div style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            background: 'rgba(46, 204, 113, 0.15)', 
            color: '#2ecc71', 
            fontSize: '13px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px' 
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Configuration saved successfully!</span>
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

      {/* BREVO SETUP GUIDE */}
      <div style={{ marginTop: '28px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#fff' }}>How to set up your free Brevo Mail API (300 free emails/day):</h4>
        <ol style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
          <li>Go to <a href="https://www.brevo.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>brevo.com</a> and sign up for a free account.</li>
          <li>In your Brevo dashboard, go to <strong>SMTP & API</strong> &rarr; <strong>API Keys</strong> tab (or visit <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>app.brevo.com/settings/keys/api</a>).</li>
          <li>Click <strong>Generate a new API key</strong>, name it "MyHIF Music", and copy the generated key (starts with <code>xkeysib-</code>).</li>
          <li>Paste the key into the <strong>Brevo API Key</strong> input above.</li>
          <li>Enter your registered Brevo account email in the <strong>Brevo Sender Email</strong> input.</li>
          <li>Click <strong>Save Configuration</strong> and then <strong>Test Email Delivery</strong>!</li>
        </ol>
      </div>

      {/* CLOUDINARY SETUP GUIDE */}
      <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
        <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#fff' }}>How to set up your Cloudinary account:</h4>
        <ol style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
          <li>Go to <a href="https://cloudinary.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>cloudinary.com</a> and sign up for a free account.</li>
          <li>Locate your <strong>Cloud Name</strong>, <strong>API Key</strong>, and <strong>API Secret</strong> on your dashboard.</li>
          <li>Paste them into the Cloud Integration section above and click <strong>Save Configuration</strong>.</li>
        </ol>
      </div>
    </div>
  );
}
