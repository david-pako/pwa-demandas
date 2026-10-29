import {
  carregar, salvar, novaTarefa, paraExportar, validarLista, TAGS,
  guardarCopia, lerCopia, apagarCopia,
} from './dados.js';

// ---------- Estado ----------
const CHAVE_ABA = 'demandas.aba';
const GRUPO_RAPIDO = 'Entrada';

let tarefas = carregar();
let abaAtual = localStorage.getItem(CHAVE_ABA) === 'pessoal' ? 'pessoal' : 'projetos';
const gruposExpandidos = new Set(); // grupos com as tarefas fechadas à mostra

const lista = document.getElementById('lista');

// Cria um elemento HTML. Os textos entram como texto (nunca como innerHTML),
// então um "<script>" vindo de uma tarefa aparece na tela em vez de ser executado.
function el(tag, props = {}, ...filhos) {
  const elemento = document.createElement(tag);
  Object.assign(elemento, props);
  elemento.append(...filhos.filter((filho) => filho !== null && filho !== undefined));
  return elemento;
}

const porOrdem = (a, b) => a.ordem - b.ordem;

// Grupos da aba na ordem em que aparecem; o grupo do campo rápido vem sempre primeiro.
function gruposDaAba(aba) {
  const grupos = [...new Set(tarefas.filter((t) => t.aba === aba).map((t) => t.grupo))];
  return grupos.sort((a, b) => (b === GRUPO_RAPIDO) - (a === GRUPO_RAPIDO));
}

// Próxima posição livre no fim de um grupo.
function proximaOrdem(aba, grupo) {
  const ordens = tarefas.filter((t) => t.aba === aba && t.grupo === grupo).map((t) => t.ordem);
  return ordens.length > 0 ? Math.max(...ordens) + 1 : 1;
}

// Toda mudança termina aqui: grava no aparelho e redesenha a tela.
function atualizar() {
  salvar(tarefas);
  render();
}

// ---------- Desenho da tela ----------
function render() {
  renderResumo();
  renderAbas();
  renderLista();
  renderDesfazer();
}

// Mostra o botão "Desfazer importação" só quando existe uma cópia guardada.
function renderDesfazer() {
  const botao = document.getElementById('botao-desfazer');
  const copia = lerCopia();
  botao.hidden = !copia;
  if (copia) {
    const quando = new Date(copia.data).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    botao.textContent = `Desfazer importação de ${quando}`;
  }
}

function renderResumo() {
  const abertas = tarefas.filter((t) => t.status === 'aberto');
  document.getElementById('total-fazer').textContent = abertas.filter((t) => t.tag !== 'wait').length;
  document.getElementById('total-aguardando').textContent = abertas.filter((t) => t.tag === 'wait').length;
  document.getElementById('total-concluidas').textContent = tarefas.filter((t) => t.status === 'feito').length;
}

function renderAbas() {
  document.querySelectorAll('.aba').forEach((botao) => {
    botao.setAttribute('aria-selected', String(botao.dataset.aba === abaAtual));
  });
}

function renderLista() {
  const grupos = gruposDaAba(abaAtual);
  if (grupos.length === 0) {
    lista.replaceChildren(el('p', { className: 'vazio', textContent: 'Nenhuma tarefa por aqui ainda.' }));
    return;
  }
  lista.replaceChildren(...grupos.map(renderGrupo));
}

function renderGrupo(grupo) {
  const doGrupo = tarefas.filter((t) => t.aba === abaAtual && t.grupo === grupo).sort(porOrdem);
  const abertas = doGrupo.filter((t) => t.status === 'aberto');
  const fechadas = doGrupo.filter((t) => t.status !== 'aberto');

  let blocoFechadas = null;
  if (fechadas.length > 0) {
    const chave = `${abaAtual}|${grupo}`;
    blocoFechadas = el('details', { className: 'fechadas', open: gruposExpandidos.has(chave) },
      el('summary', { textContent: `${fechadas.length} fechada(s)` }),
      el('ul', { className: 'tarefas' }, ...fechadas.map(renderTarefa)),
    );
    blocoFechadas.addEventListener('toggle', () => {
      if (blocoFechadas.open) gruposExpandidos.add(chave);
      else gruposExpandidos.delete(chave);
    });
  }

  return el('section', { className: 'grupo' },
    el('h2', { className: 'grupo-titulo' }, grupo, el('span', { className: 'contador', textContent: abertas.length })),
    abertas.length > 0 ? el('ul', { className: 'tarefas' }, ...abertas.map(renderTarefa)) : null,
    blocoFechadas,
  );
}

function renderTarefa(t) {
  const item = el('li', { className: `tarefa status-${t.status}` },
    el('div', { className: 'tarefa-cabeca' },
      el('span', { className: `tag tag-${t.tag}`, textContent: t.tagTexto || TAGS[t.tag] }),
      t.status === 'aberto' ? null : el('span', { className: 'selo', textContent: t.status === 'feito' ? 'Feito' : 'Encerrado' }),
    ),
    el('p', { className: 'tarefa-titulo', textContent: t.titulo }),
    t.desc ? el('p', { className: 'tarefa-desc', textContent: t.desc }) : null,
    el('div', { className: 'tarefa-acoes' }, ...botoesDa(t)),
  );
  item.dataset.id = t.id;
  return item;
}

function criarBotao(acao, texto) {
  const botao = el('button', { type: 'button', className: `acao acao-${acao}`, textContent: texto });
  botao.dataset.acao = acao;
  return botao;
}

function botoesDa(t) {
  if (t.status === 'aberto') {
    return [criarBotao('feito', 'Feito'), criarBotao('encerrar', 'Encerrar'), criarBotao('editar', 'Editar')];
  }
  return [criarBotao('reabrir', 'Reabrir'), criarBotao('editar', 'Editar')];
}

