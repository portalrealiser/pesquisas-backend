import { Link, useParams } from 'react-router-dom';
import { Container, Card } from '../components/ui.jsx';
import { ArrowLeft } from 'lucide-react';

export default function ResultsPage() {
  const { id } = useParams();
  return (
    <Container className="py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <Card className="mt-4">
        <h1 className="text-lg font-medium">Resultados</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Os gráficos da pesquisa #{id} chegam na Fase 4.</p>
      </Card>
    </Container>
  );
}
