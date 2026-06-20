import { Link, useParams } from 'react-router-dom';
import { Container, Card } from '../components/ui.jsx';
import { ArrowLeft } from 'lucide-react';

export default function BuilderPage() {
  const { id } = useParams();
  return (
    <Container className="py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
        <ArrowLeft size={16} /> Voltar
      </Link>
      <Card className="mt-4">
        <h1 className="text-lg font-medium">{id ? 'Editar pesquisa' : 'Nova pesquisa'}</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">O construtor de perguntas chega na Fase 2.</p>
      </Card>
    </Container>
  );
}