// ---------- Edição ----------
const dialogo = document.getElementById('dialogo');
const formEditar = document.getElementById('form-editar');
const CAMPOS_EDITAVEIS = ['titulo', 'desc', 'aba', 'grupo', 'tag', 'tagTexto'];
let emEdicao = null; // a tarefa aberta no diálogo

// Sugestões do campo Grupo: os grupos que já existem na aba escolhida.
function preencherGrupos(aba) {
  document.getElementById('lista-grupos').replaceChildren(
    ...gruposDaAba(aba).map((grupo) => el('option', { value: grupo })),
  );
}

function abrirEdicao(tarefa) {
  emEdicao = tarefa;
  for (const campo of CAMPOS_EDITAVEIS) {
    formEditar.elements[campo].value = tarefa[campo];
  }
  preencherGrupos(tarefa.aba);
  dialogo.showModal();
}

// ---------- Eventos ----------
document.querySelector('.abas').addEventListener('click', (evento) => {
  const botao = evento.target.closest('.aba');
  if (!botao) return;
  abaAtual = botao.dataset.aba;
  localStorage.setItem(CHAVE_ABA, abaAtual);
  render();
});

const campoRapido = document.getElementById('campo-rapido');
document.getElementById('form-rapido').addEventListener('submit', (evento) => {
  evento.preventDefault(); // impede o recarregamento da página
  const titulo = campoRapido.value.trim();
  if (!titulo) return;
  tarefas.push(novaTarefa({
    aba: abaAtual,
    grupo: GRUPO_RAPIDO,
    titulo,
    ordem: proximaOrdem(abaAtual, GRUPO_RAPIDO),
  }));
  campoRapido.value = '';
  atualizar();
});

// Delegação de eventos: um só ouvinte na lista atende os botões de todas as tarefas.
lista.addEventListener('click', (evento) => {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao) return;
  const tarefa = tarefas.find((t) => t.id === botao.closest('.tarefa').dataset.id);
  if (!tarefa) return;

  switch (botao.dataset.acao) {
    case 'feito': tarefa.status = 'feito'; break;
    case 'encerrar': tarefa.status = 'encerrado'; break;
    case 'reabrir': tarefa.status = 'aberto'; break;
    case 'editar': abrirEdicao(tarefa); return;
    default: return;
  }
  atualizar();
});

formEditar.elements.aba.addEventListener('change', (evento) => preencherGrupos(evento.target.value));

formEditar.addEventListener('submit', (evento) => {
  evento.preventDefault();
  const campos = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    campos[campo] = formEditar.elements[campo].value.trim();
  }
  if (!campos.titulo || !campos.grupo) return;

  // Mudou de aba ou de grupo: vai para o fim do grupo novo.
  if (campos.aba !== emEdicao.aba || campos.grupo !== emEdicao.grupo) {
    campos.ordem = proximaOrdem(campos.aba, campos.grupo);
  }
  Object.assign(emEdicao, campos);
  dialogo.close();
  atualizar();
});

document.getElementById('botao-cancelar').addEventListener('click', () => dialogo.close());

document.getElementById('botao-excluir').addEventListener('click', () => {
  if (!confirm(`Excluir "${emEdicao.titulo}"? Não dá para desfazer.`)) return;
  tarefas = tarefas.filter((t) => t !== emEdicao);
  dialogo.close();
  atualizar();
});

// ---------- Exportar e importar ----------
document.getElementById('botao-exportar').addEventListener('click', () => {
  const json = JSON.stringify(paraExportar(tarefas), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const hoje = new Date().toLocaleDateString('sv-SE'); // formato AAAA-MM-DD na data local
  el('a', { href: url, download: `demandas-${hoje}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

const arquivoImportar = document.getElementById('arquivo-importar');
document.getElementById('botao-importar').addEventListener('click', () => arquivoImportar.click());

arquivoImportar.addEventListener('change', async () => {
  const arquivo = arquivoImportar.files[0];
  if (!arquivo) return;
  let texto;
  try {
    texto = await arquivo.text();
  } finally {
    arquivoImportar.value = ''; // permite escolher o mesmo arquivo de novo
  }

  let dados;
  try {
    dados = JSON.parse(texto.replace(/^\uFEFF/, '')); // ignora o BOM que alguns editores colocam
  } catch {
    alert('Não consegui ler o arquivo: ele não é um JSON válido.');
    return;
  }

  const { tarefas: importadas, erros } = validarLista(dados);
  if (erros.length > 0) {
    const resumo = erros.slice(0, 5).join('\n') + (erros.length > 5 ? `\n… e mais ${erros.length - 5}.` : '');
    alert(`Nada foi importado. O arquivo tem ${erros.length} problema(s):\n\n${resumo}`);
    return;
  }
  if (importadas.length === 0) {
    alert('O arquivo não tem nenhuma tarefa.');
    return;
  }
  if (!confirm(`Importar ${importadas.length} tarefa(s)? Isso substitui todas as tarefas deste aparelho.\n\nVocê poderá desfazer depois.`)) return;

  guardarCopia(tarefas); // guarda as tarefas atuais antes de substituir
  tarefas = importadas;
  atualizar();
});

document.getElementById('botao-desfazer').addEventListener('click', () => {
  const copia = lerCopia();
  if (!copia) return;
  if (!confirm(`Voltar para as ${copia.tarefas.length} tarefa(s) de antes da importação? As tarefas atuais serão substituídas.`)) return;
  tarefas = copia.tarefas;
  apagarCopia();
  atualizar();
});

// ---------- Início ----------
render();

// Registra o service worker, que permite instalar o app e usá-lo offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((erro) => {
      console.error('Falha ao registrar o service worker:', erro);
    });
  });
}
