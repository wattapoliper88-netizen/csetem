import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { login } from '../api/auth';
import { useNavigate } from 'react-router-dom';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const mutation = useMutation(login, {
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken);
      navigate('/chat');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Login failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate(form);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden">
      {/* Background Video GIF */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/assets/video.gif" 
          alt="Background" 
          className="w-full h-full object-cover opacity-40" 
        />
        {/* Overlay to ensure text readability */}
        <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-[2px]"></div>
      </div>

      <form
        className="bg-gray-900/20 backdrop-blur-xl border border-white/10 shadow-2xl rounded-2xl px-8 pt-8 pb-8 w-full max-w-md relative z-10"
        onSubmit={handleSubmit}
      >
        <h1 className="text-3xl font-bold mb-8 text-center text-cyan-400 tracking-wide drop-shadow-lg">Bejelentkezés</h1>
        
        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 text-red-200 rounded-lg text-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-cyan-300 text-sm font-semibold mb-2 ml-1">Felhasználónév</label>
          <input
            type="text"
            required
            className="shadow-inner appearance-none border border-gray-700 rounded-xl w-full py-3 px-4 bg-gray-950/50 text-cyan-100 leading-tight focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-300 placeholder-gray-600"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="Írd be a felhasználóneved"
          />
        </div>

        <div className="mb-8">
          <label className="block text-cyan-300 text-sm font-semibold mb-2 ml-1">Jelszó</label>
          <input
            type="password"
            required
            minLength={8}
            className="shadow-inner appearance-none border border-gray-700 rounded-xl w-full py-3 px-4 bg-gray-950/50 text-cyan-100 leading-tight focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-300 placeholder-gray-600"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isLoading}
          className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-cyan-900/50 focus:outline-none focus:shadow-outline disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] animate-pulse"
        >
          {mutation.isLoading ? 'Folyamatban...' : 'Bejelentkezés'}
        </button>

        <p className="mt-6 text-center text-sm text-gray-400">
          Nincs még fiókod?{' '}
          <a href="/register" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors duration-200">
            Regisztráció
          </a>
        </p>
      </form>
    </div>
  );
};
