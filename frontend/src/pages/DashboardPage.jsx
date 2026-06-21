import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Button, Badge, Spinner } from '../components/ui.jsx';
import { api } from '../api.js';
import {
  Plus, BarChart3, Link2, Pencil, Play, Download, Square, RotateCcw, Trash2, LogOut, Check,
} from 'lucide-react';

function Action({ icon: Icon, label, onClick, href, title, danger }) {
  const cls =
    `inline-flex items-center gap-1.5 py-1 text-sm transition ${
      danger ? 'text-[var(--color-muted)] hover:text-red-600' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
    }`;
  if (href) {
    return (
      <a href={href} className={cls} title={title}>
        <Icon size={17} /> {label}
      </a>
    );
  }
  return (
    <button onClick={onClick} className={cls} title={title} aria-label={title || label}>
      <Icon size={17} /> {label}
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
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium break-words">{s.title}</span>
            <Badge status={s.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {s.status === 'rascunho'
              ? 'ainda não publicada'
              : `${s.responses} ${s.responses === 1 ? 'resposta' : 'respostas'}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--color-line)] pt-3">
        {s.status === 'rascunho' && (
          <>
            <Action icon={Pencil} label="Editar" onClick={() => navigate(`/pesquisa/${s.id}`)} />
            <Action icon={Play} label="Publicar" onClick={() => setStatus('publish')} />
          </>
        )}
        {s.status === 'publicada' && (
          <>
            <Action icon={BarChart3} label="Resultados" onClick={() => navigate(`/resultados/${s.id}`)} />
            <Action icon={copied ? Check : Link2} label={copied ? 'Copiado!' : 'Copiar link'} onClick={copyLink} />
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
        <Action icon={Trash2} label="Excluir" onClick={remove} title="Excluir" danger />
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
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-medium">Minhas pesquisas</h1>
        <button
          onClick={logout}
          className="shrink-0 rounded-lg p-1 text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
          title="Sair"
          aria-label="Sair"
        >
          <LogOut size={20} />
        </button>
      </div>

      {!surveys && !error && (
        <div className="flex justify-center py-12"><Spinner /></div>
      )}
      {error && (
        <Card><p className="text-sm text-red-600">{error}</p></Card>
      )}

      {surveys && surveys.length === 0 && (
        <Card className="text-center">
          <p>Você ainda não criou nenhuma pesquisa.</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Crie a primeira e compartilhe o link pra começar a receber respostas.
          </p>
          <Button className="mt-5 w-full py-3 sm:w-auto sm:py-2.5" onClick={() => navigate('/pesquisa/nova')}>
            <Plus size={18} /> Criar primeira pesquisa
          </Button>
        </Card>
      )}

      {surveys && surveys.length > 0 && (
        <>
          <Button
            className="mb-4 w-full py-3 sm:w-auto sm:py-2.5"
            onClick={() => navigate('/pesquisa/nova')}
          >
            <Plus size={18} /> Nova pesquisa
          </Button>
          <div className="flex flex-col gap-3">
            {surveys.map((s) => <SurveyRow key={s.id} s={s} onChange={load} />)}
          </div>
        </>
      )}
    </Container>
  );
}
