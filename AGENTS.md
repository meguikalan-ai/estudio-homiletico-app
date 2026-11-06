# Diretrizes de Codificação & Geração de Conteúdo

Este arquivo contém instruções personalizadas para o comportamento da IA neste projeto, orientando a geração e refinamento de sermões.

---

## Ajuste do Estilo Isaltino Gomes

O estilo de escrita e pregação inspirado no pastor **Isaltino Gomes Coelho Filho** deve seguir parâmetros altamente específicos de sobriedade, inteligência e humanidade oral.

### O que o Estilo NÃO deve fazer:
1. **Não soar dogmático-acadêmico:** Não deve parecer um tratado de teologia sistemática denso ou uma aula formal;
2. **Não usar rebuscamento artificial de IA:** Remova o vocabulário "barroco", complexo e excessivamente floreado com o qual modelos de linguagem costumam marchar para demonstrar solenidade fictícia;
3. **Não exagerar na "densidade calvinista ou reformada" explícita:** Embora a base teológica seja sólida, ela deve emergir organicamente da exposição do texto bíblico em vez de parecer um manifesto polemista doutrinário;
4. **Sem sentimentalismo ou nostalgia denominacional barata:** Evite pieguismo e sentimentalismos dramáticos ou nostálgicos artificiais em relação à tradição batista (ex: uso forçado e dramático de menções ao Cantor Cristão apenas por ambientação);
5. **Reduzir drasticamente o uso de adjetivos espirituais cheios:** Evite o excesso de palavras como *"glorioso", "bendito", "profunda reverência", "santa e pura", "celestial", "impenetrável"* e afins. Prefira a sobriedade;
6. **Evitar parágrafos "roboticamente perfeitos":** No mundo real, a pregação respira, conversa e quebra de ritmo. O sermão não deve soar como um artigo acadêmico perfeitamente revisado em termos mecânicos.

### O que o Estilo DEVE priorizar:
1. **Ritmo de Conversa Sábia (Naturalidade Oral):** Frases mais curtas, pausas humanas, observações pastorais espontâneas e diálogos simples que façam a mensagem soar pregada presencialmente por um pastor experiente;
2. **Sobriedade Estética:** Uma linguagem limpa, direta, econômica, mas calorosa e fidedigna. Comovente sem ser dramática;
3. **Fidelidade e Exegese Prática:** A teologia emerge de forma espontânea do texto sagrado, guiada pela simplicidade profunda;
4. **Apelo Pastoral Sóbrio e Contido:** Em vez de clichês evangelísticos longos, faça convites diretos, reais, desafiadores e curtos (ex: *"Examine honestamente seu coração diante de Deus: que tipo de solo você tem sido para a semente da Palavra?"*).

---

## Processo de Aperfeiçoamento Incremental (Aperfeiçoar com IA)

Ao reescrever partes do sermão em resposta a críticas do Seminário:
- Altere **apenas o trecho diretamente relacionado** à melhoria;
- Preserve rigorosamente o estilo de pregação ativo (especialmente nos critérios de sobriedade e tom oral de Isaltino) e as amarras teológicas batistas;
- Retorne as outras partes do sermão **absolutamente idênticas** e intocadas para preservar o fluxo original de pregação.

---

## Preservação da Biblioteca de Sermões

- **Mandato Crítico:** Quando o sistema fizer algum processo, refinamento, reestruturação de código ou atualização de funcionalidades, **mantenha integralmente e preserve intacta a estrutura e os arquivos de dados da Biblioteca** do usuário.
- O histórico de sermões em `localStorage` (chave `pastoral_sermons`) e suas estruturas de campos (`Sermon` types) devem permanecer retrocompatíveis.
- Nunca limpe, resete ou corrompa os dados armazenados na Biblioteca do usuário em atualizações subsequentes.
