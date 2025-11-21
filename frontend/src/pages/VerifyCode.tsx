import React, { useState } from 'react';
import { useMutation } from 'react-query';
import { verifyCode } from '../api/auth';
import { useLocation, useNavigate } from 'react-router-dom';

export const VerifyCodePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation(verifyCode, {
    onSuccess: (data) => {
      localStorage.setItem('accessToken', data.accessToken);
      navigate('/chat');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Verification failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    mutation.mutate({ email, code });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <form
        className="bg-white shadow-md rounded px-8 pt-6 pb-8 w-full max-w-md"
        onSubmit={handleSubmit}
      >
        <h1 className="text-2xl font-bold mb-6 text-center">Email megerősítés</h1>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <p className="mb-4 text-sm text-gray-600">
          Küldtünk egy 6 jegyű kódot az email címedre. Add meg a kódot az alábbi mezőben.
        </p>

        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2">Email</label>
          <input
            type="email"
            required
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2">6 jegyű kód</label>
          <input
            type="text"
            required
            minLength={6}
            maxLength={6}
            pattern="[0-9]{6}"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 text-center text-2xl tracking-widest leading-tight focus:outline-none focus:shadow-outline"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isLoading}
          className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
        >
          {mutation.isLoading ? 'Ellenőrzés...' : 'Megerősítés'}
        </button>
      </form>
    </div>
  );
};
