import { useParams } from 'react-router-dom';
import { Container, Card } from '../components/ui.jsx';

export default function PublicPage() {
  const { slug } = useParams();
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-md">
        <Card className="text-center">
          <h1 className="text-lg font-medium">Pesquisa</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            A página pública de resposta ({slug}) chega na Fase 3.
          </p>
        </Card>
      </div>
    </Container>
  );
}
