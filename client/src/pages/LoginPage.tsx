import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { authApi } from '../api/client';
import { useAuthStore } from '../store/auth.store';
import type { AuthUser } from '../store/auth.store';

type AuthMode = 'login' | 'register';

interface AuthForm {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
}

const DEMO_CREDENTIALS = [
    { role: 'Admin', email: 'admin@saars.io', password: 'Admin@2024!' },
    { role: 'Staff', email: 'dr.smith@saars.io', password: 'Staff@2024!' },
    { role: 'Student', email: 'student1@saars.io', password: 'Student@2024!' },
];

const AuthPage: React.FC = () => {
    const navigate = useNavigate();
    const { setAuth } = useAuthStore();

    const [mode, setMode] = useState<AuthMode>('login');
    const [loading, setLoading] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<AuthForm>();

    const onSubmit = async (data: AuthForm) => {
        setLoading(true);
        try {
            const res =
                mode === 'login'
                    ? await authApi.login(data)
                    : await authApi.register(data);

            const { user, accessToken, refreshToken } = res.data.data;

            setAuth(user as AuthUser, accessToken, refreshToken);

            toast.success(
                mode === 'login'
                    ? `Welcome back, ${user.firstName}!`
                    : `Account created successfully!`
            );

            const role = user.role as string;

            if (role === 'ADMIN') navigate('/admin');
            else if (role === 'STAFF') navigate('/staff');
            else navigate('/student');
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data
                    ?.message ?? 'Something went wrong';

            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const fillCredentials = (email: string, password: string) => {
        setValue('email', email);
        setValue('password', password);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="logo-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <span className="logo-text">SAARS</span>
                </div>

                <h1 className="auth-title">
                    {mode === 'login' ? 'Welcome back' : 'Create account'}
                </h1>
                <p className="auth-subtitle">
                    {mode === 'login'
                        ? 'Sign in to your academic portal'
                        : 'Register for a new account'}
                </p>

                <form onSubmit={handleSubmit(onSubmit)} className="auth-form">

                    {mode === 'register' && (
                        <>
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input
                                    {...register('firstName', { required: 'First name required' })}
                                    className={`form-input ${errors.firstName ? 'error' : ''}`}
                                    placeholder="John"
                                />
                                {errors.firstName && (
                                    <span className="form-error">{errors.firstName.message}</span>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input
                                    {...register('lastName', { required: 'Last name required' })}
                                    className={`form-input ${errors.lastName ? 'error' : ''}`}
                                    placeholder="Doe"
                                />
                                {errors.lastName && (
                                    <span className="form-error">{errors.lastName.message}</span>
                                )}
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <input
                            {...register('email', {
                                required: 'Email required',
                                pattern: {
                                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                    message: 'Invalid email format',
                                },
                            })}
                            type="email"
                            className={`form-input ${errors.email ? 'error' : ''}`}
                            placeholder="you@saars.io"
                        />
                        {errors.email && (
                            <span className="form-error">{errors.email.message}</span>
                        )}
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            {...register('password', {
                                required: 'Password required',
                                minLength: {
                                    value: 6,
                                    message: 'Minimum 6 characters',
                                },
                            })}
                            type="password"
                            className={`form-input ${errors.password ? 'error' : ''}`}
                            placeholder="••••••••"
                        />
                        {errors.password && (
                            <span className="form-error">{errors.password.message}</span>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="btn-primary btn-full"
                        disabled={loading}
                    >
                        {loading
                            ? <><span className="spinner" /> Processing...</>
                            : mode === 'login'
                                ? 'Sign in'
                                : 'Create account'}
                    </button>
                </form>

                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    {mode === 'login' ? (
                        <>
                            Don't have an account?{' '}
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => setMode('register')}
                            >
                                Sign up
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button
                                type="button"
                                className="link-btn"
                                onClick={() => setMode('login')}
                            >
                                Login
                            </button>
                        </>
                    )}
                </div>

                {mode === 'login' && (
                    <div className="auth-demo-creds">
                        <p className="demo-title">Demo Credentials</p>
                        <div className="demo-buttons">
                            {DEMO_CREDENTIALS.map((cred) => (
                                <button
                                    key={cred.role}
                                    type="button"
                                    className="demo-btn"
                                    onClick={() => fillCredentials(cred.email, cred.password)}
                                >
                                    <span className="demo-role">{cred.role}</span>
                                    <span className="demo-email">{cred.email}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default AuthPage;