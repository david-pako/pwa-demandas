import {
  criarArmazenamentoLocal, carregar, novaTarefa, paraExportar, validarLista, TAGS,
  guardarCopia, lerCopia, apagarCopia,
} from './dados.js';

// ---------- Estado ----------
const CHAVE_ABA = 'demandas.aba';
const GRUPO_RAPIDO = 'Entrada';

// Onde as tarefas ficam (aparelho ou nuvem). A tela só usa as operações dele.
let armazenamento = null;
let tarefas = []; // cópia da lista para desenhar; é atualizada pelo aoMudar
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

// ---------- Ordenação ----------
const CHAVE_ORDEM = 'demandas.ordem';
const CHAVE_AGRUPAR = 'demandas.agrupar';
const SEM_PRAZO = '9999-12-31'; // sem prazo vai para o fim na ordem por prazo

// Cada opção do seletor "Ordem" é uma função de comparação para o sort().
// Empates seguem a ordem manual (setas).
const ORDENS = {
  manual: porOrdem,
  prazo: (a, b) => (a.prazo || SEM_PRAZO).localeCompare(b.prazo || SEM_PRAZO) || porOrdem(a, b),
  alfabetica: (a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR', { sensitivity: 'base', numeric: true }) || porOrdem(a, b),
  recentes: (a, b) => (b.criadoEm ?? 0) - (a.criadoEm ?? 0) || porOrdem(a, b),
  antigas: (a, b) => (a.criadoEm ?? 0) - (b.criadoEm ?? 0) || porOrdem(a, b),
};

let ordemAtual = Object.hasOwn(ORDENS, localStorage.getItem(CHAVE_ORDEM)) ? localStorage.getItem(CHAVE_ORDEM) : 'manual';
let agrupar = localStorage.getItem(CHAVE_AGRUPAR) !== 'nao';

// Grupos da aba na ordem em que aparecem; o grupo do campo rápido vem sempre primeiro.
function gruposDaAba(aba) {
  const grupos = [...new Set(tarefas.filter((t) => t.aba === aba).map((t) => t.grupo))];
  return grupos.sort((a, b) => (b === GRUPO_RAPIDO) - (a === GRUPO_RAPIDO));
}

// Troca a tarefa de lugar com a vizinha (direcao -1 sobe, +1 desce) entre as abertas do grupo.
// Renumera o grupo 1, 2, 3... e grava só as tarefas cuja ordem mudou.
function mover(tarefa, direcao) {
  const abertas = tarefas
    .filter((t) => t.aba === tarefa.aba && t.grupo === tarefa.grupo && t.status === 'aberto')
    .sort(porOrdem);
  const de = abertas.findIndex((t) => t.id === tarefa.id);
  const para = de + direcao;
  if (de < 0 || para < 0 || para >= abertas.length) return;

  [abertas[de], abertas[para]] = [abertas[para], abertas[de]];
  abertas.forEach((t, posicao) => {
    if (t.ordem !== posicao + 1) armazenamento.alterar(t.id, { ordem: posicao + 1 });
  });
}

// Próxima posição livre no fim de um grupo.
function proximaOrdem(aba, grupo) {
  const ordens = tarefas.filter((t) => t.aba === aba && t.grupo === grupo).map((t) => t.ordem);
  return ordens.length > 0 ? Math.max(...ordens) + 1 : 1;
}

// ---------- Prazos ----------
const hoje = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD na data local

// Dias entre hoje e o prazo (negativo = atrasado). Usa UTC só para não sofrer com horário de verão.
function diasAte(prazo) {
  const paraDia = (data) => {
    const [ano, mes, dia] = data.split('-').map(Number);
    return Date.UTC(ano, mes - 1, dia) / 86400000;
  };
  return paraDia(prazo) - paraDia(hoje());
}

// Etiqueta do prazo: "Atrasada · 28/10", "Vence hoje", "Em 3 dias · 04/11", "15/11"...
function etiquetaPrazo(t) {
  if (!t.prazo) return null;
  const [ano, mes, dia] = t.prazo.split('-');
  const data = `${dia}/${mes}` + (ano === hoje().slice(0, 4) ? '' : `/${ano}`);
  let texto = `Prazo ${data}`;
  let classe = 'prazo';
  if (t.status === 'aberto') {
    const dias = diasAte(t.prazo);
    if (dias < 0) { texto = `Atrasada · ${data}`; classe += ' prazo-atrasado'; }
    else if (dias === 0) { texto = 'Vence hoje'; classe += ' prazo-perto'; }
    else if (dias === 1) { texto = 'Vence amanhã'; classe += ' prazo-perto'; }
    else if (dias <= 7) texto = `Em ${dias} dias · ${data}`;
  }
  return el('span', { className: classe, textContent: texto });
}

// ---------- Desenho da tela ----------
function render() {
  renderConta();
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
  const daAba = tarefas.filter((t) => t.aba === abaAtual);

  if (agrupar) {
    lista.replaceChildren(...grupos.map((grupo) => renderSecao(
      grupo,
      daAba.filter((t) => t.grupo === grupo).sort(ORDENS[ordemAtual]),
      `grupo|${abaAtual}|${grupo}`,
    )));
    return;
  }

  // Sem grupos: "Minha ordem" segue a ordem dos grupos e, dentro deles, a das setas.
  const comparar = ordemAtual === 'manual'
    ? (a, b) => grupos.indexOf(a.grupo) - grupos.indexOf(b.grupo) || porOrdem(a, b)
    : ORDENS[ordemAtual];
  lista.replaceChildren(renderSecao('Todas', [...daAba].sort(comparar), `todas|${abaAtual}`, true));
}

// Uma seção da lista: abertas à mostra e fechadas recolhidas no fim.
// mostrarGrupo: põe o nome do grupo em cada tarefa (usado na lista sem grupos).
function renderSecao(titulo, daSecao, chave, mostrarGrupo = false) {
  const abertas = daSecao.filter((t) => t.status === 'aberto');
  const fechadas = daSecao.filter((t) => t.status !== 'aberto');
  const setas = agrupar && ordemAtual === 'manual'; // ↑↓ só fazem sentido na ordem manual

  let blocoFechadas = null;
  if (fechadas.length > 0) {
    blocoFechadas = el('details', { className: 'fechadas', open: gruposExpandidos.has(chave) },
      el('summary', { textContent: `${fechadas.length} fechada(s)` }),
      el('ul', { className: 'tarefas' }, ...fechadas.map((t) => renderTarefa(t, { mostrarGrupo }))),
    );
    blocoFechadas.addEventListener('toggle', () => {
      if (blocoFechadas.open) gruposExpandidos.add(chave);
      else gruposExpandidos.delete(chave);
    });
  }

  return el('section', { className: 'grupo' },
    el('h2', { className: 'grupo-titulo' }, titulo, el('span', { className: 'contador', textContent: abertas.length })),
    abertas.length > 0
      ? el('ul', { className: 'tarefas' }, ...abertas.map((t, i) => renderTarefa(t, {
        mostrarGrupo, setas, primeira: i === 0, ultima: i === abertas.length - 1,
      })))
      : null,
    blocoFechadas,
  );
}

// opcoes.setas: mostra ↑↓ (primeira/ultima desativam as pontas); opcoes.mostrarGrupo: etiqueta do grupo.
function renderTarefa(t, opcoes = {}) {
  const item = el('li', { className: `tarefa status-${t.status}` },
    el('div', { className: 'tarefa-cabeca' },
      el('span', { className: `tag tag-${t.tag}`, textContent: t.tagTexto || TAGS[t.tag] }),
      etiquetaPrazo(t),
      opcoes.mostrarGrupo ? el('span', { className: 'selo', textContent: t.grupo }) : null,
      t.status === 'aberto' ? null : el('span', { className: 'selo', textContent: t.status === 'feito' ? 'Feito' : 'Encerrado' }),
    ),
    el('p', { className: 'tarefa-titulo', textContent: t.titulo }),
    t.desc ? el('p', { className: 'tarefa-desc', textContent: t.desc }) : null,
    el('div', { className: 'tarefa-acoes' }, ...botoesDa(t, opcoes)),
  );
  item.dataset.id = t.id;
  return item;
}

function criarBotao(acao, texto, rotulo = '') {
  const botao = el('button', { type: 'button', className: `acao acao-${acao}`, textContent: texto });
  botao.dataset.acao = acao;
  if (rotulo) {
    botao.setAttribute('aria-label', rotulo); // lido por leitores de tela no lugar da seta
    botao.title = rotulo;
  }
  return botao;
}

function botoesDa(t, { setas = false, primeira = false, ultima = false } = {}) {
  if (t.status === 'aberto') {
    const botoes = [criarBotao('feito', 'Feito'), criarBotao('encerrar', 'Encerrar'), criarBotao('editar', 'Editar')];
    if (setas) {
      const subir = criarBotao('subir', '↑', 'Mover para cima');
      const descer = criarBotao('descer', '↓', 'Mover para baixo');
      subir.disabled = primeira;
      descer.disabled = ultima;
      botoes.push(subir, descer);
    }
    return botoes;
  }
  return [criarBotao('reabrir', 'Reabrir'), criarBotao('editar', 'Editar')];
}

// ---------- Edição ----------
const dialogo = document.getElementById('dialogo');
const formEditar = document.getElementById('form-editar');
const CAMPOS_EDITAVEIS = ['titulo', 'desc', 'aba', 'grupo', 'tag', 'tagTexto', 'prazo'];
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
    formEditar.elements[campo].value = tarefa[campo] ?? ''; // tarefas antigas não têm prazo
  }
  preencherGrupos(tarefa.aba);
  dialogo.showModal();
}

