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

// Cria uma tarefa completa: os campos informados substituem os valores padrão.
export function novaTarefa(campos) {
  return {
    id: novoId(),
    aba: 'projetos',
    grupo: 'Geral',
    titulo: '',
    desc: '',
    tag: 'next',
    tagTexto: '',
    status: 'aberto',
    ordem: 1,
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
