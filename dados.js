// Camada de dados: lê e grava as tarefas no localStorage do aparelho.
// Não mexe na tela; quem desenha é o app.js.

const CHAVE = 'demandas.tarefas';

export const ABAS = ['projetos', 'pessoal'];
export const STATUS = ['aberto', 'feito', 'encerrado'];

// Rótulo padrão de cada tag, usado quando a tarefa não tem tagTexto.
export const TAGS = {
  next: 'Próximo',
  wait: 'Aguardando',
  decide: 'Decidir',
  someday: 'Algum dia',
};

// Tarefas fictícias carregadas na primeira abertura (o repositório é público).
const EXEMPLOS = [
  { aba: 'projetos', grupo: 'Site novo', titulo: 'Revisar textos da página inicial', tag: 'next', ordem: 1 },
  { aba: 'projetos', grupo: 'Site novo', titulo: 'Receber fotos do fotógrafo', tag: 'wait', tagTexto: 'Fotógrafo', ordem: 2 },
  { aba: 'projetos', grupo: 'Site novo', titulo: 'Escolher fonte dos títulos', desc: 'Comparar duas opções no celular.', tag: 'decide', ordem: 3 },
  { aba: 'projetos', grupo: 'Relatório mensal', titulo: 'Juntar números do mês', tag: 'next', ordem: 1 },
  { aba: 'projetos', grupo: 'Relatório mensal', titulo: 'Automatizar a planilha', tag: 'someday', ordem: 2 },
  { aba: 'pessoal', grupo: 'Casa', titulo: 'Trocar lâmpada da cozinha', tag: 'next', ordem: 1 },
  { aba: 'pessoal', grupo: 'Casa', titulo: 'Orçamento da pintura', tag: 'wait', tagTexto: 'Pintor', ordem: 2 },
  { aba: 'pessoal', grupo: 'Saúde', titulo: 'Marcar consulta de rotina', tag: 'next', ordem: 1 },
  { aba: 'pessoal', grupo: 'Saúde', titulo: 'Renovar plano da academia', tag: 'next', status: 'feito', ordem: 2 },
];

function novoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Marca de tempo sempre crescente, mesmo para tarefas criadas no mesmo milissegundo
// (ex.: importação). Guarda a ordem de criação, que a nuvem não preserva sozinha.
let ultimaMarca = 0;
export function marcaDeTempo() {
  ultimaMarca = Math.max(Date.now(), ultimaMarca + 1);
  return ultimaMarca;
}

// Cria uma tarefa completa: os campos informados substituem os valores padrão.
export function novaTarefa(campos) {
  return {
    id: novoId(),
    criadoEm: marcaDeTempo(),
    aba: 'projetos',
    grupo: 'Geral',
    titulo: '',
    desc: '',
    tag: 'next',
    tagTexto: '',
    status: 'aberto',
    ordem: 1,
    prazo: '', // data no formato AAAA-MM-DD, ou vazio (sem prazo)
    ...campos,
  };
}

export function carregar() {
  const salvo = localStorage.getItem(CHAVE);
  if (salvo === null) {
    const exemplos = EXEMPLOS.map(novaTarefa);
    salvar(exemplos);
    return exemplos;
  }
  try {
    return JSON.parse(salvo);
  } catch (erro) {
    console.error('Dados salvos corrompidos:', erro);
    return [];
  }
}

export function salvar(tarefas) {
  localStorage.setItem(CHAVE, JSON.stringify(tarefas));
}

// ---------- Armazenamento local ----------
// A tela fala só com estas operações. A versão na nuvem (v2) terá as mesmas,
// então trocar uma pela outra não muda nada no app.js.
// A lista entregue em aoMudar não deve ser alterada diretamente: use as operações.
export function criarArmazenamentoLocal() {
  let tarefas = carregar();
  let avisar = () => {};

  function gravar(novaLista) {
    tarefas = novaLista;
    salvar(tarefas);
    avisar(tarefas);
  }

  return {
    aoMudar(funcao) {
      avisar = funcao;
      funcao(tarefas);
    },
    adicionar(tarefa) {
      gravar([...tarefas, tarefa]);
    },
    alterar(id, campos) {
      gravar(tarefas.map((t) => (t.id === id ? { ...t, ...campos } : t)));
    },
    remover(id) {
      gravar(tarefas.filter((t) => t.id !== id));
    },
    substituirTudo(lista) {
      gravar(lista);
    },
  };
}

