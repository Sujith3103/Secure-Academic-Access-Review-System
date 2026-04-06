import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { adminApi, authApi } from '../api/client';

interface User { id: string; email: string; firstName: string; lastName: string; role: string; isActive: boolean; createdAt: string; }
interface Cycle { id: string; name: string; startDate: string; endDate: string; isActive: boolean; }
interface AuditLog { id: string; action: string; resource: string; resourceId: string; status?: string; ipAddress?: string; createdAt: string; actor?: { email: string; firstName: string; lastName: string; role: string }; }
interface Session { id: string; createdAt: string; expiresAt: string; ipAddress?: string; userAgent?: string; }
interface SystemStats {
    users: { total: number; admins: number; staff: number; students: number };
    cycles: { total: number; active: number };
    assignments: { total: number };
    submissions: { total: number; graded: number };
    auditLogs: { total: number };
    activity: { loginsLast24h: number };
}

const AUDIT_ACTIONS = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'UPLOAD', 'ASSIGN', 'GRADE', 'SUBMIT', 'REVIEW', 'VIEW', 'EXPORT'];

const AdminDashboard: React.FC = () => {
    const { user, clearAuth, refreshToken } = useAuthStore();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'cycles' | 'assign' | 'upload' | 'audit' | 'sessions'>('overview');
    const [users, setUsers] = useState<User[]>([]);
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(false);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [cycleForm, setCycleForm] = useState({ name: '', description: '', startDate: '', endDate: '' });
    const [assignForm, setAssignForm] = useState({ staffId: '', studentIds: '' });
    const [staffList, setStaffList] = useState<User[]>([]);
    const [studentList, setStudentList] = useState<User[]>([]);
    const [auditFilters, setAuditFilters] = useState({ action: '', search: '', startDate: '', endDate: '' });
    const [auditPage, setAuditPage] = useState(1);
    const [auditTotal, setAuditTotal] = useState(0);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersRes, cyclesRes, auditRes, statsRes] = await Promise.all([
                adminApi.getUsers({ limit: 100 }),
                adminApi.getCycles({ limit: 20 }),
                adminApi.getAuditLogs({ limit: 20 }),
                adminApi.getStats(),
            ]);
            const allUsers = usersRes.data.data as User[];
            setUsers(allUsers);
            setStaffList(allUsers.filter(u => u.role === 'STAFF'));
            setStudentList(allUsers.filter(u => u.role === 'STUDENT'));
            setCycles(cyclesRes.data.data as Cycle[]);
            setAuditLogs(auditRes.data.data as AuditLog[]);
            setAuditTotal(auditRes.data.meta?.total ?? auditRes.data.data.length);
            setStats(statsRes.data.data as SystemStats);
        } catch { toast.error('Failed to load dashboard data'); }
        finally { setLoading(false); }
    };

    const handleLogout = async () => {
        try { await authApi.logout(refreshToken ?? ''); } catch { /* ignore */ }
        clearAuth();
        navigate('/login');
    };

    const handleCreateCycle = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await adminApi.createCycle({ ...cycleForm });
            toast.success('Academic cycle created!');
            setCycleForm({ name: '', description: '', startDate: '', endDate: '' });
            loadData();
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create cycle');
        }
    };

    const handleAssign = async (e: React.FormEvent) => {
        e.preventDefault();
        const studentIds = assignForm.studentIds.split(',').map(s => s.trim()).filter(Boolean);
        try {
            await adminApi.assignStudents({ staffId: assignForm.staffId, studentIds });
            toast.success('Students assigned successfully!');
            setAssignForm({ staffId: '', studentIds: '' });
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Assignment failed');
        }
    };

    const handleBulkUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!csvFile) { toast.error('Please select a CSV file'); return; }
        try {
            const res = await adminApi.bulkUpload(csvFile);
            const result = res.data.data as { created: number; skipped: number; errors: string[] };
            toast.success(`Created: ${result.created}, Skipped: ${result.skipped}`);
            setCsvFile(null);
            loadData();
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed');
        }
    };

    const handleDeactivateUser = async (userId: string) => {
        if (!window.confirm('Are you sure you want to deactivate this user? They will be logged out of all sessions.')) return;
        try {
            await adminApi.deactivateUser(userId);
            toast.success('User deactivated');
            loadData();
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to deactivate');
        }
    };

    const loadAuditLogs = async (page = 1) => {
        try {
            const params: Record<string, unknown> = { page, limit: 20 };
            if (auditFilters.action) params.action = auditFilters.action;
            if (auditFilters.search) params.search = auditFilters.search;
            if (auditFilters.startDate) params.startDate = new Date(auditFilters.startDate).toISOString();
            if (auditFilters.endDate) params.endDate = new Date(auditFilters.endDate).toISOString();
            const res = await adminApi.getAuditLogs(params);
            setAuditLogs(res.data.data as AuditLog[]);
            setAuditTotal(res.data.meta?.total ?? res.data.data.length);
            setAuditPage(page);
        } catch { toast.error('Failed to load audit logs'); }
    };

    const loadSessions = async () => {
        try {
            const res = await authApi.getSessions();
            setSessions(res.data.data as Session[]);
        } catch { toast.error('Failed to load sessions'); }
    };

    const handleRevokeSession = async (sessionId: string) => {
        if (!window.confirm('Revoke this session?')) return;
        try {
            await authApi.revokeSession(sessionId);
            toast.success('Session revoked');
            loadSessions();
        } catch { toast.error('Failed to revoke session'); }
    };

    const handleRevokeAllSessions = async () => {
        if (!window.confirm('This will log you out of all other devices. Continue?')) return;
        try {
            await authApi.revokeAllSessions();
            toast.success('All other sessions revoked');
            loadSessions();
        } catch { toast.error('Failed to revoke sessions'); }
    };

    const parseUserAgent = (ua?: string): string => {
        if (!ua) return '—';
        if (ua.includes('Chrome')) return '🌐 Chrome';
        if (ua.includes('Firefox')) return '🦊 Firefox';
        if (ua.includes('Safari')) return '🔵 Safari';
        if (ua.includes('Postman')) return '🔧 Postman';
        return ua.slice(0, 30) + '...';
    };

    if (!user || user.role !== 'ADMIN') return <Navigate to="/login" replace />;

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="logo-icon sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg></div>
                    <span>SAARS</span>
                </div>
                <nav className="sidebar-nav">
                    {[
                        { id: 'overview', icon: '📊', label: 'Overview' },
                        { id: 'users', icon: '👥', label: 'Users' },
                        { id: 'cycles', icon: '📅', label: 'Cycles' },
                        { id: 'assign', icon: '🔗', label: 'Assign' },
                        { id: 'upload', icon: '📤', label: 'Bulk Upload' },
                        { id: 'audit', icon: '📋', label: 'Audit Logs' },
                        { id: 'sessions', icon: '🔐', label: 'Sessions' },
                    ].map(tab => (
                        <button key={tab.id} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => { setActiveTab(tab.id as typeof activeTab); if (tab.id === 'audit') loadAuditLogs(); if (tab.id === 'sessions') loadSessions(); }}>
                            <span className="nav-icon">{tab.icon}</span><span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="sidebar-user">
                    <div className="user-avatar">{user.firstName[0]}{user.lastName[0]}</div>
                    <div className="user-info"><span className="user-name">{user.firstName} {user.lastName}</span><span className="user-role">Administrator</span></div>
                    <button onClick={handleLogout} className="btn-ghost btn-sm" title="Logout">↩</button>
                </div>
            </aside>

            <main className="dashboard-main">
                <header className="dash-header">
                    <div>
                        <h1 className="dash-title">{{ overview: 'Dashboard Overview', users: 'User Management', cycles: 'Academic Cycles', assign: 'Staff Assignment', upload: 'Bulk Upload', audit: 'Audit Logs', sessions: 'Session Management' }[activeTab]}</h1>
                        <p className="dash-subtitle">Manage your academic institution</p>
                    </div>
                    <button onClick={loadData} className="btn-secondary" disabled={loading}>{loading ? '⟳ Loading...' : '↻ Refresh'}</button>
                </header>

                <div className="dash-content">
                    {activeTab === 'overview' && (
                        <div>
                            <div className="stats-grid">
                                {[
                                    { label: 'Total Users', value: stats?.users.total ?? 0, color: 'purple', icon: '👥' },
                                    { label: 'Staff Members', value: stats?.users.staff ?? 0, color: 'blue', icon: '👨‍🏫' },
                                    { label: 'Students', value: stats?.users.students ?? 0, color: 'green', icon: '🎓' },
                                    { label: 'Active Cycles', value: stats?.cycles.active ?? 0, color: 'orange', icon: '📅' },
                                ].map(stat => (
                                    <div key={stat.label} className={`stat-card stat-${stat.color}`}>
                                        <div className="stat-icon">{stat.icon}</div>
                                        <div className="stat-number">{stat.value}</div>
                                        <div className="stat-label">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="stats-grid mt-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                {[
                                    { label: 'Assignments', value: stats?.assignments.total ?? 0, color: 'blue', icon: '📝' },
                                    { label: 'Submissions', value: stats?.submissions.total ?? 0, color: 'green', icon: '📬' },
                                    { label: 'Logins (24h)', value: stats?.activity.loginsLast24h ?? 0, color: 'purple', icon: '🔐' },
                                ].map(stat => (
                                    <div key={stat.label} className={`stat-card stat-${stat.color}`}>
                                        <div className="stat-icon">{stat.icon}</div>
                                        <div className="stat-number">{stat.value}</div>
                                        <div className="stat-label">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6">
                                <h2 className="section-title">Recent Audit Activity</h2>
                                <div className="table-card">
                                    <table className="data-table">
                                        <thead><tr><th>Action</th><th>Resource</th><th>Status</th><th>Actor</th><th>Time</th></tr></thead>
                                        <tbody>
                                            {auditLogs.slice(0, 8).map(log => (
                                                <tr key={log.id}>
                                                    <td><span className={`badge badge-${log.action.toLowerCase()}`}>{log.action}</span></td>
                                                    <td className="text-muted">{log.resource}</td>
                                                    <td><span className={`badge badge-audit-${(log.status ?? 'SUCCESS').toLowerCase()}`}>{log.status ?? 'SUCCESS'}</span></td>
                                                    <td>{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'System'}</td>
                                                    <td className="text-muted text-sm">{new Date(log.createdAt).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="table-card">
                            <table className="data-table">
                                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id}>
                                            <td className="font-medium">{u.firstName} {u.lastName}</td>
                                            <td className="text-muted">{u.email}</td>
                                            <td><span className={`badge badge-role-${u.role.toLowerCase()}`}>{u.role}</span></td>
                                            <td><span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                                            <td className="text-sm text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                {u.isActive && u.role !== 'ADMIN' && (
                                                    <button className="btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => handleDeactivateUser(u.id)}>Deactivate</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'cycles' && (
                        <div>
                            <form onSubmit={handleCreateCycle} className="form-card">
                                <h2 className="form-title">Create Academic Cycle</h2>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">Cycle Name</label>
                                        <input className="form-input" placeholder="e.g. Semester 1 2024-25" value={cycleForm.name} onChange={e => setCycleForm(p => ({ ...p, name: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Description</label>
                                        <input className="form-input" placeholder="Optional description" value={cycleForm.description} onChange={e => setCycleForm(p => ({ ...p, description: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Start Date</label>
                                        <input type="datetime-local" className="form-input" value={cycleForm.startDate} onChange={e => setCycleForm(p => ({ ...p, startDate: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End Date</label>
                                        <input type="datetime-local" className="form-input" value={cycleForm.endDate} onChange={e => setCycleForm(p => ({ ...p, endDate: e.target.value }))} required />
                                    </div>
                                </div>
                                <button type="submit" className="btn-primary mt-4">Create Cycle</button>
                            </form>
                            <div className="table-card mt-6">
                                <table className="data-table">
                                    <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {cycles.map(c => (
                                            <tr key={c.id}>
                                                <td className="font-medium">{c.name}</td>
                                                <td className="text-muted">{new Date(c.startDate).toLocaleDateString()}</td>
                                                <td className="text-muted">{new Date(c.endDate).toLocaleDateString()}</td>
                                                <td><span className={`badge ${c.isActive ? 'badge-active' : 'badge-inactive'}`}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'assign' && (
                        <form onSubmit={handleAssign} className="form-card">
                            <h2 className="form-title">Assign Students to Staff</h2>
                            <p className="form-hint">Maximum 20 students per staff member</p>
                            <div className="form-group mt-4">
                                <label className="form-label">Staff Member</label>
                                <select className="form-input" value={assignForm.staffId} onChange={e => setAssignForm(p => ({ ...p, staffId: e.target.value }))} required>
                                    <option value="">Select staff member...</option>
                                    {staffList.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.email})</option>)}
                                </select>
                            </div>
                            <div className="form-group mt-4">
                                <label className="form-label">Students</label>
                                <select className="form-input" multiple value={assignForm.studentIds.split(',').filter(Boolean)} onChange={e => setAssignForm(p => ({ ...p, studentIds: Array.from(e.target.selectedOptions).map(o => o.value).join(',') }))}>
                                    {studentList.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.email})</option>)}
                                </select>
                                <p className="form-hint mt-1">Hold Ctrl/Cmd to select multiple students</p>
                            </div>
                            <button type="submit" className="btn-primary mt-4">Assign Students</button>
                        </form>
                    )}

                    {activeTab === 'upload' && (
                        <form onSubmit={handleBulkUpload} className="form-card">
                            <h2 className="form-title">Bulk Student Onboarding</h2>
                            <p className="form-hint mt-2">Upload a CSV file with columns: <code>email, firstName, lastName, password</code> (password optional, defaults to <code>Saars@2024!</code>)</p>
                            <div className="upload-zone mt-6" onClick={() => document.getElementById('csv-input')?.click()}>
                                <div className="upload-icon">📤</div>
                                <p>{csvFile ? csvFile.name : 'Click to select CSV file'}</p>
                                <p className="text-sm text-muted mt-1">Max 500 rows, 5MB</p>
                                <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={e => setCsvFile(e.target.files?.[0] ?? null)} />
                            </div>
                            <button type="submit" className="btn-primary mt-4" disabled={!csvFile}>Upload & Process</button>
                        </form>
                    )}

                    {activeTab === 'audit' && (
                        <div>
                            <div className="form-card mb-4">
                                <div className="form-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Action</label>
                                        <select className="form-input" value={auditFilters.action} onChange={e => setAuditFilters(p => ({ ...p, action: e.target.value }))}>
                                            {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a || 'All Actions'}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Search</label>
                                        <input className="form-input" placeholder="Resource or actor email..." value={auditFilters.search} onChange={e => setAuditFilters(p => ({ ...p, search: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">From</label>
                                        <input type="date" className="form-input" value={auditFilters.startDate} onChange={e => setAuditFilters(p => ({ ...p, startDate: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">To</label>
                                        <input type="date" className="form-input" value={auditFilters.endDate} onChange={e => setAuditFilters(p => ({ ...p, endDate: e.target.value }))} />
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-4">
                                    <button className="btn-primary btn-sm" onClick={() => loadAuditLogs(1)}>Apply Filters</button>
                                    <button className="btn-secondary btn-sm" onClick={() => { setAuditFilters({ action: '', search: '', startDate: '', endDate: '' }); loadAuditLogs(1); }}>Reset</button>
                                </div>
                            </div>
                            <div className="table-card">
                                <table className="data-table">
                                    <thead><tr><th>Action</th><th>Resource</th><th>Resource ID</th><th>Status</th><th>Actor</th><th>IP</th><th>Time</th></tr></thead>
                                    <tbody>
                                        {auditLogs.map(log => (
                                            <tr key={log.id}>
                                                <td><span className={`badge badge-${log.action.toLowerCase()}`}>{log.action}</span></td>
                                                <td>{log.resource}</td>
                                                <td className="text-muted text-sm font-mono">{log.resourceId ? `${log.resourceId.slice(0, 8)}...` : '—'}</td>
                                                <td><span className={`badge badge-audit-${(log.status ?? 'SUCCESS').toLowerCase()}`}>{log.status ?? 'SUCCESS'}</span></td>
                                                <td>{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'System'}</td>
                                                <td className="text-muted text-sm font-mono">{log.ipAddress ?? '—'}</td>
                                                <td className="text-sm text-muted">{new Date(log.createdAt).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {auditTotal > 20 && (
                                <div className="flex-between mt-4">
                                    <span className="text-sm text-muted">Showing {auditLogs.length} of {auditTotal} logs</span>
                                    <div className="flex gap-2">
                                        <button className="btn-secondary btn-sm" disabled={auditPage <= 1} onClick={() => loadAuditLogs(auditPage - 1)}>← Prev</button>
                                        <button className="btn-secondary btn-sm" disabled={auditPage * 20 >= auditTotal} onClick={() => loadAuditLogs(auditPage + 1)}>Next →</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'sessions' && (
                        <div>
                            <div className="flex-between mb-4">
                                <p className="text-muted">Your active sessions across devices</p>
                                <button className="btn-secondary btn-sm" style={{ color: 'var(--red)' }} onClick={handleRevokeAllSessions}>Revoke All Other Sessions</button>
                            </div>
                            <div className="table-card">
                                <table className="data-table">
                                    <thead><tr><th>Device</th><th>IP Address</th><th>Created</th><th>Expires</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {sessions.length === 0 ? (
                                            <tr><td colSpan={5} className="text-center text-muted py-8">No active sessions found. Click refresh to load.</td></tr>
                                        ) : sessions.map((s, i) => (
                                            <tr key={s.id}>
                                                <td className="font-medium">
                                                    {parseUserAgent(s.userAgent)}
                                                    {i === 0 && <span className="badge badge-active ml-1">Current</span>}
                                                </td>
                                                <td className="text-muted font-mono text-sm">{s.ipAddress ?? '—'}</td>
                                                <td className="text-sm text-muted">{new Date(s.createdAt).toLocaleString()}</td>
                                                <td className="text-sm text-muted">{new Date(s.expiresAt).toLocaleString()}</td>
                                                <td>
                                                    {i > 0 && (
                                                        <button className="btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => handleRevokeSession(s.id)}>Revoke</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
