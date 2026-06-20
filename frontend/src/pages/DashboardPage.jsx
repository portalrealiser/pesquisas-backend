import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Badge, Spinner } from '../components/ui.jsx';
import { api } from '../api.js';
import {
  Plus, BarChart3, Link2, Pencil, Play, Download, Square, RotateCcw, Trash2, LogOut, Check,
} from 'lucide-react';

function Action({ icon: Icon, label, onClick, href, title }) {
  const cls =
    'inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]';
  if (href) {
    return (
      <a href={href} className={cls} title={title}>
        <Icon size={16} /> {label}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls} title={title} aria-label={title || label}>
      <Icon size={16} /> {label}
    </button>
  );
}

function SurveyRow({ s, onChange }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  async function setStatus(action) {
    await api.post(`/admin/surveys/${s.id}/${action}`);
    onChange();
  }
  async function remove() {
    if (!window.confirm(`Excluir a pesquisa "${s.title}"? Isso apaga também as respostas.`)) return;
    await api.del(`/admin/surveys/${s.id}`);
    onChange();
  }
  function copyLink() {
    const url = `${window.location.origin}/r/${s.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-line)] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="font-medium">{s.title}</span>
          <Badge status={s.status} />
        </div>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {s.status === 'rascunho'
            ? 'ainda não publicada'
            : `${s.responses} ${s.responses === 1 ? 'resposta' : 'respostas'}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {s.status === 'rascunho' && (
          <>
            <Action icon={Pencil} label="Editar" onClick={() => navigate(`/pesquisa/${s.id}`)} />
            <Action icon={Play} label="Publicar" onClick={() => setStatus('publish')} />
          </>
        )}
        {s.status === 'publicada' && (
          <>
            <Action icon={BarChart3} label="Resultados" onClick={() => navigate(`/resultados/${s.id}`)} />
            <Action
              icon={copied ? Check : Link2}
              label={copied ? 'Copiado!' : 'Copiar link'}
              onClick={copyLink}
            />
            <Action icon={Square} label="Encerrar" onClick={() => setStatus('close')} />
          </>
        )}
        {s.status === 'encerrada' && (
          <>
            <Action icon={BarChart3} label="Resultados" onClick={() => navigate(`/resultados/${s.id}`)} />
            <Action icon={Download} label="CSV" href={`/api/admin/surveys/${s.id}/results.csv`} />
            <Action icon={RotateCcw} label="Reabrir" onClick={() => setStatus('reopen')} />
          </>
        )}
        <Action icon={Trash2} label="" onClick={remove} title="Excluir" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [surveys, setSurveys] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function load() {
    setError('');
    api.get('/admin/surveys').then(setSurveys).catch((e) => setError(e.error || 'Erro ao carregar.'));
  }
  useEffect(load, []);

  async function logout() {
    try {
      await api.post('/admin/logout');
    } catch {}
    navigate('/login');
  }

  return (
    <Container className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-medium">Minhas pesquisas</h1>
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate('/pesquisa/nova')}>
            <Plus size={16} /> Nova pesquisa
          </Button>
          <button
            onClick={logout}
            className="text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {!surveys && !error && (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      )}
      {error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {surveys && surveys.length === 0 && (
        <Card className="text-center">
          <p>Você ainda não criou nenhuma pesquisa.</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Crie a primeira e compartilhe o link pra começar a receber respostas.
          </p>
          <Button className="mt-4" onClick={() => navigate('/pesquisa/nova')}>
            <Plus size={16} /> Criar primeira pesquisa
          </Button>
        </Card>
      )}

      {surveys && surveys.length > 0 && (
        <div className="flex flex-col gap-3">
          {surveys.map((s) => (
            <SurveyRow key={s.id} s={s} onChange={load} />
          ))}
        </div>
      )}
    </Container>
  );
}
