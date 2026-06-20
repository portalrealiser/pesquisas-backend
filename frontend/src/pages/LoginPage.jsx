import { Container, Card, Button, Field } from '../components/ui.jsx';

export default function LoginPage() {
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-sm">
        <Card>
          <h1 className="mb-1 text-lg font-medium">Entrar no painel</h1>
          <p className="mb-5 text-sm text-[var(--color-muted)]">Acesso restrito ao administrador.</p>
          <Field label="Senha" type="password" placeholder="Sua senha" />
          <Button className="mt-4 w-full">Entrar</Button>
        </Card>
      </div>
    </Container>
  );
}
