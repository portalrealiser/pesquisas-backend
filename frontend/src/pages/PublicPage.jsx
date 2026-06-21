import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { Container, Card, Button, Spinner } from '../components/ui.jsx';
import { api } from '../api.js';
import { Check, CheckCircle2, AlertCircle } from 'lucide-react';

function range(min, max) {
  const r = [];
  for (let n = Number(min); n <= Number(max); n++) r.push(n);
  return r;
}

function OptionRow({ selected, multi, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
        selected ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-[var(--color-line)] hover:border-brand-400'
      }`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center border ${multi ? 'rounded' : 'rounded-full'} ${
          selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-stone-300'
        }`}
      >
        {selected && (multi ? <Check size={13} /> : <span className="h-2 w-2 rounded-full bg-white" />)}
      </span>
      <span>{children}</span>
    </button>
  );
}

function Question({ q, value, onChange }) {
  return (
    <div className="mb-7">
      <p className="mb-3 text-sm font-medium">
        {q.text}
        {q.required && <span className="ml-1 text-brand-600">*</span>}
      </p>

      {q.type === 'unica' && (
        <div className="space-y-2">
          {q.options.map((o) => (
            <OptionRow key={o.id} selected={value === o.id} onClick={() => onChange(o.id)}>
              {o.text}
            </OptionRow>
          ))}
        </div>
      )}

      {q.type === 'multipla' && (
        <div className="space-y-2">
          {q.options.map((o) => {
            const arr = Array.isArray(value) ? value : [];
            const checked = arr.includes(o.id);
            return (
              <OptionRow
                key={o.id}
                multi
                selected={checked}
                onClick={() => onChange(checked ? arr.filter((x) => x !== o.id) : [...arr, o.id])}
              >
                {o.text}
              </OptionRow>
            );
          })}
        </div>
      )}

      {q.type === 'texto_curto' && (
        <input
          className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          placeholder="Sua resposta"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {q.type === 'texto_longo' && (
        <textarea
          rows={4}
          className="w-full resize-y rounded-lg border border-[var(--color-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          placeholder="Sua resposta"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {q.type === 'escala' && (
        <div className="flex flex-wrap gap-2">
          {range(q.scale_min, q.scale_max).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-11 w-11 rounded-lg border text-sm transition ${
                value === n
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-[var(--color-line)] text-[var(--color-muted)] hover:border-brand-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CenteredCard({ icon: Icon, color, title, text }) {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md">
        <Card className="text-center">
          {Icon && (
            <div className="mb-3 flex justify-center">
              <Icon size={40} className={color} />
            </div>
          )}
          <h1 className="text-lg font-medium">{title}</h1>
          {text && <p className="mt-2 text-sm text-[var(--color-muted)]">{text}</p>}
        </Card>
      </div>
    </Container>
  );
}

export default function PublicPage() {
  const { slug } = useParams();
  const [survey, setSurvey] = useState(null);
  const [loadState, setLoadState] = useState('loading'); // loading|ok|notfound|closed|error
  const [answers, setAnswers] = useState({});
  const [fingerprint, setFingerprint] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // null|ok|dup
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/p/${slug}`)
      .then((s) => {
        setSurvey(s);
        setLoadState('ok');
      })
      .catch((e) => {
        if (e.status === 404) setLoadState('notfound');
        else if (e.status === 403) setLoadState('closed');
        else setLoadState('error');
      });
  }, [slug]);

  useEffect(() => {
    let alive = true;
    FingerprintJS.load()
      .then((fp) => fp.get())
      .then((r) => alive && setFingerprint(r.visitorId))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function setAnswer(qid, val) {
    setAnswers((a) => ({ ...a, [qid]: val }));
  }

  function validate() {
    for (const q of survey.questions) {
      if (!q.required) continue;
      const a = answers[q.id];
      const empty =
        a === undefined ||
        a === null ||
        (Array.isArray(a) && a.length === 0) ||
        (typeof a === 'string' && a.trim() === '');
      if (empty) return `A pergunta "${q.text}" é obrigatória.`;
    }
    return null;
  }

  async function submit() {
    setError('');
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/p/${slug}/submit`, { fingerprint, answers });
      setDone('ok');
    } catch (e) {
      if (e.status === 409) setDone('dup');
      else if (e.status === 403) setLoadState('closed');
      else {
        setError(e.error || 'Não foi possível enviar sua resposta.');
        setSubmitting(false);
      }
    }
  }

  if (loadState === 'loading') {
    return (
      <Container className="py-16">
        <div className="flex justify-center">
          <Spinner />
        </div>
      </Container>
    );
  }
  if (loadState === 'notfound')
    return <CenteredCard title="Pesquisa não encontrada" text="O link pode estar incorreto." />;
  if (loadState === 'closed')
    return <CenteredCard title="Pesquisa encerrada" text="Esta pesquisa não está aberta para respostas no momento." />;
  if (loadState === 'error')
    return <CenteredCard icon={AlertCircle} color="text-red-500" title="Algo deu errado" text="Tente novamente em instantes." />;

  if (done === 'ok')
    return <CenteredCard icon={CheckCircle2} color="text-brand-600" title="Resposta enviada!" text="Obrigado por participar." />;
  if (done === 'dup')
    return <CenteredCard icon={Check} color="text-brand-600" title="Você já respondeu" text="Obrigado! Sua resposta a esta pesquisa já foi registrada." />;

  return (
    <Container className="py-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6">
          <h1 className="text-xl font-medium">{survey.title}</h1>
          {survey.description && <p className="mt-1 text-sm text-[var(--color-muted)]">{survey.description}</p>}
          <p className="mt-2 text-xs text-[var(--color-muted)]">Sua resposta é anônima.</p>
        </div>

        <Card>
          {survey.questions.map((q) => (
            <Question key={q.id} q={q} value={answers[q.id]} onChange={(val) => setAnswer(q.id, val)} />
          ))}

          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? 'Enviando...' : 'Enviar resposta'}
          </Button>
        </Card>

        <p className="mt-4 text-center text-xs text-[var(--color-muted)]">Pesquisa anônima · uma resposta por pessoa</p>
      </div>
    </Container>
  );
}
