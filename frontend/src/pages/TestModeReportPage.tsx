import { TestModeReportForm } from '../components/TestModeReportForm';

export function TestModeReportPage() {
  return (
    <section className="card market-page market-shell">
      <h3>Reportar Bug no Modo Teste</h3>
      <p className="info-text">
        Use este formulário para informar bugs, erros visuais, problemas de saldo, suspeitas de trapaça ou sugestões do Modo Teste. Nenhum saldo desta tela afeta a Exchange principal.
      </p>
      <TestModeReportForm />
    </section>
  );
}
