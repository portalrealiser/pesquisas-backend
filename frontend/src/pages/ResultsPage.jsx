import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Container, Card, Button, Badge, Spinner } from '../components/ui.jsx';
import { api } from '../api.js';
import { ArrowLeft, Download, RotateCw } from 'lucide-react';

const BRAND = '#0F6E56';

function OptionBars({ options, total }) {
  const max = Math.max(1, ...options.map((o) => o.votes));
  return (
    <div className="space-y-3">
      {options.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        const w = Math.round((o.votes / max) * 100);
        return (
          <div key={o.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{o.text}</span>
              <span className="shrink-0 text-[var(--color-muted)]">
                {o.votes} {o.votes === 1 ? 'voto' : 'votos'} · {pct}%
              </span>
            </div>
            <div className="mt-1.5 h-2.5 w-full rounded-full bg-stone-100">
              <div className="h-2.5 rounded-full bg-brand-600 transition-all" style={{ width: `${w}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScaleChart({ q }) {
  const data = [];
  const map = {};
  for (const d of q.distribution || []) map[d.valor] = d.n;
  for (let v = q.scale_min; v <= q.scale_max; v++) data.push({ valor: String(v), n: map[v] || 0 });
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-brand-700">{q.average ?? '—'}</span>
        <span className="text-sm text-[var(--color-muted)]">média (de {q.scale_min} a {q.scale_max})</span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <XAxis dataKey="valor" tickLine={false} axisLine={false} fontSize={12} stroke="#8a8a83" />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} stroke="#8a8a83" width={36} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} labelFormatter={(v) => `Nota ${v}`} formatter={(v) => [v, 'respostas']} />
          <Bar dataKey="n" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={BRAND} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TextAnswers({ answers }) {
  if (!answers || answers.length === 0)
    return <p className="text-sm text-[var(--color-muted)]">Nenhuma resposta de texto.</p>;
  return (
    <div className="max-h-72 space-y-2 overflow-auto pr-1">
      {answers.map((t, i) => (
        <div key={i} className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm">
          {t}
        </div>
      ))}
    </div>
  );
}

function countLabel(q) {
  if (q.type === 'unica' || q.type === 'multipla')
    return q.options.reduce((s, o) => s + o.votes, 0);
  if (q.type === 'escala')
    return (q.distribution || []).reduce((s, d) => s + d.n, 0);
  return (q.answers || []).length;
}

export default function ResultsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  function load() {
    setError('');
    api.get(`/admin/surveys/${id}/results`).then(setData).catch((e) => {
      if (e.status === 401) navigate('/login');
      else setError(e.error || 'Erro ao carregar os resultados.');
    });
  }
  useEffect(load, [id]);

  if (!data && !error) {
    return <Container className="py-16"><div className="flex justify-center"><Spinner /></div></Container>;
  }
  if (error) {
    return (
      <Container className="py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"><ArrowLeft size={16} /> Voltar</Link>
        <Card className="mt-4"><p className="text-sm text-red-600">{error}</p></Card>
      </Container>
    );
  }

  const { survey, total, questions } = data;

  return (
    <Container className="py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"><ArrowLeft size={16} /> Voltar</Link>

      <div className="mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-medium">{survey.title}</h1>
            <Badge status={survey.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {total} {total === 1 ? 'resposta' : 'respostas'} no total
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={load} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"><RotateCw size={15} /> Atualizar</button>
          <a href={`/api/admin/surveys/${id}/results.csv`} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"><Download size={15} /> CSV</a>
        </div>
      </div>

      {total === 0 ? (
        <Card className="text-center">
          <p>Ainda não há respostas.</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Compartilhe o link da pesquisa para começar a receber respostas.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <Card key={q.id}>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <p className="font-medium">{q.text}</p>
                <span className="shrink-0 text-xs text-[var(--color-muted)]">{countLabel(q)} resp.</span>
              </div>
              {(q.type === 'unica' || q.type === 'multipla') && <OptionBars options={q.options} total={total} />}
              {q.type === 'escala' && <ScaleChart q={q} />}
              {(q.type === 'texto_curto' || q.type === 'texto_longo') && <TextAnswers answers={q.answers} />}
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}
