import axios, { AxiosError } from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1';

export const apiClient: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
});

// ── Request Interceptor: Attach access token ─────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null) {
    failedQueue.forEach((prom) => {
        if (error) { prom.reject(error); }
        else { prom.resolve(token!); }
    });
    failedQueue = [];
}

// ── Response Interceptor: Silent token refresh ────────────────────────
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return apiClient(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refreshToken');
            if (!refreshToken) {
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(error);
            }

            try {
                const res = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
                const { accessToken, refreshToken: newRefresh } = res.data.data;

                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('refreshToken', newRefresh);

                // Update zustand store if possible
                try {
                    const storeData = JSON.parse(localStorage.getItem('saars-auth') ?? '{}');
                    if (storeData.state) {
                        storeData.state.accessToken = accessToken;
                        storeData.state.refreshToken = newRefresh;
                        localStorage.setItem('saars-auth', JSON.stringify(storeData));
                    }
                } catch { /* ignore store sync errors */ }

                processQueue(null, accessToken);
                originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    },
);

// ── API Helpers ───────────────────────────────────────────────────────
export const authApi = {
    login: (data: { email: string; password: string }) => apiClient.post('/auth/login', data),
    register: (data: unknown) => apiClient.post('/auth/register', data),
    logout: (refreshToken: string) => apiClient.post('/auth/logout', { refreshToken }),
    me: () => apiClient.get('/auth/me'),
    getSessions: () => apiClient.get('/auth/sessions'),
    revokeSession: (sessionId: string) => apiClient.delete(`/auth/sessions/${sessionId}`),
    revokeAllSessions: () => apiClient.delete('/auth/sessions'),
};

export const adminApi = {
    getCycles: (params?: Record<string, unknown>) => apiClient.get('/admin/cycles', { params }),
    createCycle: (data: unknown) => apiClient.post('/admin/cycles', data),
    getUsers: (params?: Record<string, unknown>) => apiClient.get('/admin/users', { params }),
    getStats: () => apiClient.get('/admin/stats'),
    assignStudents: (data: { staffId: string; studentIds: string[] }) => apiClient.post('/admin/assign-students', data),
    getStaffStudents: (staffId: string) => apiClient.get(`/admin/staff/${staffId}/students`),
    bulkUpload: (file: File) => {
        const form = new FormData();
        form.append('file', file);
        return apiClient.post('/admin/bulk-upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    getAuditLogs: (params?: Record<string, unknown>) => apiClient.get('/admin/audit-logs', { params }),
    deactivateUser: (id: string) => apiClient.patch(`/admin/users/${id}/deactivate`),
};

export const staffApi = {
    getMyStudents: () => apiClient.get('/staff/my-students'),
    getAssignments: (params?: Record<string, unknown>) => apiClient.get('/staff/assignments', { params }),
    createAssignment: (data: FormData | unknown) => apiClient.post('/staff/assignments', data),
    getSubmissions: (assignmentId: string) => apiClient.get(`/staff/assignments/${assignmentId}/submissions`),
    reviewSubmission: (submissionId: string, comment: string) =>
        apiClient.post(`/staff/submissions/${submissionId}/review`, { comment }),
    gradeSubmission: (submissionId: string, data: { score: number; feedback?: string }) =>
        apiClient.post(`/staff/submissions/${submissionId}/grade`, data),
    getReEvaluations: (params?: Record<string, unknown>) => apiClient.get('/staff/re-evaluations', { params }),
    resolveReEvaluation: (id: string, data: { status: string; staffResponse?: string; newScore?: number; newFeedback?: string }) =>
        apiClient.patch(`/staff/re-evaluations/${id}`, data),
};

export const studentApi = {
    getMyStaff: () => apiClient.get('/student/my-staff'),
    getAssignments: (params?: Record<string, unknown>) => apiClient.get('/student/assignments', { params }),
    submit: (data: { assignmentId: string; content?: string }, file?: File) => {
        if (file) {
            const form = new FormData();
            form.append('assignmentId', data.assignmentId);
            if (data.content) form.append('content', data.content);
            form.append('file', file);
            return apiClient.post('/student/submit', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
        return apiClient.post('/student/submit', data);
    },
    getSubmissions: () => apiClient.get('/student/submissions'),
    getGrades: () => apiClient.get('/student/grades'),
    requestReEval: (data: { submissionId: string; reason: string }) =>
        apiClient.post('/student/re-evaluate', data),
    getReEvaluations: () => apiClient.get('/student/re-evaluations'),
};