// ---------- Eventos ----------
const seletorOrdem = document.getElementById('ordem');
const caixaAgrupar = document.getElementById('agrupar');
seletorOrdem.value = ordemAtual;
caixaAgrupar.checked = agrupar;

seletorOrdem.addEventListener('change', () => {
  ordemAtual = seletorOrdem.value;
  localStorage.setItem(CHAVE_ORDEM, ordemAtual);
  if (armazenamento) renderLista();
});

caixaAgrupar.addEventListener('change', () => {
  agrupar = caixaAgrupar.checked;
  localStorage.setItem(CHAVE_AGRUPAR, agrupar ? 'sim' : 'nao');
  if (armazenamento) renderLista();
});

// Ao voltar para o app (talvez em outro dia), redesenha para atualizar "Vence hoje", "Atrasada"...
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && armazenamento) render();
});

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
  if (!titulo || !armazenamento) return; // sem armazenamento: ainda carregando a nuvem
  armazenamento.adicionar(novaTarefa({
    aba: abaAtual,
    grupo: GRUPO_RAPIDO,
    titulo,
    ordem: proximaOrdem(abaAtual, GRUPO_RAPIDO),
  }));
  campoRapido.value = '';
});

// Delegação de eventos: um só ouvinte na lista atende os botões de todas as tarefas.
lista.addEventListener('click', (evento) => {
  const botao = evento.target.closest('button[data-acao]');
  if (!botao) return;
  const tarefa = tarefas.find((t) => t.id === botao.closest('.tarefa').dataset.id);
  if (!tarefa) return;

  switch (botao.dataset.acao) {
    case 'feito': armazenamento.alterar(tarefa.id, { status: 'feito' }); break;
    case 'encerrar': armazenamento.alterar(tarefa.id, { status: 'encerrado' }); break;
    case 'reabrir': armazenamento.alterar(tarefa.id, { status: 'aberto' }); break;
    case 'editar': abrirEdicao(tarefa); break;
    case 'subir': mover(tarefa, -1); break;
    case 'descer': mover(tarefa, 1); break;
    default: break;
  }
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
  dialogo.close();
  armazenamento.alterar(emEdicao.id, campos);
});

