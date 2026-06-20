import { useEffect, useState } from 'react';
import { Container, Card, Button, Badge, Spinner } from '../components/ui.jsx';
import { api } from '../api.js';

export default function DashboardPage() {
  const [health, setHealth] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch((e) => setErr(e.error || 'sem conexão'));
  }, []);

  return (
    <Container className="py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-medium">Minhas pesquisas</h1>
        <Button>+ Nova pesquisa</Button>
      </div>
      <Card>
        <p className="text-sm text-[var(--color-muted)]">
          Fundação do frontend pronta. Status da conexão com a API:
        </p>
        <div className="mt-3 flex items-center gap-3">
          {!health && !err && <Spinner />}
          {health && (
            <>
              <Badge status="publicada" />
              <span className="text-sm">API conectada · schema {health.schema_ativo}</span>
            </>
          )}
          {err && <span className="text-sm text-red-600">Sem conexão: {err}</span>}
        </div>
      </Card>
    </Container>
  );
}
