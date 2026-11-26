import { useNavigate } from 'react-router-dom'
import { BackButton } from '../components/ui'

/** E-mail de contato do responsável pelos dados (LGPD). */
const CONTACT_EMAIL = 'contato@dietaetreino.agenciapaulacavalcante.com.br'

/**
 * Texto-base de Termos e Privacidade.
 * ⚠️ Deve ser revisado por um profissional antes da publicação.
 */
export function TermsPage() {
  const navigate = useNavigate()
  return (
    <div className="safe-top mx-auto max-w-lg px-5 pt-6 pb-10">
      <div className="mb-3"><BackButton onClick={() => navigate(-1)} /></div>
      <h1 className="mb-4 text-2xl font-bold">Termos de Uso e Privacidade</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted">
        <p className="rounded-2xl bg-soft p-3 text-xs">Última atualização: novembro de 2026. Ao criar sua conta, você concorda com estes termos.</p>

        <h2 className="pt-2 font-semibold text-ink">1. O que é o app</h2>
        <p>
          O Dieta & Treino é uma ferramenta gratuita de registro pessoal de alimentação, água, peso e treinos. As informações (como calorias, macros e gasto
          estimado no treino) são <strong>estimativas</strong> e <strong>não substituem</strong> orientação de nutricionista, médico ou profissional de
          educação física. Procure um profissional antes de mudanças importantes de dieta ou treino.
        </p>

        <h2 className="pt-2 font-semibold text-ink">2. Dados que coletamos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Conta:</strong> nome, e-mail e senha (guardada de forma criptografada, nunca em texto).</li>
          <li><strong>Saúde e hábitos</strong> (dados pessoais sensíveis pela LGPD): metas, alimentos registrados, água, peso, fichas e treinos realizados, gasto calórico estimado.</li>
          <li><strong>Fotos de check-in</strong>, se você optar por enviar.</li>
          <li>Preferências do app (tema, metas, refeições). Não coletamos localização, contatos nem dados de outros apps.</li>
        </ul>

        <h2 className="pt-2 font-semibold text-ink">3. Para que usamos e base legal</h2>
        <p>
          Usamos seus dados <strong>somente para fazer o app funcionar para você</strong>: mostrar seu dia, seu histórico e seus gráficos. A base legal é o
          seu <strong>consentimento</strong> (LGPD, art. 11, I), dado ao aceitar estes termos, e a execução do serviço que você solicitou. Não vendemos,
          não alugamos e não compartilhamos seus dados com anunciantes ou terceiros.
        </p>

        <h2 className="pt-2 font-semibold text-ink">4. Onde ficam e quem acessa</h2>
        <p>
          Os dados ficam em servidor no Brasil contratado pelo app, com acesso protegido. As fotos ficam fora de qualquer área pública, sem metadados de
          localização, e só abrem por link temporário para a própria dona da conta. Buscas de produtos por nome ou código de barras são consultadas na Open
          Food Facts sem enviar dados seus.
        </p>

        <h2 className="pt-2 font-semibold text-ink">5. Por quanto tempo guardamos</h2>
        <p>Enquanto sua conta existir. Ao excluir a conta, todos os dados e fotos são apagados definitivamente do servidor.</p>

        <h2 className="pt-2 font-semibold text-ink">6. Seus direitos (LGPD, art. 18)</h2>
        <p>
          Você pode, a qualquer momento: acessar e corrigir seus dados (em Ajustes), revogar o consentimento e <strong>excluir a conta e todas as
          informações</strong> (Ajustes → Excluir conta), além de pedir informações sobre o tratamento dos seus dados{CONTACT_EMAIL ? <> pelo e-mail <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold break-all text-primary">{CONTACT_EMAIL}</a></> : null}.
        </p>

        <h2 className="pt-2 font-semibold text-ink">7. Segurança</h2>
        <p>
          Conexão criptografada (HTTPS), senhas com hash, proteção contra tentativas repetidas de login e links de foto que expiram. Nenhum sistema é 100%
          infalível; em caso de incidente relevante, os usuários serão avisados.
        </p>

        <h2 className="pt-2 font-semibold text-ink">8. Idade mínima</h2>
        <p>O app é destinado a maiores de 18 anos. Menores só devem usar com acompanhamento e consentimento dos responsáveis.</p>

        <h2 className="pt-2 font-semibold text-ink">9. Mudanças nestes termos</h2>
        <p>Se estes termos mudarem de forma relevante, avisaremos no app antes de a mudança valer.</p>

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