document.getElementById('botao-cancelar').addEventListener('click', () => dialogo.close());

document.getElementById('botao-excluir').addEventListener('click', () => {
  if (!confirm(`Excluir "${emEdicao.titulo}"? Não dá para desfazer.`)) return;
  dialogo.close();
  armazenamento.remover(emEdicao.id);
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
  if (!arquivo || !armazenamento) return;
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
  const onde = usuario ? 'da sua conta, em todos os aparelhos' : 'deste aparelho';
  if (!confirm(`Importar ${importadas.length} tarefa(s)? Isso substitui todas as tarefas ${onde}.\n\nVocê poderá desfazer depois.`)) return;

  guardarCopia(tarefas); // guarda as tarefas atuais antes de substituir
  armazenamento.substituirTudo(importadas);
});

document.getElementById('botao-desfazer').addEventListener('click', () => {
  const copia = lerCopia();
  if (!copia) return;
  if (!confirm(`Voltar para as ${copia.tarefas.length} tarefa(s) de antes da importação? As tarefas atuais serão substituídas.`)) return;
  apagarCopia(); // antes de substituir, para o botão sumir no redesenho
  armazenamento.substituirTudo(copia.tarefas);
});

// ---------- Tema ----------
// O <head> já aplicou o tema salvo; aqui ficam o botão e a cor da barra do celular.
const CHAVE_TEMA = 'demandas.tema';
const TEMAS = ['auto', 'claro', 'escuro'];
const ROTULOS_TEMA = { auto: '◐ Automático', claro: '☀ Claro', escuro: '☾ Escuro' };
const CORES_BARRA = { claro: '#f5f7f5', escuro: '#121814' }; // iguais ao --fundo do styles.css
const botaoTema = document.getElementById('botao-tema');

