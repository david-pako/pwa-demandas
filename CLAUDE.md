# Regras do projeto: PWA Demandas

App para acompanhar demandas pessoais pelo celular. O dono do projeto quer **aprender no processo**.

## Forma de trabalhar

- **Explicar cada etapa antes de executar**, em português e de forma didática.
- **Commits pequenos**, um por passo lógico, com mensagem em português no imperativo
  (ex.: "Adiciona manifest do PWA").
- Autor dos commits: `david-pako` com e-mail noreply do GitHub (já configurado no repositório local).
  Nunca usar o e-mail pessoal.
- Fim de linha LF (garantido pelo `.gitattributes`).
- A v1 está concluída. A v2 (sincronização) foi pedida em 30/10/2026 e está em andamento.

## Privacidade (repositório público)

- **Nunca colocar tarefas reais no código, em commits ou em arquivos de exemplo.** Usar apenas dados fictícios.
- Backups JSON exportados não devem entrar no repositório (o `.gitignore` bloqueia `backup*.json`,
  `demandas-*.json` e `*.backup.json`).

## Objetivo da v1

- App instalável no Android (manifest + service worker), funcionando offline.
- Dados salvos só no aparelho (IndexedDB ou localStorage), sem servidor.
- HTML, CSS e JavaScript puros: **sem framework e sem etapa de build**.
- Interface em português, pensada para celular (mobile first), com tema claro e escuro.

## Funcionalidades

- Duas abas: **Projetos** e **Pessoal**, com as tarefas agrupadas em seções (grupos).
- Ações: marcar como feito, encerrar sem fazer, reabrir, editar e excluir.
- Campo rápido para anotar uma tarefa nova.
- Resumo no topo: **para fazer**, **aguardando** e **concluídas**.
- Exportar e importar tudo em JSON.

## Modelo de dados

Cada tarefa tem os campos:

| Campo      | Tipo   | Valores / observação                              |
|------------|--------|---------------------------------------------------|
| `aba`      | texto  | `projetos` ou `pessoal`                           |
| `grupo`    | texto  | nome da seção dentro da aba                       |
| `titulo`   | texto  | obrigatório                                       |
| `desc`     | texto  | descrição livre (pode ser vazia)                  |
| `tag`      | texto  | `next`, `wait`, `decide` ou `someday`             |
| `tagTexto` | texto  | rótulo exibido para a tag (pode ser vazio)        |
| `status`   | texto  | `aberto`, `feito` ou `encerrado`                  |
| `ordem`    | número | posição da tarefa dentro do grupo                 |

Formato de exportação/importação: **uma lista (array JSON) de tarefas com os campos acima**.

```json
[
  {
    "aba": "projetos",
    "grupo": "Site novo",
    "titulo": "Revisar textos da página inicial",
    "desc": "",
    "tag": "next",
    "tagTexto": "Próximo",
    "status": "aberto",
    "ordem": 1
  }
]
```

## Decisões técnicas

- **Caminhos sempre relativos** (`./app.js`, `start_url: "./"`), porque o GitHub Pages publica
  em `https://david-pako.github.io/pwa-demandas/` (subpasta, não raiz do domínio).
- Cada tarefa recebe um `id` interno gerado no aparelho. O JSON importado não precisa ter `id`.
- Ao mudar arquivos do app, **incrementar a versão do cache** no `sw.js` para os aparelhos
  receberem a atualização. Arquivo novo do app precisa entrar na lista `ARQUIVOS` do `sw.js`.
- Armazenamento: **localStorage**, chave `demandas.tarefas`. Código separado em `dados.js`
  (leitura, gravação e validação) e `app.js` (tela), usando módulos ES nativos.
- Textos das tarefas entram na tela só com `textContent`, nunca com `innerHTML`.

## Regras de comportamento

- Resumo (soma as duas abas): **para fazer** = abertas com tag diferente de `wait`;
  **aguardando** = abertas com tag `wait`; **concluídas** = status `feito`.
- Tarefas fechadas (`feito` ou `encerrado`) ficam recolhidas no fim de cada grupo.
- O campo rápido cria a tarefa na aba aberta, no grupo **"Entrada"** (exibido sempre primeiro),
  com tag `next` e status `aberto`.
- Ao mudar de aba ou de grupo na edição, a tarefa vai para o fim do grupo novo.
- Importar **substitui** todas as tarefas do aparelho, após confirmação. Se qualquer item for
  inválido, nada é importado e os erros são mostrados. Campos opcionais ausentes recebem padrão.
- Antes de importar, o app guarda uma cópia das tarefas atuais (chave `demandas.antesDaImportacao`)
  e mostra o botão **"Desfazer importação"**. Só o estado anterior à última importação é guardado;
  desfazer restaura a cópia e a apaga.
- O campo de importação não usa `accept`: no Android ele bloqueia arquivos válidos (ex.: JSON salvo como .txt).
- Exportar gera `demandas-AAAA-MM-DD.json` sem o `id` interno.
- Arquivo de exemplo para testar importação: `exemplos/tarefas-exemplo.json` (dados fictícios).

## Publicação

- Repositório: https://github.com/david-pako/pwa-demandas
- Publicado pelo GitHub Pages a partir do ramo `main`, pasta raiz.

## Critérios de pronto (v1)

- Abre no celular, oferece a opção de instalar e funciona em modo avião.
- Importa um JSON no formato acima sem erro.

## v2: sincronização entre aparelhos (em andamento)

Decisões do dono do projeto:

- **Servidor: Firebase** (Firestore + Authentication). Escolhido porque o Firestore já sincroniza
  e funciona offline sozinho; a alternativa considerada foi o Supabase.
- **Login: conta Google.**
- **Login opcional:** sem login, o app continua funcionando só no aparelho (localStorage), como na v1.
  Com login, as tarefas ficam na nuvem e sincronizam entre aparelhos.

Regras técnicas da v2:

- Continua **sem build**: o SDK do Firebase é carregado como módulo ES direto do CDN (gstatic).
- O SDK do Firebase é carregado com `import()` dinâmico, para o app local continuar funcionando
  se ele falhar (ex.: offline na primeira abertura).
- A tela (`app.js`) não sabe onde os dados ficam: fala com um "armazenamento" que tem as mesmas
  operações no modo local e na nuvem (`aoMudar`, `adicionar`, `alterar`, `remover`, `substituirTudo`).
- Na nuvem, cada usuário só lê e escreve em `usuarios/{uid}/tarefas`, garantido pelas regras de
  segurança do Firestore (arquivo `firestore.rules`).
- A configuração do Firebase (apiKey etc.) pode ficar no código público: ela só identifica o projeto.
  Quem protege os dados são as regras de segurança.
- **Privacidade:** com login, as tarefas reais ficam no Firebase (Google), não no repositório.
  A regra de nunca colocar tarefas reais no código continua valendo.
