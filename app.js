import { carregar, salvar, novaTarefa, TAGS } from './dados.js';

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
  );
  item.dataset.id = t.id;
  return item;
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
