import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signup, login, getMe } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import TiltCard3D from '../landing/TiltCard3D';
import LandingCanvas3D from '../landing/LandingCanvas3D';
import { ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup({ email, full_name: fullName, password });
      // Auto-login after signup
      const { access_token } = await login({ email, password });
      localStorage.setItem('omni_token', access_token);
      const user = await getMe();
      setAuth(access_token, user);
      navigate('/inbox');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <LandingCanvas3D />

      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-rose-900/20 blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/3 h-96 w-96 rounded-full bg-red-950/20 blur-[140px]" />
      </div>

      <TiltCard3D maxTilt={7} scale={1.01} className="w-full max-w-[440px] z-10">
        <div className="auth-card">
          <div className="auth-logo">
            <div className="auth-logo-mark">Ω</div>
            <span className="auth-logo-text">Omni</span>
          </div>

          <h1 className="auth-title">Create your workspace</h1>
          <p className="auth-subtitle">Unify all your communication channels in seconds</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                type="text"
                placeholder="Alex Vance"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? (
                'Creating workspace…'
              ) : (
                <>
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account?
            <Link to="/login">Sign in</Link>
          </div>
        </div>
      </TiltCard3D>
    </div>
  );
}