function aplicarTema(tema) {
  if (tema === 'auto') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;

  // Cada <meta theme-color> vale para um tema do celular; com escolha manual, os dois usam a mesma cor.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    const doCelular = (meta.getAttribute('media') || '').includes('dark') ? 'escuro' : 'claro';
    meta.content = CORES_BARRA[tema === 'auto' ? doCelular : tema];
  });

  botaoTema.textContent = ROTULOS_TEMA[tema];
  botaoTema.setAttribute('aria-label', `Tema: ${ROTULOS_TEMA[tema].slice(2)}. Toque para trocar.`);
}

let temaAtual = TEMAS.includes(localStorage.getItem(CHAVE_TEMA)) ? localStorage.getItem(CHAVE_TEMA) : 'auto';
aplicarTema(temaAtual);

botaoTema.addEventListener('click', () => {
  temaAtual = TEMAS[(TEMAS.indexOf(temaAtual) + 1) % TEMAS.length];
  localStorage.setItem(CHAVE_TEMA, temaAtual);
  aplicarTema(temaAtual);
});

// ---------- Conta e nuvem ----------
const CHAVE_NUVEM = 'demandas.usaNuvem'; // lembra que este aparelho está logado na nuvem
const conta = document.getElementById('conta');
let nuvem = null;            // o módulo nuvem.js, depois de carregado
let usuario = null;          // quem está logado, ou null
let estadoSync = '';         // 'sincronizado', 'offline', 'enviando' ou '' (só no aparelho)
let erroNuvem = '';          // último erro da nuvem, mostrado no topo
let nuvemIndisponivel = false;

// Troca o armazenamento usado pela tela e passa a ouvir as mudanças dele
// (feitas por esta tela ou, na nuvem, por outro aparelho).
function usar(novo) {
  armazenamento?.parar?.();
  armazenamento = novo;
  armazenamento.aoMudar((lista, estado = '') => {
    tarefas = lista;
    estadoSync = estado;
    render();
  });
}

const TEXTOS_SYNC = {
  sincronizado: 'Sincronizado',
  offline: 'Offline',
  enviando: 'Enviando mudanças…',
};

function renderConta() {
  const itens = [];
  if (usuario) {
    itens.push(
      el('span', { className: `sync sync-${estadoSync || 'offline'}`, textContent: TEXTOS_SYNC[estadoSync] ?? 'Conectando…' }),
      el('span', { className: 'conta-email', textContent: usuario.email }),
      criarBotaoConta('sair', 'Sair'),
    );
  } else if (nuvem) {
    itens.push(
      criarBotaoConta('entrar', 'Entrar com Google'),
      el('span', { className: 'conta-info', textContent: 'para sincronizar entre aparelhos' }),
    );
  } else if (nuvemIndisponivel) {
    itens.push(el('span', { className: 'conta-info', textContent: 'Sincronização indisponível agora. Mostrando as tarefas deste aparelho.' }));
  }
  if (erroNuvem) {
    itens.push(el('span', { className: 'conta-erro', textContent: `Erro na sincronização: ${erroNuvem}` }));
  }
  conta.replaceChildren(...itens);
}

function criarBotaoConta(acao, texto) {
  const botao = el('button', { type: 'button', className: 'conta-botao', textContent: texto });
  botao.dataset.conta = acao;
  return botao;
}

function mostrarErroNuvem(erro) {
  console.error('Erro na nuvem:', erro);
  erroNuvem = erro.code || erro.message || String(erro);
  renderConta();
}

conta.addEventListener('click', async (evento) => {
  const botao = evento.target.closest('button[data-conta]');
  if (!botao || !nuvem) return;

  if (botao.dataset.conta === 'entrar') {
    try {
      await nuvem.entrar();
    } catch (erro) {
      // Fechar a janela do Google não é erro.
      if (erro.code === 'auth/popup-closed-by-user' || erro.code === 'auth/cancelled-popup-request') return;
      alert(`Não foi possível entrar: ${erro.code || erro.message}`);
    }
  } else if (botao.dataset.conta === 'sair') {
    if (!confirm('Sair da conta? Suas tarefas continuam salvas na nuvem. Neste aparelho, o app volta a mostrar só as tarefas locais.')) return;
    await nuvem.sair();
  }
});

