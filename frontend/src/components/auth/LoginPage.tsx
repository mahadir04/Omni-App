import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login, getMe } from '../../api/auth';
import { useAuthStore } from '../../store/authStore';
import TiltCard3D from '../landing/TiltCard3D';
import LandingCanvas3D from '../landing/LandingCanvas3D';
import { ArrowRight } from 'lucide-react';

export default function LoginPage() {
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
      const { access_token } = await login({ email, password });
      localStorage.setItem('omni_token', access_token);
      const user = await getMe();
      setAuth(access_token, user);
      navigate('/inbox');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
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

          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to your unified communications workspace</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="relative flex items-center">
                <input
                  className="form-input"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <div className="flex items-center justify-between">
                <label className="form-label">Password</label>
              </div>
              <div className="relative flex items-center">
                <input
                  className="form-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? (
                'Signing in…'
              ) : (
                <>
                  Sign in to Workspace <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            Don't have an account?
            <Link to="/signup">Create account</Link>
          </div>
        </div>
      </TiltCard3D>
    </div>
  );
}
