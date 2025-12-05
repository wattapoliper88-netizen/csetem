import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { forgotPassword } from '../api/auth';
import { Link } from 'react-router-dom';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation((email: string) => forgotPassword(email), {
    onSuccess: () => {
      setMessage('Az új jelszót elküldtük az email címedre!');
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Hiba történt a kérés során');
      setMessage('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    mutation.mutate(email);
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
        className="bg-transparent backdrop-blur-sm border border-white/10 shadow-2xl rounded-2xl px-8 pt-8 pb-8 w-full max-w-md relative z-10"
        onSubmit={handleSubmit}
      >
        <h1 className="text-3xl font-bold mb-8 text-center text-cyan-400 tracking-wide drop-shadow-lg">Elfelejtett jelszó</h1>
        
        {error && (
          <div className="mb-6 p-3 bg-red-900/30 border border-red-500/50 text-red-200 rounded-lg text-sm backdrop-blur-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 p-3 bg-green-900/30 border border-green-500/50 text-green-200 rounded-lg text-sm backdrop-blur-sm">
            {message}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-cyan-300 text-sm font-semibold mb-2 ml-1">Email cím</label>
          <input
            type="email"
            required
            className="shadow-inner appearance-none border border-gray-700 rounded-xl w-full py-3 px-4 bg-gray-950/50 text-cyan-100 leading-tight focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all duration-300 placeholder-gray-600"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pelda@email.com"
          />
        </div>

        <div className="flex items-center justify-between mb-6">
          <button
            className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl focus:outline-none focus:shadow-outline transform transition-all duration-200 hover:scale-[1.02] shadow-lg hover:shadow-cyan-500/20"
            type="submit"
            disabled={mutation.isLoading}
          >
            {mutation.isLoading ? 'Küldés...' : 'Új jelszó küldése'}
          </button>
        </div>

        <div className="text-center mt-6">
          <Link to="/login" className="inline-block align-baseline font-bold text-sm text-cyan-400 hover:text-cyan-300 transition-colors duration-200">
            Vissza a bejelentkezéshez
          </Link>
        </div>
      </form>
    </div>
  );
};
