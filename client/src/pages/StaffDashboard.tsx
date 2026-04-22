import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/auth.store';
import { staffApi, authApi } from '../api/client';

interface Student { id: string; email: string; firstName: string; lastName: string; }
interface Mapping { student: Student; }
interface Assignment { id: string; title: string; description: string; dueDate: string; maxGrade: number; academicCycleId: string; academicCycle?: { id: string; name: string }; _count?: { submissions: number }; }
interface Submission { id: string; status: string; submittedAt: string; fileUrl?: string; content?: string; version?: number; isLate?: boolean; student: Student; grade?: { score: number; feedback?: string }; reviewComment?: { comment: string }; }
interface ReEvalRequest { id: string; status: string; reason: string; staffResponse?: string; createdAt: string; student: { id: string; email: string; firstName: string; lastName: string }; submission: { id: string; assignment: { id: string; title: string; maxGrade: number }; grade?: { score: number; feedback?: string }; }; }

const StaffDashboard: React.FC = () => {
    const { user, clearAuth, refreshToken } = useAuthStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'assignments' | 'submissions' | 'reevals'>('overview');
    const [students, setStudents] = useState<Mapping[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [reEvals, setReEvals] = useState<ReEvalRequest[]>([]);
    const [selectedAssignment, setSelectedAssignment] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [gradeModal, setGradeModal] = useState<{ submissionId: string; maxGrade: number } | null>(null);
    const [gradeForm, setGradeForm] = useState({ score: '', feedback: '' });
    const [reviewModal, setReviewModal] = useState<string | null>(null);
    const [reviewComment, setReviewComment] = useState('');
    const [reEvalResolveModal, setReEvalResolveModal] = useState<ReEvalRequest | null>(null);
    const [reEvalResolveForm, setReEvalResolveForm] = useState({ status: 'APPROVED' as 'APPROVED' | 'REJECTED', staffResponse: '', newScore: '', newFeedback: '' });
    const [viewModal, setViewModal] = useState<Submission | null>(null);
    const [assignmentForm, setAssignmentForm] = useState({
        title: '', description: '', dueDate: '', maxGrade: 100, academicCycleId: '',
    });

    useEffect(() => { loadStudents(); loadAssignments(); loadReEvals(); }, []);

    const loadStudents = async () => {
        try {
            const res = await staffApi.getMyStudents();
            setStudents(res.data.data as Mapping[]);
        } catch { toast.error('Failed to load students'); }
    };

    const loadAssignments = async () => {
        try {
            const res = await staffApi.getAssignments();
            setAssignments(res.data.data as Assignment[]);
        } catch { toast.error('Failed to load assignments'); }
    };

    const loadSubmissions = async (assignmentId: string) => {
        setLoading(true);
        try {
            const res = await staffApi.getSubmissions(assignmentId);
            setSubmissions(res.data.data as Submission[]);
        } catch { toast.error('Failed to load submissions'); }
        finally { setLoading(false); }
    };

    const loadReEvals = async () => {
        try {
            const res = await staffApi.getReEvaluations();
            setReEvals(res.data.data as ReEvalRequest[]);
        } catch { /* Re-evals may not exist yet */ }
    };

    const handleCreateAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await staffApi.createAssignment({
                ...assignmentForm,
                dueDate: new Date(assignmentForm.dueDate).toISOString(),
                maxGrade: Number(assignmentForm.maxGrade),
            });
            toast.success('Assignment created!');
            setShowCreateForm(false);
            setAssignmentForm({ title: '', description: '', dueDate: '', maxGrade: 100, academicCycleId: '' });
            loadAssignments();
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
        }
    };

    const handleGrade = async () => {
        if (!gradeModal) return;
        try {
            await staffApi.gradeSubmission(gradeModal.submissionId, { score: Number(gradeForm.score), feedback: gradeForm.feedback });
            toast.success('Graded!');
            setGradeModal(null);
            if (selectedAssignment) loadSubmissions(selectedAssignment);
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
        }
    };

    const handleReview = async () => {
        if (!reviewModal) return;
        try {
            await staffApi.reviewSubmission(reviewModal, reviewComment);
            toast.success('Review saved!');
            setReviewModal(null);
            if (selectedAssignment) loadSubmissions(selectedAssignment);
        } catch { toast.error('Failed to save review'); }
    };

    const handleResolveReEval = async () => {
        if (!reEvalResolveModal) return;
        try {
            await staffApi.resolveReEvaluation(reEvalResolveModal.id, {
                status: reEvalResolveForm.status,
                staffResponse: reEvalResolveForm.staffResponse || undefined,
                newScore: reEvalResolveForm.newScore ? Number(reEvalResolveForm.newScore) : undefined,
                newFeedback: reEvalResolveForm.newFeedback || undefined,
            });
            toast.success(`Re-evaluation ${reEvalResolveForm.status.toLowerCase()}`);
            setReEvalResolveModal(null);
            loadReEvals();
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed');
        }
    };

    const handleLogout = async () => {
        try { await authApi.logout(refreshToken ?? ''); } catch { /* ignore */ }
        clearAuth(); navigate('/login');
    };

    if (!user || user.role !== 'STAFF') return <Navigate to="/login" replace />;

    // Stats for overview
    const totalSubmissions = assignments.reduce((acc, a) => acc + (a._count?.submissions ?? 0), 0);
    const upcomingAssignments = assignments.filter(a => new Date(a.dueDate) > new Date()).length;
    const pendingReEvals = reEvals.filter(r => r.status === 'PENDING').length;

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-brand"><div className="logo-icon sm"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></svg></div><span>SAARS</span></div>
                <nav className="sidebar-nav">
                    {[
                        { id: 'overview', icon: '📊', label: 'Overview' },
                        { id: 'students', icon: '👥', label: 'My Students' },
                        { id: 'assignments', icon: '📝', label: 'Assignments' },
                        { id: 'submissions', icon: '📬', label: 'Submissions' },
                        { id: 'reevals', icon: '🔄', label: 'Re-evaluations', badge: pendingReEvals },
                    ].map(tab => (
                        <button key={tab.id} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`} onClick={() => { setActiveTab(tab.id as typeof activeTab); if (tab.id === 'reevals') loadReEvals(); }}>
                            <span className="nav-icon">{tab.icon}</span>
                            <span>{tab.label}</span>
                            {'badge' in tab && tab.badge ? <span className="nav-badge">{tab.badge}</span> : null}
                        </button>
                    ))}
                </nav>
                <div className="sidebar-user">
                    <div className="user-avatar">{user.firstName[0]}{user.lastName[0]}</div>
                    <div className="user-info"><span className="user-name">{user.firstName} {user.lastName}</span><span className="user-role">Staff</span></div>
                    <button onClick={handleLogout} className="btn-ghost btn-sm" title="Logout">↩</button>
                </div>
            </aside>

            <main className="dashboard-main">
                <header className="dash-header">
                    <div><h1 className="dash-title">{{ overview: 'Staff Overview', students: 'My Students', assignments: 'Assignments', submissions: 'Submissions', reevals: 'Re-evaluation Requests' }[activeTab]}</h1>
                        <p className="dash-subtitle">Staff Portal — {user.firstName} {user.lastName}</p>
                    </div>
                </header>

                <div className="dash-content">
                    {activeTab === 'overview' && (
                        <div>
                            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                {[
                                    { label: 'My Students', value: students.length, color: 'blue', icon: '👥' },
                                    { label: 'Assignments', value: assignments.length, color: 'green', icon: '📝' },
                                    { label: 'Total Submissions', value: totalSubmissions, color: 'purple', icon: '📬' },
                                    { label: 'Pending Re-evals', value: pendingReEvals, color: 'orange', icon: '🔄' },
                                ].map(stat => (
                                    <div key={stat.label} className={`stat-card stat-${stat.color}`}>
                                        <div className="stat-icon">{stat.icon}</div>
                                        <div className="stat-number">{stat.value}</div>
                                        <div className="stat-label">{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                            {upcomingAssignments > 0 && (
                                <div className="mt-6">
                                    <h2 className="section-title">Upcoming Deadlines</h2>
                                    <div className="cards-grid">
                                        {assignments.filter(a => new Date(a.dueDate) > new Date()).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 4).map(a => (
                                            <div key={a.id} className="assignment-card" onClick={() => { setSelectedAssignment(a.id); setActiveTab('submissions'); loadSubmissions(a.id); }}>
                                                <div className="assignment-header"><h3 className="assignment-title">{a.title}</h3><span className="badge badge-grade">{a.maxGrade} pts</span></div>
                                                <div className="assignment-footer">
                                                    <span className="text-sm text-muted">Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                                                    <span className="text-sm text-muted">{a._count?.submissions ?? 0} submitted</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'students' && (
                        <div className="table-card">
                            <table className="data-table">
                                <thead><tr><th>Name</th><th>Email</th></tr></thead>
                                <tbody>
                                    {students.length === 0 ? <tr><td colSpan={2} className="text-center text-muted py-8">No students assigned yet</td></tr> :
                                        students.map(m => (
                                            <tr key={m.student.id}>
                                                <td className="font-medium">{m.student.firstName} {m.student.lastName}</td>
                                                <td className="text-muted">{m.student.email}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'assignments' && (
                        <div>
                            <div className="flex-between mb-4">
                                <div />
                                <button className="btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>+ New Assignment</button>
                            </div>
                            {showCreateForm && (
                                <form onSubmit={handleCreateAssignment} className="form-card mb-6">
                                    <h2 className="form-title">Create Assignment</h2>
                                    <div className="form-grid">
                                        <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={assignmentForm.title} onChange={e => setAssignmentForm(p => ({ ...p, title: e.target.value }))} required /></div>
                                        <div className="form-group"><label className="form-label">Academic Cycle ID</label><input className="form-input" placeholder="UUID" value={assignmentForm.academicCycleId} onChange={e => setAssignmentForm(p => ({ ...p, academicCycleId: e.target.value }))} required /></div>
                                        <div className="form-group col-span-2"><label className="form-label">Description</label><textarea className="form-input" rows={3} value={assignmentForm.description} onChange={e => setAssignmentForm(p => ({ ...p, description: e.target.value }))} required /></div>
                                        <div className="form-group"><label className="form-label">Due Date</label><input type="datetime-local" className="form-input" value={assignmentForm.dueDate} onChange={e => setAssignmentForm(p => ({ ...p, dueDate: e.target.value }))} required /></div>
                                        <div className="form-group"><label className="form-label">Max Grade</label><input type="number" className="form-input" value={assignmentForm.maxGrade} onChange={e => setAssignmentForm(p => ({ ...p, maxGrade: Number(e.target.value) }))} /></div>
                                    </div>
                                    <button type="submit" className="btn-primary mt-4">Create</button>
                                </form>
                            )}
                            <div className="cards-grid">
                                {assignments.map(a => (
                                    <div key={a.id} className="assignment-card" onClick={() => { setSelectedAssignment(a.id); setActiveTab('submissions'); loadSubmissions(a.id); }}>
                                        <div className="assignment-header"><h3 className="assignment-title">{a.title}</h3><span className="badge badge-grade">{a.maxGrade} pts</span></div>
                                        <p className="assignment-desc">{a.description.length > 80 ? a.description.slice(0, 80) + '...' : a.description}</p>
                                        <div className="assignment-footer">
                                            <span className="text-sm text-muted">Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                                            <span className="text-sm text-muted">{a._count?.submissions ?? 0} submissions</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'submissions' && (
                        <div>
                            <div className="flex-between mb-4">
                                <select className="form-input" style={{ width: 'auto' }} value={selectedAssignment} onChange={e => { setSelectedAssignment(e.target.value); loadSubmissions(e.target.value); }}>
                                    <option value="">Select assignment...</option>
                                    {assignments.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                                </select>
                            </div>
                            {loading ? <div className="loading text-center py-12">Loading submissions...</div> : (
                                <div className="table-card">
                                    <table className="data-table">
                                        <thead><tr><th>Student</th><th>Status</th><th>Version</th><th>Submitted</th><th>Grade</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {submissions.length === 0 ? <tr><td colSpan={6} className="text-center text-muted py-8">No submissions found</td></tr> :
                                                submissions.map(s => (
                                                    <tr key={s.id}>
                                                        <td className="font-medium">{s.student.firstName} {s.student.lastName}</td>
                                                        <td>
                                                            <span className={`badge badge-${s.status.toLowerCase()}`}>{s.status}</span>
                                                            {s.isLate && <span className="badge badge-late ml-1">Late</span>}
                                                        </td>
                                                        <td className="text-muted text-sm">v{s.version ?? 1}</td>
                                                        <td className="text-sm text-muted">{new Date(s.submittedAt).toLocaleString()}</td>
                                                        <td>{s.grade ? <span className="font-medium" style={{ color: 'var(--green)' }}>{s.grade.score}</span> : <span className="text-muted">—</span>}</td>
                                                        <td>
                                                            <div className="flex gap-2">
                                                                <button className="btn-ghost btn-sm" style={{ color: 'var(--blue)' }} onClick={() => setViewModal(s)}>👁 View</button>
                                                                <button className="btn-ghost btn-sm" onClick={() => { setReviewModal(s.id); setReviewComment(s.reviewComment?.comment ?? ''); }}>Review</button>
                                                                <button className="btn-accent btn-sm" onClick={() => { setGradeModal({ submissionId: s.id, maxGrade: assignments.find(a => a.id === selectedAssignment)?.maxGrade ?? 100 }); setGradeForm({ score: String(s.grade?.score ?? ''), feedback: s.grade?.feedback ?? '' }); }}>Grade</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'reevals' && (
                        <div>
                            {reEvals.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">🔄</div>
                                    <h3>No re-evaluation requests</h3>
                                    <p>Requests from students will appear here.</p>
                                </div>
                            ) : (
                                <div className="table-card">
                                    <table className="data-table">
                                        <thead><tr><th>Student</th><th>Assignment</th><th>Current Score</th><th>Reason</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {reEvals.map(r => (
                                                <tr key={r.id}>
                                                    <td className="font-medium">{r.student.firstName} {r.student.lastName}</td>
                                                    <td className="text-muted">{r.submission.assignment.title}</td>
                                                    <td><span className="font-medium" style={{ color: 'var(--green)' }}>{r.submission.grade?.score ?? '—'} / {r.submission.assignment.maxGrade}</span></td>
                                                    <td className="text-muted" style={{ maxWidth: '200px' }}>{r.reason.length > 50 ? r.reason.slice(0, 50) + '...' : r.reason}</td>
                                                    <td><span className={`badge badge-reeval-${r.status.toLowerCase()}`}>{r.status}</span></td>
                                                    <td className="text-sm text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                                                    <td>
                                                        {r.status === 'PENDING' ? (
                                                            <button className="btn-primary btn-sm" onClick={() => {
                                                                setReEvalResolveModal(r);
                                                                setReEvalResolveForm({ status: 'APPROVED', staffResponse: '', newScore: String(r.submission.grade?.score ?? ''), newFeedback: r.submission.grade?.feedback ?? '' });
                                                            }}>Resolve</button>
                                                        ) : (
                                                            <span className="text-sm text-muted">{r.staffResponse ?? '—'}</span>
                                                        )}
                                                    </td>
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

            {/* Grade Modal */}
            {gradeModal && (
                <div className="modal-overlay" onClick={() => setGradeModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Grade Submission</h2>
                        <div className="form-group mt-4"><label className="form-label">Score (max {gradeModal.maxGrade})</label><input type="number" className="form-input" min={0} max={gradeModal.maxGrade} value={gradeForm.score} onChange={e => setGradeForm(p => ({ ...p, score: e.target.value }))} /></div>
                        <div className="form-group mt-4"><label className="form-label">Feedback</label><textarea className="form-input" rows={3} value={gradeForm.feedback} onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))} /></div>
                        <div className="modal-actions mt-6"><button className="btn-secondary" onClick={() => setGradeModal(null)}>Cancel</button><button className="btn-primary" onClick={handleGrade}>Save Grade</button></div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {reviewModal && (
                <div className="modal-overlay" onClick={() => setReviewModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Add Review Comment</h2>
                        <div className="form-group mt-4"><label className="form-label">Comment</label><textarea className="form-input" rows={5} value={reviewComment} onChange={e => setReviewComment(e.target.value)} /></div>
                        <div className="modal-actions mt-6"><button className="btn-secondary" onClick={() => setReviewModal(null)}>Cancel</button><button className="btn-primary" onClick={handleReview}>Save Review</button></div>
                    </div>
                </div>
            )}

            {/* Re-eval Resolve Modal */}
            {reEvalResolveModal && (
                <div className="modal-overlay" onClick={() => setReEvalResolveModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 className="modal-title">Resolve Re-evaluation</h2>
                        <p className="text-muted mt-2">Student: <strong style={{ color: 'var(--text)' }}>{reEvalResolveModal.student.firstName} {reEvalResolveModal.student.lastName}</strong></p>
                        <p className="text-muted">Assignment: <strong style={{ color: 'var(--text)' }}>{reEvalResolveModal.submission.assignment.title}</strong></p>
                        <p className="text-muted mt-2">Reason: <em>{reEvalResolveModal.reason}</em></p>

                        <div className="form-group mt-4">
                            <label className="form-label">Decision</label>
                            <select className="form-input" value={reEvalResolveForm.status} onChange={e => setReEvalResolveForm(p => ({ ...p, status: e.target.value as 'APPROVED' | 'REJECTED' }))}>
                                <option value="APPROVED">Approve — Update Grade</option>
                                <option value="REJECTED">Reject — Keep Current Grade</option>
                            </select>
                        </div>

                        {reEvalResolveForm.status === 'APPROVED' && (
                            <div className="form-grid mt-4">
                                <div className="form-group">
                                    <label className="form-label">New Score (max {reEvalResolveModal.submission.assignment.maxGrade})</label>
                                    <input type="number" className="form-input" min={0} max={reEvalResolveModal.submission.assignment.maxGrade} value={reEvalResolveForm.newScore} onChange={e => setReEvalResolveForm(p => ({ ...p, newScore: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Updated Feedback</label>
                                    <input className="form-input" value={reEvalResolveForm.newFeedback} onChange={e => setReEvalResolveForm(p => ({ ...p, newFeedback: e.target.value }))} />
                                </div>
                            </div>
                        )}

                        <div className="form-group mt-4">
                            <label className="form-label">Response to Student</label>
                            <textarea className="form-input" rows={3} placeholder="Optional message to student..." value={reEvalResolveForm.staffResponse} onChange={e => setReEvalResolveForm(p => ({ ...p, staffResponse: e.target.value }))} />
                        </div>

                        <div className="modal-actions mt-6">
                            <button className="btn-secondary" onClick={() => setReEvalResolveModal(null)}>Cancel</button>
                            <button className="btn-primary" onClick={handleResolveReEval}>{reEvalResolveForm.status === 'APPROVED' ? 'Approve & Update' : 'Reject'}</button>
                        </div>
                    </div>
                </div>
            )}
            {/* View Submission Modal */}
            {viewModal && (
                <div className="modal-overlay" onClick={() => setViewModal(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <h2 className="modal-title">📄 View Submission</h2>
                        <div style={{ marginTop: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div>
                                    <span className="text-sm text-muted">Student</span>
                                    <p className="font-medium">{viewModal.student.firstName} {viewModal.student.lastName}</p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted">Email</span>
                                    <p className="font-medium">{viewModal.student.email}</p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted">Status</span>
                                    <p><span className={`badge badge-${viewModal.status.toLowerCase()}`}>{viewModal.status}</span>{viewModal.isLate && <span className="badge badge-late ml-1">Late</span>}</p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted">Version</span>
                                    <p className="font-medium">v{viewModal.version ?? 1}</p>
                                </div>
                                <div>
                                    <span className="text-sm text-muted">Submitted At</span>
                                    <p className="font-medium">{new Date(viewModal.submittedAt).toLocaleString()}</p>
                                </div>
                                {viewModal.grade && (
                                    <div>
                                        <span className="text-sm text-muted">Grade</span>
                                        <p className="font-medium" style={{ color: 'var(--green)' }}>{viewModal.grade.score}</p>
                                    </div>
                                )}
                            </div>

                            {viewModal.content && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <span className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Written Content</span>
                                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', whiteSpace: 'pre-wrap', fontSize: '0.9rem', maxHeight: '300px', overflowY: 'auto' }}>
                                        {viewModal.content}
                                    </div>
                                </div>
                            )}

                            {viewModal.fileUrl && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <span className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Attached File</span>
                                    <a
                                        href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1'}/files/view/${viewModal.fileUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-primary"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                                    >
                                        📄 Open PDF
                                    </a>
                                </div>
                            )}

                            {!viewModal.content && !viewModal.fileUrl && (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                    <p>No content or file was submitted.</p>
                                </div>
                            )}

                            {viewModal.reviewComment && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <span className="text-sm text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Review Comment</span>
                                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', fontStyle: 'italic' }}>
                                        {viewModal.reviewComment.comment}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-actions mt-6">
                            <button className="btn-secondary" onClick={() => setViewModal(null)}>Close</button>
                            <button className="btn-ghost btn-sm" onClick={() => { setReviewModal(viewModal.id); setReviewComment(viewModal.reviewComment?.comment ?? ''); setViewModal(null); }}>✍ Review</button>
                            <button className="btn-accent btn-sm" onClick={() => { setGradeModal({ submissionId: viewModal.id, maxGrade: assignments.find(a => a.id === selectedAssignment)?.maxGrade ?? 100 }); setGradeForm({ score: String(viewModal.grade?.score ?? ''), feedback: viewModal.grade?.feedback ?? '' }); setViewModal(null); }}>🏆 Grade</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StaffDashboard;
