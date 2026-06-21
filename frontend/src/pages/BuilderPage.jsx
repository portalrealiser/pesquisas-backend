import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Container, Card, Button, Field, Spinner } from '../components/ui.jsx';
import { api } from '../api.js';
import {
  ArrowLeft, Plus, Trash2, Copy, ChevronUp, ChevronDown,
  CircleDot, ListChecks, Type, AlignLeft, Star, X,
} from 'lucide-react';

const TYPES = [
  { type: 'unica', label: 'Escolha única', icon: CircleDot },
  { type: 'multipla', label: 'Múltipla escolha', icon: ListChecks },
  { type: 'texto_curto', label: 'Texto curto', icon: Type },
  { type: 'texto_longo', label: 'Texto longo', icon: AlignLeft },
  { type: 'escala', label: 'Escala', icon: Star },
];
const typeMeta = (t) => TYPES.find((x) => x.type === t) || TYPES[0];

function newQuestion(type) {
  const q = { _key: crypto.randomUUID(), type, text: '', required: true };
  if (type === 'unica' || type === 'multipla') q.options = ['', ''];
  if (type === 'escala') { q.scale_min = 1; q.scale_max = 5; }
  return q;
}

const inputCls =
  'w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-[var(--color-surface)]';

function QuestionCard({ q, index, total, readOnly, on }) {
  const meta = typeMeta(q.type);
  const Icon = meta.icon;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-muted)]">
          <Icon size={14} /> {meta.label}
        </span>
        {!readOnly && (
          <div className="flex items-center gap-2 text-[var(--color-muted)]">
            <button title="Mover para cima" disabled={index === 0} onClick={() => on.move(q._key, -1)} className="hover:text-[var(--color-ink)] disabled:opacity-30"><ChevronUp size={16} /></button>
            <button title="Mover para baixo" disabled={index === total - 1} onClick={() => on.move(q._key, 1)} className="hover:text-[var(--color-ink)] disabled:opacity-30"><ChevronDown size={16} /></button>
            <button title="Duplicar" onClick={() => on.duplicate(q._key)} className="hover:text-[var(--color-ink)]"><Copy size={16} /></button>
            <button title="Remover" onClick={() => on.remove(q._key)} className="hover:text-red-600"><Trash2 size={16} /></button>
          </div>
        )}
      </div>

      <input className={inputCls} placeholder="Escreva a pergunta" value={q.text} disabled={readOnly}
        onChange={(e) => on.update(q._key, { text: e.target.value })} />

      {(q.type === 'unica' || q.type === 'multipla') && (
        <div className="mt-3 space-y-2">
          {q.options.map((opt, i) => {
            const OptIcon = q.type === 'unica' ? CircleDot : ListChecks;
            return (
              <div key={i} className="flex items-center gap-2">
                <OptIcon size={16} className="shrink-0 text-[var(--color-muted)]" />
                <input className={inputCls + ' py-2'} placeholder={`Opção ${i + 1}`} value={opt} disabled={readOnly}
                  onChange={(e) => on.option(q._key, i, e.target.value)} />
                {!readOnly && q.options.length > 2 && (
                  <button title="Remover opção" onClick={() => on.removeOption(q._key, i)} className="text-[var(--color-muted)] hover:text-red-600"><X size={16} /></button>
                )}
              </div>
            );
          })}
          {!readOnly && (
            <button onClick={() => on.addOption(q._key)} className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800">
              <Plus size={15} /> adicionar opção
            </button>
          )}
        </div>
      )}

      {q.type === 'escala' && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-[var(--color-muted)]">De</span>
          <input type="number" className="w-16 rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-400 disabled:bg-[var(--color-surface)]" value={q.scale_min} disabled={readOnly} onChange={(e) => on.update(q._key, { scale_min: e.target.value })} />
          <span className="text-[var(--color-muted)]">até</span>
          <input type="number" className="w-16 rounded-lg border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-400 disabled:bg-[var(--color-surface)]" value={q.scale_max} disabled={readOnly} onChange={(e) => on.update(q._key, { scale_max: e.target.value })} />
        </div>
      )}

      {!readOnly && (
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <input type="checkbox" checked={q.required} onChange={(e) => on.update(q._key, { required: e.target.checked })} className="accent-[#0F6E56]" />
          Resposta obrigatória
        </label>
      )}
    </Card>
  );
}

