import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { Spinner } from './ui.jsx';

export default function RequireAuth({ children }) {
  const [state, setState] = useState('checking');
  useEffect(() => {
    let alive = true;
    api
      .get('/admin/me')
      .then(() => alive && setState('ok'))
      .catch(() => alive && setState('no'));
    return () => {
      alive = false;
    };
  }, []);
  if (state === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (state === 'no') return <Navigate to="/login" replace />;
  return children;
}
