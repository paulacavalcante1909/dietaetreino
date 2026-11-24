import { useNavigate } from 'react-router-dom'

/**
 * Texto-base de Termos e Privacidade.
 * ⚠️ Deve ser revisado por um profissional antes da publicação.
 */
export function TermsPage() {
  const navigate = useNavigate()
  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-6 pb-10">
      <button onClick={() => navigate(-1)} className="mb-3 text-sm font-medium text-primary">
        ← Voltar
      </button>
      <h1 className="mb-4 text-2xl font-bold">Termos de Uso e Privacidade</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        <p>
          O Dieta & Treino é uma ferramenta gratuita de registro pessoal de alimentação e treinos. As informações exibidas não substituem
          orientação de nutricionista, médico ou profissional de educação física.
        </p>
        <h2 className="pt-2 font-semibold text-ink">Dados que coletamos</h2>
        <p>Nome, e-mail, senha (armazenada de forma criptografada), metas, registros de alimentação, água, peso e fichas de treino.</p>
        <h2 className="pt-2 font-semibold text-ink">Como usamos</h2>
        <p>Somente para o funcionamento do app. Não vendemos nem compartilhamos seus dados com terceiros.</p>
        <h2 className="pt-2 font-semibold text-ink">Seus direitos (LGPD)</h2>
        <p>Você pode alterar seus dados ou excluir sua conta e todas as informações a qualquer momento em Ajustes.</p>
        <p>As fotos de check-in são privadas: ficam fora de qualquer área pública, sem dados de localização, e só você pode vê-las.</p>

        <h2 id="fontes" className="pt-2 font-semibold text-ink">Fontes de dados</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Produtos de marca e códigos de barras:{' '}
            <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">
              Open Food Facts
            </a>
            , base colaborativa disponibilizada sob a{' '}
            <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Open Database License (ODbL)
            </a>
            . As informações podem conter erros; confira sempre o rótulo do produto.
          </li>
          <li>
            Alimentos genéricos: Tabela Brasileira de Composição de Alimentos (TACO), 4ª edição — NEPA/UNICAMP. Valores de leite integral e desnatado
            complementados com o USDA FoodData Central.
          </li>
          <li>
            Exercícios e imagens:{' '}
            <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Free Exercise DB
            </a>{' '}
            (domínio público), com nomes traduzidos.
          </li>
        </ul>
      </div>
    </div>
  )
}
