import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Field } from '../components/ui.jsx';
import { api } from '../api.js';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/admin/login', { password });
      navigate('/');
    } catch (err) {
      setError(err.error || 'Não foi possível entrar.');
      setLoading(false);
    }
  }

  return (
    <Container className="py-16">
      <div className="mx-auto max-w-sm">
        <Card>
          <h1 className="mb-1 text-lg font-medium">Entrar no painel</h1>
          <p className="mb-5 text-sm text-[var(--color-muted)]">Acesso restrito ao administrador.</p>
          <form onSubmit={submit}>
            <Field
              label="Senha"
              type="password"
              placeholder="Sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" className="mt-4 w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </Card>
      </div>
    </Container>
  );
}
