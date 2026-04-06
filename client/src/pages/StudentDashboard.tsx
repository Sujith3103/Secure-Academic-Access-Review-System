import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { studentApi, authApi } from '../api/client';

interface StaffInfo { id: string; email: string; firstName: string; lastName: string; }
interface StaffMapping { staff: StaffInfo; }
interface SubmissionInfo { id: string; status: string; submittedAt: string; version: number; isLate: boolean; }
interface Assignment { id: string; title: string; description: string; dueDate: string; maxGrade: number; academicCycle?: { name: string }; staff?: StaffInfo; submissions?: SubmissionInfo[]; }
interface Submission { id: string; assignmentId: string; status: string; submittedAt: string; content?: string; fileUrl?: string; version?: number; isLate?: boolean; assignment?: { id: string; title: string; maxGrade: number; dueDate: string; }; grade?: { score: number; feedback?: string }; reviewComment?: { comment: string }; }
interface Grade { id: string; score: number; feedback?: string; createdAt: string; submission: { id: string; assignment: { title: string; maxGrade: number; dueDate: string }; reviewComment?: { comment: string; createdAt: string }; reEvalRequest?: { id: string; status: string; reason: string; staffResponse?: string; createdAt: string }; }; staff: { firstName: string; lastName: string }; }
interface ReEvalRequest { id: string; status: string; reason: string; staffResponse?: string; createdAt: string; submission: { id: string; assignment: { title: string; maxGrade: number }; grade?: { score: number; feedback?: string }; }; }

