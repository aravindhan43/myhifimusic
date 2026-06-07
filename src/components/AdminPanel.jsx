import React, { useState, useEffect } from 'react';

const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('cloud_lib_session');
  if (token) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return fetch(url, options);
};

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [editingUser, setEditingUser] = useState(null);
  const [editFormData, setEditFormData] = useState({ email: '', role: '', status: '', password: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || 'Failed to fetch users');
      }
    } catch (err) {
      setErrorMsg('Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (username) => {
    try {
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(username)}/approve`, {
        method: 'POST'
      });
      if (res.ok) {
        setUsers(users.map(u => u.username === username ? { ...u, status: 'approved' } : u));
      } else {
        alert('Failed to approve user');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleReject = async (username) => {
    if (!window.confirm(`Are you sure you want to reject ${username}?`)) return;
    try {
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(username)}/reject`, {
        method: 'POST'
      });
      if (res.ok) {
        setUsers(users.map(u => u.username === username ? { ...u, status: 'rejected' } : u));
      } else {
        alert('Failed to reject user');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleDelete = async (username) => {
    if (!window.confirm(`Are you sure you want to completely delete ${username} and ALL their data? This cannot be undone.`)) return;
    try {
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(users.filter(u => u.username !== username));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const startEdit = (user) => {
    setEditingUser(user.username);
    setEditFormData({ email: user.email === 'N/A' ? '' : user.email || '', role: user.role, status: user.status, password: '' });
  };

  const saveEdit = async (username) => {
    try {
      const res = await authFetch(`/api/admin/users/${encodeURIComponent(username)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(users.map(u => u.username === username ? data.user : u));
        setEditingUser(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update user');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
      <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '24px' }}>Admin Panel</h2>
      {errorMsg && <div style={{ color: '#ff3b30', marginBottom: '16px' }}>{errorMsg}</div>}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {users.map(user => (
          <div key={user.username} style={{ 
            display: 'flex', 
            flexDirection: 'column',
            background: 'rgba(255,255,255,0.05)',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{user.username}</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  {user.email || 'No email provided'}
                </div>
                <span style={{ 
                  fontSize: '12px', 
                  textTransform: 'uppercase', 
                  fontWeight: '700',
                  color: user.status === 'approved' ? '#34c759' : user.status === 'rejected' ? '#ff3b30' : '#ff9500'
                }}>
                  {user.role} • {user.status}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {user.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleApprove(user.username)}
                      style={{ 
                        background: '#34c759', color: '#fff', border: 'none', 
                        padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'
                      }}>
                      Approve
                    </button>
                    <button 
                      onClick={() => handleReject(user.username)}
                      style={{ 
                        background: 'rgba(255,59,48,0.2)', color: '#ff3b30', border: 'none', 
                        padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'
                      }}>
                      Reject
                    </button>
                  </>
                )}
                <button 
                  onClick={() => editingUser === user.username ? setEditingUser(null) : startEdit(user)}
                  style={{ 
                    background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', 
                    padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'
                  }}>
                  {editingUser === user.username ? 'Cancel' : 'Edit'}
                </button>
                <button 
                  onClick={() => handleDelete(user.username)}
                  style={{ 
                    background: 'rgba(255,59,48,0.2)', color: '#ff3b30', border: 'none', 
                    padding: '6px 12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '13px'
                  }}>
                  Delete
                </button>
              </div>
            </div>

            {/* Inline Edit Form */}
            {editingUser === user.username && (
              <div style={{ 
                marginTop: '16px', 
                paddingTop: '16px', 
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'grid',
                gap: '12px',
                gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                alignItems: 'end'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Email</label>
                  <input 
                    type="email" 
                    value={editFormData.email} 
                    onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>New Password</label>
                  <input 
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={editFormData.password} 
                    onChange={e => setEditFormData({ ...editFormData, password: e.target.value })}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Role</label>
                  <select 
                    value={editFormData.role} 
                    onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px', borderRadius: '6px' }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status</label>
                  <select 
                    value={editFormData.status} 
                    onChange={e => setEditFormData({ ...editFormData, status: e.target.value })}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px', borderRadius: '6px' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <button 
                  onClick={() => saveEdit(user.username)}
                  style={{ 
                    background: 'var(--accent-color)', color: '#fff', border: 'none', 
                    padding: '8px 16px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', height: '35px'
                  }}>
                  Save
                </button>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && (
          <div style={{ color: 'var(--text-secondary)' }}>No users found.</div>
        )}
      </div>
    </div>
  );
}