// Primeiro login nesta conta, neste aparelho: oferece enviar as tarefas locais.
// Uma marca no aparelho evita perguntar de novo a cada abertura.
async function enviarTarefasDoAparelho(uid, armazenamentoNuvem) {
  const marca = `demandas.enviado.${uid}`;
  if (localStorage.getItem(marca)) return;

  const locais = carregar();
  if (locais.length > 0) {
    const naConta = await armazenamentoNuvem.contar();
    const pergunta = naConta === 0
      ? `Enviar as ${locais.length} tarefa(s) deste aparelho para a sua conta?`
        + ' (Se forem só as tarefas de exemplo, toque em Cancelar.)'
      : `Sua conta já tem ${naConta} tarefa(s). Juntar com as ${locais.length} deste aparelho?`
        + ' (Cancelar: usar só as da conta.)';
    if (confirm(pergunta)) await armazenamentoNuvem.enviar(locais);
  }
  localStorage.setItem(marca, 'sim');
}

// Carrega o Firebase sem travar o app: se falhar, tudo continua funcionando no aparelho.
async function iniciarNuvem() {
  try {
    nuvem = await import('./nuvem.js');
  } catch (erro) {
    console.error('Firebase indisponível:', erro);
    nuvemIndisponivel = true;
    if (!armazenamento) usar(criarArmazenamentoLocal());
    renderConta();
    return;
  }

  // Chamado na abertura (com o login lembrado) e sempre que alguém entra ou sai.
  nuvem.aoMudarUsuario(async (novoUsuario) => {
    usuario = novoUsuario;
    erroNuvem = '';
    estadoSync = '';
    if (novoUsuario) {
      localStorage.setItem(CHAVE_NUVEM, novoUsuario.uid);
      const armazenamentoNuvem = nuvem.criarArmazenamentoNuvem(novoUsuario.uid, mostrarErroNuvem);
      try {
        await enviarTarefasDoAparelho(novoUsuario.uid, armazenamentoNuvem);
      } catch (erro) {
        mostrarErroNuvem(erro); // sem marca: pergunta de novo na próxima abertura
      }
      usar(armazenamentoNuvem);
    } else {
      localStorage.removeItem(CHAVE_NUVEM);
      usar(criarArmazenamentoLocal());
    }
    renderConta();
  });
}

// ---------- Início ----------
// Logado na nuvem: espera o Firebase (evita piscar as tarefas locais).
// Sem login: mostra as tarefas do aparelho na hora.
if (localStorage.getItem(CHAVE_NUVEM)) {
  lista.replaceChildren(el('p', { className: 'vazio', textContent: 'Carregando…' }));
} else {
  usar(criarArmazenamentoLocal());
}
iniciarNuvem();

// ---------- Service worker e atualizações ----------
// Registra o service worker, que permite instalar o app e usá-lo offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      acompanharAtualizacoes(await navigator.serviceWorker.register('./sw.js'));
    } catch (erro) {
      console.error('Falha ao registrar o service worker:', erro);
    }
  });
}

let atualizacaoPedida = false;

function acompanharAtualizacoes(registro) {
  // Há versão nova esperando? (controller existe = não é a primeira instalação)
  const avisarSeHouver = () => {
    if (registro.waiting && navigator.serviceWorker.controller) mostrarAvisoAtualizacao(registro.waiting);
  };
  avisarSeHouver();

  // Uma versão nova começou a ser baixada: avisa quando terminar.
  registro.addEventListener('updatefound', () => {
    const novo = registro.installing;
    novo?.addEventListener('statechange', () => {
      if (novo.state === 'installed') avisarSeHouver();
    });
  });

  // Ao voltar para o app, pergunta ao servidor se há versão nova.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') registro.update().catch(() => {});
  });

  // A versão nova assumiu: recarrega para usar o código novo
  // (só se a pessoa pediu; na primeira instalação não recarrega).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (atualizacaoPedida) window.location.reload();
  });
}

function mostrarAvisoAtualizacao(novoServiceWorker) {
  const aviso = document.getElementById('aviso-atualizacao');
  aviso.hidden = false;
  document.getElementById('botao-atualizar').onclick = () => {
    atualizacaoPedida = true;
    novoServiceWorker.postMessage({ tipo: 'atualizar' });
  };
}