export default function BuilderPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [status, setStatus] = useState(null);
  const [loaded, setLoaded] = useState(!id);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const readOnly = status && status !== 'rascunho';

  useEffect(() => {
    if (!id) return;
    api.get(`/admin/surveys/${id}`).then((s) => {
      setTitle(s.title);
      setDescription(s.description || '');
      setStatus(s.status);
      setQuestions((s.questions || []).map((q) => ({
        _key: crypto.randomUUID(),
        type: q.type,
        text: q.text,
        required: q.required,
        options: (q.options || []).map((o) => o.text),
        scale_min: q.scale_min ?? 1,
        scale_max: q.scale_max ?? 5,
      })));
      setLoaded(true);
    }).catch((e) => { setError(e.error || 'Erro ao carregar.'); setLoaded(true); });
  }, [id]);

  const on = {
    update: (key, patch) => setQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, ...patch } : q))),
    remove: (key) => setQuestions((qs) => qs.filter((q) => q._key !== key)),
    duplicate: (key) => setQuestions((qs) => {
      const i = qs.findIndex((q) => q._key === key);
      if (i < 0) return qs;
      const copy = { ...qs[i], _key: crypto.randomUUID(), options: qs[i].options ? [...qs[i].options] : undefined };
      const next = [...qs];
      next.splice(i + 1, 0, copy);
      return next;
    }),
    move: (key, dir) => setQuestions((qs) => {
      const i = qs.findIndex((q) => q._key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= qs.length) return qs;
      const next = [...qs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    }),
    option: (key, idx, val) => setQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, options: q.options.map((o, i) => (i === idx ? val : o)) } : q))),
    addOption: (key) => setQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, options: [...q.options, ''] } : q))),
    removeOption: (key, idx) => setQuestions((qs) => qs.map((q) => (q._key === key ? { ...q, options: q.options.filter((_, i) => i !== idx) } : q))),
  };

  const addQuestion = (type) => setQuestions((qs) => [...qs, newQuestion(type)]);

  function validate() {
    if (!title.trim()) return 'Dê um título à pesquisa.';
    if (questions.length === 0) return 'Adicione ao menos uma pergunta.';
    for (const q of questions) {
      if (!q.text.trim()) return 'Toda pergunta precisa de um texto.';
      if (q.type === 'unica' || q.type === 'multipla') {
        const opts = q.options.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) return `A pergunta "${q.text.trim() || 'sem título'}" precisa de ao menos 2 opções.`;
      }
      if (q.type === 'escala' && Number(q.scale_max) <= Number(q.scale_min)) {
        return 'Na escala, o valor máximo deve ser maior que o mínimo.';
      }
    }
    return null;
  }

  function buildPayload() {
    return {
      title: title.trim(),
      description: description.trim() || null,
      questions: questions.map((q) => {
        const base = { type: q.type, text: q.text.trim(), required: !!q.required };
        if (q.type === 'unica' || q.type === 'multipla') base.options = q.options.map((o) => o.trim()).filter(Boolean);
        if (q.type === 'escala') { base.scale_min = Number(q.scale_min); base.scale_max = Number(q.scale_max); }
        return base;
      }),
    };
  }

  async function save(publish) {
    setError('');
    if (readOnly) {
      setSaving(true);
      try {
        await api.put(`/admin/surveys/${id}`, { title: title.trim(), description: description.trim() || null });
        navigate('/');
      } catch (e) { setError(e.error || 'Erro ao salvar.'); setSaving(false); }
      return;
    }
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      let surveyId = id;
      if (id) await api.put(`/admin/surveys/${id}`, payload);
      else surveyId = (await api.post('/admin/surveys', payload)).id;
      if (publish && surveyId) await api.post(`/admin/surveys/${surveyId}/publish`);
      navigate('/');
    } catch (e) {
      setError(e.error || 'Erro ao salvar.');
      setSaving(false);
    }
  }

  if (!loaded) {
    return <Container className="py-16"><div className="flex justify-center"><Spinner /></div></Container>;
  }

  return (
    <Container className="py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        <ArrowLeft size={16} /> Voltar
      </Link>

      <h1 className="mt-4 mb-5 text-xl font-medium">{id ? 'Editar pesquisa' : 'Nova pesquisa'}</h1>

      {readOnly && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta pesquisa já foi publicada. Você pode editar o título e a descrição, mas as perguntas ficam bloqueadas para preservar as respostas já coletadas.
        </div>
      )}

      <div className="space-y-4">
        <Field label="Título" placeholder="Ex.: Pesquisa de satisfação" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Field label="Descrição (opcional)" placeholder="Um texto curto explicando a pesquisa" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <p className="mt-6 mb-3 text-sm font-medium">Perguntas</p>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionCard key={q._key} q={q} index={i} total={questions.length} readOnly={readOnly} on={on} />
        ))}
        {questions.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--color-line)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
            Nenhuma pergunta ainda. Adicione abaixo.
          </p>
        )}
      </div>

      {!readOnly && (
        <div className="mt-4">
          <p className="mb-2 text-sm text-[var(--color-muted)]">Adicionar pergunta</p>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button key={t.type} onClick={() => addQuestion(t.type)} className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] transition hover:border-brand-400 hover:text-[var(--color-ink)]">
                <Plus size={13} /> {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        {readOnly ? (
          <Button onClick={() => save(false)} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => save(false)} disabled={saving}>Salvar rascunho</Button>
            <Button onClick={() => save(true)} disabled={saving}>{saving ? 'Salvando...' : 'Publicar'}</Button>
          </>
        )}
      </div>
    </Container>
  );
}
