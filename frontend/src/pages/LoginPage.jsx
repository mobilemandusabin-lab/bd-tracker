import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../store/authSlice';
import { Mail, Lock, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, token } = useSelector((state) => state.auth);

  useEffect(() => { if (token) navigate('/'); }, [token, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col lg:flex-row">
      {/* Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 via-red-700 to-red-800 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 hero-pattern" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative text-white max-w-lg space-y-8">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
            <ShieldCheck size={36} className="text-white" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
            BD Tracker<br /><span className="text-red-200">CRM Platform</span>
          </h1>
          <p className="text-lg text-red-100 leading-relaxed font-medium">
            The ultimate vendor acquisition and tracking platform for E-commerce success.
            Streamline your workflow with intelligent automation.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <p className="text-3xl font-extrabold">10k+</p>
              <p className="text-red-200 text-sm font-medium mt-1">Vendors Tracked</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/10">
              <p className="text-3xl font-extrabold">99%</p>
              <p className="text-red-200 text-sm font-medium mt-1">Activation Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="max-w-md w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="bg-red-600 p-2 rounded-xl shadow-lg shadow-red-200">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">BD <span className="text-red-600">Tracker</span></h1>
          </div>

          <div className="space-y-2 mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h2>
            <p className="text-slate-500 font-medium">Sign in to continue to your dashboard</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-bold text-slate-700 mb-2 block">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors pointer-events-none" style={{ zIndex: 10 }} size={18} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  style={{ paddingLeft: '2.75rem' }}
                  className="w-full pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all font-medium text-slate-800"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-700">Password</label>
                <a href="#" className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline">Forgot?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors pointer-events-none" style={{ zIndex: 10 }} size={18} />
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  style={{ paddingLeft: '2.75rem' }}
                  className="w-full pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:border-red-300 focus:ring-2 focus:ring-red-100 outline-none transition-all font-medium text-slate-800"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <input type="checkbox" id="remember" className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500" />
              <label htmlFor="remember" className="text-sm text-slate-600 font-medium">Remember me for 30 days</label>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-200 hover:shadow-lg shadow-red-200-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><span>Login Securely</span><ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="pt-8 text-center">
            <p className="text-slate-400 text-sm">
              Need assistance? <a href="mailto:support@bdtracker.com" className="text-red-600 font-bold hover:underline">Contact Admin</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
