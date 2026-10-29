# Regras do projeto: PWA Demandas

App para acompanhar demandas pessoais pelo celular. O dono do projeto quer **aprender no processo**.

## Forma de trabalhar

- **Explicar cada etapa antes de executar**, em português e de forma didática.
- **Commits pequenos**, um por passo lógico, com mensagem em português no imperativo
  (ex.: "Adiciona manifest do PWA").
- Autor dos commits: `david-pako` com e-mail noreply do GitHub (já configurado no repositório local).
  Nunca usar o e-mail pessoal.
- Fim de linha LF (garantido pelo `.gitattributes`).
- Não implementar nada da v2 sem pedido explícito.

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
  receberem a atualização.

## Publicação

- Repositório: https://github.com/david-pako/pwa-demandas
- Publicado pelo GitHub Pages a partir do ramo `main`, pasta raiz.

## Critérios de pronto (v1)

- Abre no celular, oferece a opção de instalar e funciona em modo avião.
- Importa um JSON no formato acima sem erro.

## Fora do escopo (v2, não fazer agora)

- Sincronizar entre aparelhos com servidor e login.