const StudentDashboard: React.FC = () => {
    const { user, clearAuth, refreshToken } = useAuthStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'submit' | 'grades' | 'reeval'>('overview');
    const [staffList, setStaffList] = useState<StaffMapping[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [reEvals, setReEvals] = useState<ReEvalRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitForm, setSubmitForm] = useState({ assignmentId: '', content: '' });
    const [submitFile, setSubmitFile] = useState<File | null>(null);
    const [reEvalModal, setReEvalModal] = useState<{ submissionId: string; assignmentTitle: string } | null>(null);
    const [reEvalReason, setReEvalReason] = useState('');

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [staffRes, assignRes, subRes, gradeRes, reEvalRes] = await Promise.all([
                studentApi.getMyStaff(),
                studentApi.getAssignments(),
                studentApi.getSubmissions(),
                studentApi.getGrades(),
                studentApi.getReEvaluations(),
            ]);
            // API now returns array of mappings
            const staffData = staffRes.data.data;
            setStaffList(Array.isArray(staffData) ? staffData as StaffMapping[] : (staffData ? [staffData] : []));
            setAssignments(assignRes.data.data as Assignment[]);
            setSubmissions(subRes.data.data as Submission[]);
            setGrades(gradeRes.data.data as Grade[]);
            setReEvals(reEvalRes.data.data as ReEvalRequest[]);
        } catch { toast.error('Failed to load data'); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!submitForm.assignmentId) { toast.error('Please select an assignment'); return; }
        try {
            const res = await studentApi.submit(submitForm, submitFile ?? undefined);
            toast.success(res.data.message || 'Submitted successfully!');
            setSubmitForm({ assignmentId: '', content: '' });
            setSubmitFile(null);
            loadAll();
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Submission failed');
        }
    };

    const handleReEvalRequest = async () => {
        if (!reEvalModal || reEvalReason.length < 10) {
            toast.error('Please provide a detailed reason (at least 10 characters)');
            return;
        }
        try {
            await studentApi.requestReEval({ submissionId: reEvalModal.submissionId, reason: reEvalReason });
            toast.success('Re-evaluation request submitted!');
            setReEvalModal(null);
            setReEvalReason('');
            loadAll();
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Request failed');
        }
    };

    const handleLogout = async () => {
        try { await authApi.logout(refreshToken ?? ''); } catch { /* ignore */ }
        clearAuth(); navigate('/login');
    };

    if (!user || user.role !== 'STUDENT') return <Navigate to="/login" replace />;

    // Compute overview stats
    const totalAssignments = assignments.length;
    const submittedCount = submissions.length;
    const gradedCount = grades.length;
    const avgScore = gradedCount > 0 ? (grades.reduce((s, g) => s + g.score, 0) / gradedCount).toFixed(1) : '—';
    const pendingAssignments = assignments.filter(a => {
        const submitted = a.submissions && a.submissions.length > 0;
        return !submitted;
    });
    const pendingReEvals = reEvals.filter(r => r.status === 'PENDING').length;

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-brand"><div className="logo-icon sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg></div><span>SAARS</span></div>
                <nav className="sidebar-nav">
                    {[
                        { id: 'overview', icon: '📊', label: 'Overview' },
                        { id: 'assignments', icon: '📝', label: 'Assignments' },
                        { id: 'submit', icon: '📤', label: 'Submit Work' },
                        { id: 'grades', icon: '🏆', label: 'My Grades' },
                        { id: 'reeval', icon: '🔄', label: 'Re-evaluations', badge: pendingReEvals },
                    ].map(tab => (
                        <button key={tab.id} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id as typeof activeTab)}>
                            <span className="nav-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                            {'badge' in tab && tab.badge ? <span className="nav-badge">{tab.badge}</span> : null}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-user">
                    <div className="user-avatar">{user.firstName[0]}{user.lastName[0]}</div>
                    <div className="user-info"><span className="user-name">{user.firstName} {user.lastName}</span><span className="user-role">Student</span></div>
                    <button onClick={handleLogout} className="btn-ghost btn-sm" title="Logout">↩</button>
                </div>
            </aside>

            <main className="dashboard-main">
                <header className="dash-header">
                    <div>
                        <h1 className="dash-title">{{ overview: 'Student Overview', assignments: 'My Assignments', submit: 'Submit Assignment', grades: 'My Grades', reeval: 'Re-evaluation Requests' }[activeTab]}</h1>
                        <p className="dash-subtitle">Student Portal — {user.firstName} {user.lastName}</p>
                    </div>
                    <button onClick={loadAll} className="btn-secondary" disabled={loading}>{loading ? '⟳ Loading...' : '↻ Refresh'}</button>
                </header>

                <div className="dash-content">
                    {activeTab === 'overview' && (
                        <div>
                            <div className="stats-grid">
                                {[
                                    { label: 'Assignments', value: totalAssignments, color: 'blue', icon: '📝' },
                                    { label: 'Submitted', value: submittedCount, color: 'green', icon: '✅' },
                                    { label: 'Graded', value: gradedCount, color: 'purple', icon: '📊' },
                                    { label: 'Avg Score', value: avgScore, color: 'orange', icon: '🏆' },
                                ].map(stat => (
                                    <div key={stat.label} className={`stat-card stat-${stat.color}`}>
                                        <div className="stat-icon">{stat.icon}</div>
                                        <div className="stat-number">{stat.value}</div>
                                        <div className="stat-label">{stat.label}</div>
                                    </div>
                                ))}
                            </div>

                            {staffList.length > 0 && (
                                <div className="mt-6">
                                    <h2 className="section-title">My Instructors</h2>
                                    <div className="cards-grid">
                                        {staffList.map(m => (
                                            <div key={m.staff.id} className="assignment-card">
                                                <div className="assignment-header">
                                                    <div className="user-avatar" style={{ width: '2.5rem', height: '2.5rem', fontSize: '0.9rem' }}>{m.staff.firstName[0]}{m.staff.lastName[0]}</div>
                                                    <div><h3 className="assignment-title">{m.staff.firstName} {m.staff.lastName}</h3><p className="text-sm text-muted">{m.staff.email}</p></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {pendingAssignments.length > 0 && (
                                <div className="mt-6">
                                    <h2 className="section-title">⚠️ Pending Submissions</h2>
                                    <div className="cards-grid">
                                        {pendingAssignments.map(a => (
                                            <div key={a.id} className="assignment-card" onClick={() => { setSubmitForm(p => ({ ...p, assignmentId: a.id })); setActiveTab('submit'); }}>
                                                <h3 className="assignment-title">{a.title}</h3>
                                                <p className="assignment-desc">{a.description.length > 60 ? a.description.slice(0, 60) + '...' : a.description}</p>
                                                <div className="assignment-footer">
                                                    <span className={`text-sm ${new Date(a.dueDate) < new Date() ? 'text-danger' : 'text-muted'}`}>
                                                        Due: {new Date(a.dueDate).toLocaleDateString()}
                                                    </span>
                                                    <span className="badge badge-grade">{a.maxGrade} pts</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {gradedCount > 0 && (
                                <div className="mt-6">
                                    <h2 className="section-title">Recent Grades</h2>
                                    <div className="table-card">
                                        <table className="data-table">
                                            <thead><tr><th>Assignment</th><th>Score</th><th>Date</th></tr></thead>
                                            <tbody>
                                                {grades.slice(0, 5).map(g => (
                                                    <tr key={g.id}>
                                                        <td className="font-medium">{g.submission.assignment.title}</td>
                                                        <td><span className="font-medium" style={{ color: 'var(--green)' }}>{g.score}/{g.submission.assignment.maxGrade}</span></td>
                                                        <td className="text-sm text-muted">{new Date(g.createdAt).toLocaleDateString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div className="cards-grid">
                            {assignments.length === 0 ? <p className="text-center text-muted py-12">No assignments available yet.</p> :
                                assignments.map(a => {
                                    const latestSubmission = a.submissions?.[0];
                                    const submitted = !!latestSubmission;
                                    const isOverdue = new Date(a.dueDate) < new Date();
                                    return (
                                        <div key={a.id} className={`assignment-card ${isOverdue && !submitted ? 'overdue' : ''}`}>
                                            <div className="assignment-header">
                                                <h3 className="assignment-title">{a.title}</h3>
                                                <span className="badge badge-grade">{a.maxGrade} pts</span>
                                            </div>
                                            <p className="assignment-desc">{a.description}</p>
                                            {a.academicCycle && <p className="text-sm text-muted mt-1">Cycle: {a.academicCycle.name}</p>}
                                            {a.staff && <p className="text-sm text-muted">By: {a.staff.firstName} {a.staff.lastName}</p>}
                                            <div className="assignment-footer">
                                                <span className={`text-sm ${isOverdue ? 'text-danger' : 'text-muted'}`}>
                                                    {isOverdue ? '⚠️ Overdue' : `Due: ${new Date(a.dueDate).toLocaleDateString()}`}
                                                </span>
                                                <div className="flex gap-2">
                                                    {submitted ? (
                                                        <>
                                                            <span className="badge badge-active">✓ v{latestSubmission.version}</span>
                                                            {latestSubmission.isLate && <span className="badge badge-late">Late</span>}
                                                        </>
                                                    ) : (
                                                        <span className="badge badge-inactive">Pending</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {activeTab === 'submit' && (
                        <form onSubmit={handleSubmit} className="form-card">
                            <h2 className="form-title">Submit Your Work</h2>
                            <p className="form-hint mt-1">You can submit multiple versions. Late submissions will be flagged but accepted.</p>
                            <div className="form-group mt-4">
                                <label className="form-label">Assignment</label>
                                <select className="form-input" value={submitForm.assignmentId} onChange={e => setSubmitForm(p => ({ ...p, assignmentId: e.target.value }))} required>
                                    <option value="">Select assignment...</option>
                                    {assignments.map(a => {
                                        const isOverdue = new Date(a.dueDate) < new Date();
                                        return <option key={a.id} value={a.id}>{a.title} (Due: {new Date(a.dueDate).toLocaleDateString()}{isOverdue ? ' ⚠ Late' : ''})</option>;
                                    })}
                                </select>
                            </div>
                            <div className="form-group mt-4">
                                <label className="form-label">Content / Notes</label>
                                <textarea className="form-input" rows={6} placeholder="Write your answer or notes here..." value={submitForm.content} onChange={e => setSubmitForm(p => ({ ...p, content: e.target.value }))} />
                            </div>
                            <div className="form-group mt-4">
                                <label className="form-label">File Attachment (optional)</label>
                                <div className="upload-zone sm" onClick={() => document.getElementById('submit-file')?.click()}>
                                    <p>{submitFile ? submitFile.name : 'Click to attach PDF, Word, or image file'}</p>
                                    <input id="submit-file" type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt" className="hidden" onChange={e => setSubmitFile(e.target.files?.[0] ?? null)} />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary mt-4">Submit</button>
                        </form>
                    )}

                    {activeTab === 'grades' && (
                        <div className="table-card">
                            <table className="data-table">
                                <thead><tr><th>Assignment</th><th>Score</th><th>Feedback</th><th>Graded By</th><th>Date</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {grades.length === 0 ? <tr><td colSpan={6} className="text-center text-muted py-8">No grades yet</td></tr> :
                                        grades.map(g => {
                                            const hasReEval = g.submission.reEvalRequest;
                                            return (
                                                <tr key={g.id}>
                                                    <td className="font-medium">{g.submission.assignment.title}</td>
                                                    <td><span className="font-medium" style={{ color: 'var(--green)' }}>{g.score} / {g.submission.assignment.maxGrade}</span></td>
                                                    <td className="text-muted">{g.feedback || '—'}</td>
                                                    <td className="text-muted text-sm">{g.staff.firstName} {g.staff.lastName}</td>
                                                    <td className="text-sm text-muted">{new Date(g.createdAt).toLocaleDateString()}</td>
                                                    <td>
                                                        {hasReEval ? (
                                                            <span className={`badge badge-${hasReEval.status.toLowerCase()}`}>{hasReEval.status}</span>
                                                        ) : (
                                                            <button className="btn-ghost btn-sm" style={{ color: 'var(--yellow)' }} onClick={() => setReEvalModal({ submissionId: g.submission.id, assignmentTitle: g.submission.assignment.title })}>
                                                                🔄 Re-evaluate
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'reeval' && (
                        <div>
                            {reEvals.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">🔄</div>
                                    <h3>No re-evaluation requests</h3>
                                    <p>You can request re-evaluation from the "My Grades" tab.</p>
                                </div>
                            ) : (
                                <div className="table-card">
                                    <table className="data-table">
                                        <thead><tr><th>Assignment</th><th>Current Score</th><th>Your Reason</th><th>Status</th><th>Staff Response</th><th>Date</th></tr></thead>
                                        <tbody>
                                            {reEvals.map(r => (
                                                <tr key={r.id}>
                                                    <td className="font-medium">{r.submission.assignment.title}</td>
                                                    <td><span className="font-medium" style={{ color: 'var(--green)' }}>{r.submission.grade?.score ?? '—'} / {r.submission.assignment.maxGrade}</span></td>
                                                    <td className="text-muted" style={{ maxWidth: '200px' }}>{r.reason.length > 60 ? r.reason.slice(0, 60) + '...' : r.reason}</td>
                                                    <td><span className={`badge badge-reeval-${r.status.toLowerCase()}`}>{r.status}</span></td>
                                                    <td className="text-muted">{r.staffResponse ?? '—'}</td>
                                                    <td className="text-sm text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Re-Evaluation Request Modal */}
            {reEvalModal && (
                <div className="modal-overlay" onClick={() => setReEvalModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Request Re-Evaluation</h2>
                        <p className="text-muted mt-2">Assignment: <strong style={{ color: 'var(--text)' }}>{reEvalModal.assignmentTitle}</strong></p>
                        <div className="form-group mt-4">
                            <label className="form-label">Reason for re-evaluation</label>
                            <textarea
                                className="form-input"
                                rows={4}
                                placeholder="Explain why you believe this submission should be re-evaluated (at least 10 characters)..."
                                value={reEvalReason}
                                onChange={e => setReEvalReason(e.target.value)}
                            />
                            <span className="form-hint mt-1">{reEvalReason.length}/1000 characters</span>
                        </div>
                        <div className="modal-actions mt-6">
                            <button className="btn-secondary" onClick={() => { setReEvalModal(null); setReEvalReason(''); }}>Cancel</button>
                            <button className="btn-primary" onClick={handleReEvalRequest} disabled={reEvalReason.length < 10}>Submit Request</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
