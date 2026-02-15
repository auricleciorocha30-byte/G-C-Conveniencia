
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, LogIn, Loader2, AlertCircle, ShieldCheck, Mail, Smartphone } from 'lucide-react';

interface Props {
  onLoginSuccess: (user: any) => void;
}

export default function LoginPage({ onLoginSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          throw new Error('E-mail ou senha incorretos.');
        }
        throw authError;
      }

      if (authData.user) {
        onLoginSuccess({
          id: authData.user.id,
          name: authData.user.email?.split('@')[0] || 'Administrador',
          role: 'GERENTE'
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fff5e1] p-6 relative overflow-hidden text-zinc-900">
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-orange-500 rounded-full opacity-10 blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary rounded-full opacity-10 blur-3xl"></div>

      <div className="bg-white w-full max-w-md rounded-[3rem] p-8 md:p-12 shadow-2xl relative z-10 border border-orange-100">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-500 text-secondary">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-brand font-bold text-primary">Painel Admin</h1>
          <p className="text-sm text-gray-400 mt-2">Acesso Exclusivo Supabase Auth</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl flex items-center gap-3 text-sm animate-shake">
            <AlertCircle size={18} />
            <span className="flex-1 font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-4 tracking-widest">E-mail</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-secondary/20 focus:bg-white transition-all text-gray-700 font-medium"
                placeholder="seu@email.com"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase ml-4 tracking-widest">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-secondary/20 focus:bg-white transition-all text-gray-700"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-black/10 disabled:opacity-50 mt-4 group"
          >
            {loading ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                Entrar no Sistema
                <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-gray-100 text-center space-y-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Desenvolvido por D.I</p>
          <p className="text-[9px] text-gray-400 font-bold">Cnpj: 23.159.325/0001-17</p>
          <a 
            href="https://wa.me/5585987582159" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 text-[10px] font-bold text-secondary hover:text-orange-600 transition-colors"
          >
            <Smartphone size={12} /> Suporte: WhatsApp 85987582159
          </a>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}
