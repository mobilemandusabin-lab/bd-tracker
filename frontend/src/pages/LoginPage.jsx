import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login } from '../store/authSlice';
import { Mail, Lock, Loader2, ShieldCheck } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (token) navigate('/');
  }, [token, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(login({ email, password }));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row items-stretch justify-center">
      {/* Brand Section */}
      <div className="hidden md:flex md:w-1/2 bg-red-600 items-center justify-center p-12">
        <div className="text-white max-w-lg space-y-6">
          <div className="bg-white/10 w-20 h-20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20">
            <ShieldCheck size={48} className="text-white" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight">
            BD Tracker <span className="text-red-200">CRM</span>
          </h1>
          <p className="text-xl text-red-50 leading-relaxed font-medium">
            The ultimate vendor acquisition and tracking platform for E-commerce success. 
            Streamline your workflow with event-driven automation.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-8">
            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-bold">10k+</div>
              <div className="text-red-100 text-sm">Vendors Tracked</div>
            </div>
            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
              <div className="text-2xl font-bold">99%</div>
              <div className="text-red-100 text-sm">Activation Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center md:text-left space-y-2">
            <h2 className="text-3xl font-bold text-slate-900">Welcome Back</h2>
            <p className="text-slate-500 font-medium">Log in to your account to continue</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 animate-in fade-in slide-in-from-top-4 duration-300">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 block">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-red-600 transition-colors" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 focus:bg-white focus:border-transparent outline-none transition-all font-medium text-slate-800"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700 block">Password</label>
                <a href="#" className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline">Forgot?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-red-600 transition-colors" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-600 focus:bg-white focus:border-transparent outline-none transition-all font-medium text-slate-800"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 py-2">
              <input type="checkbox" id="remember" className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500" />
              <label htmlFor="remember" className="text-sm text-slate-600 font-medium">Remember me for 30 days</label>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-xl shadow-red-200 hover:shadow-red-300 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Login Securely'}
            </button>
          </form>

          <div className="pt-8 text-center">
            <p className="text-slate-500 text-sm font-medium">
              Need assistance? <a href="mailto:support@bdtracker.com" className="text-red-600 font-bold hover:underline">Contact System Admin</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