// ---------- Cópia de segurança antes de importar ----------
// Guarda só o estado de antes da última importação, para o "Desfazer importação".
const CHAVE_COPIA = 'demandas.antesDaImportacao';

export function guardarCopia(tarefas) {
  localStorage.setItem(CHAVE_COPIA, JSON.stringify({ data: new Date().toISOString(), tarefas }));
}

// Devolve { data, tarefas } ou null se não houver cópia.
export function lerCopia() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_COPIA));
  } catch {
    return null;
  }
}

export function apagarCopia() {
  localStorage.removeItem(CHAVE_COPIA);
}

// ---------- Exportação e importação ----------

// Campos do formato de troca, na ordem em que aparecem no JSON.
export const CAMPOS = ['aba', 'grupo', 'titulo', 'desc', 'tag', 'tagTexto', 'status', 'ordem', 'prazo'];

// Prazo válido: vazio ou uma data real no formato AAAA-MM-DD (ex.: 2026-11-15).
export function prazoValido(prazo) {
  if (prazo === '') return true;
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(prazo)) return false;
  const [ano, mes, dia] = prazo.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
}

// Lista pronta para exportar: só os campos do formato, sem o id interno.
export function paraExportar(tarefas) {
  return tarefas.map((t) => Object.fromEntries(CAMPOS.map((campo) => [campo, t[campo] ?? ''])));
}

const comoTexto = (valor) => (valor === undefined || valor === null ? '' : String(valor).trim());

// Confere um item vindo de um arquivo. Devolve { tarefa } ou { erro }.
function validarTarefa(item, numero) {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    return { erro: `Item ${numero}: não é uma tarefa (esperava um objeto { ... }).` };
  }

  const tarefa = {
    aba: comoTexto(item.aba).toLowerCase(),
    grupo: comoTexto(item.grupo) || 'Geral',
    titulo: comoTexto(item.titulo),
    desc: comoTexto(item.desc),
    tag: comoTexto(item.tag).toLowerCase() || 'next',
    tagTexto: comoTexto(item.tagTexto),
    status: comoTexto(item.status).toLowerCase() || 'aberto',
    ordem: comoTexto(item.ordem) === '' ? numero : Number(item.ordem),
    prazo: comoTexto(item.prazo),
  };

  if (!ABAS.includes(tarefa.aba)) {
    return { erro: `Item ${numero}: aba "${comoTexto(item.aba)}" inválida (use projetos ou pessoal).` };
  }
  if (!tarefa.titulo) {
    return { erro: `Item ${numero}: falta o título.` };
  }
  if (!Object.hasOwn(TAGS, tarefa.tag)) {
    return { erro: `Item ${numero}: tag "${tarefa.tag}" inválida (use next, wait, decide ou someday).` };
  }
  if (!STATUS.includes(tarefa.status)) {
    return { erro: `Item ${numero}: status "${tarefa.status}" inválido (use aberto, feito ou encerrado).` };
  }
  if (!Number.isFinite(tarefa.ordem)) {
    return { erro: `Item ${numero}: ordem "${comoTexto(item.ordem)}" não é um número.` };
  }
  if (!prazoValido(tarefa.prazo)) {
    return { erro: `Item ${numero}: prazo "${tarefa.prazo}" inválido (use AAAA-MM-DD, ex.: 2026-11-15, ou deixe vazio).` };
  }
  return { tarefa: novaTarefa(tarefa) };
}

// Confere a lista inteira. Devolve as tarefas válidas e a lista de erros.
export function validarLista(dados) {
  if (!Array.isArray(dados)) {
    return { tarefas: [], erros: ['O arquivo precisa conter uma lista de tarefas: [ { ... }, { ... } ].'] };
  }
  const tarefas = [];
  const erros = [];
  dados.forEach((item, indice) => {
    const resultado = validarTarefa(item, indice + 1);
    if (resultado.erro) erros.push(resultado.erro);
    else tarefas.push(resultado.tarefa);
  });
  return { tarefas, erros };
}
