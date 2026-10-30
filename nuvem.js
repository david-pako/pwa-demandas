// Armazenamento na nuvem (Firebase): login com Google e tarefas no Firestore.
// O app.js carrega este arquivo com import() dinâmico: se o Firebase falhar,
// o app continua funcionando só no aparelho.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDocs,
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';
import { marcaDeTempo } from './dados.js';

// Identifica o projeto no Firebase. Não é segredo: quem protege os dados
// são as regras de segurança (firestore.rules).
const configuracao = {
  apiKey: 'AIzaSyDMuS-p_9yNxrysxwoKZjQAdysKlzVPsj8',
  authDomain: 'pwa-demandas.firebaseapp.com',
  projectId: 'pwa-demandas',
  storageBucket: 'pwa-demandas.firebasestorage.app',
  messagingSenderId: '783431323843',
  appId: '1:783431323843:web:7b18270d1dd31f33561276',
};

const app = initializeApp(configuracao);
const auth = getAuth(app);

// persistentLocalCache: o Firestore guarda uma cópia no aparelho, funciona offline
// e envia as mudanças pendentes quando a internet volta.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

// ---------- Login ----------
export async function entrar() {
  const provedor = new GoogleAuthProvider();
  provedor.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provedor);
  } catch (erro) {
    // Alguns ambientes bloqueiam a janela de login; tenta redirecionando a página.
    if (erro.code === 'auth/popup-blocked' || erro.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provedor);
    } else {
      throw erro;
    }
  }
}

export function sair() {
  return signOut(auth);
}

// Avisa quando alguém entra ou sai (também na abertura do app, com o login lembrado).
export function aoMudarUsuario(funcao) {
  return onAuthStateChanged(auth, funcao);
}

// ---------- Tarefas ----------
const MAXIMO_POR_LOTE = 450; // o Firestore aceita até 500 operações por lote

// Grava várias operações em lotes. Cada operação é uma função que recebe o lote.
function gravarEmLotes(operacoes) {
  const lotes = [];
  for (let i = 0; i < operacoes.length; i += MAXIMO_POR_LOTE) {
    const lote = writeBatch(db);
    operacoes.slice(i, i + MAXIMO_POR_LOTE).forEach((operacao) => operacao(lote));
    lotes.push(lote.commit());
  }
  return Promise.all(lotes);
}

// Separa o id (que vira o nome do documento) dos demais campos.
function paraDocumento({ id, ...campos }) {
  return [id, { ...campos, criadoEm: campos.criadoEm ?? marcaDeTempo() }];
}

// Mesmas operações do armazenamento local (dados.js), gravando em usuarios/{uid}/tarefas.
// As escritas não esperam o servidor: a tela atualiza na hora e o Firestore envia depois.
export function criarArmazenamentoNuvem(uid, aoErro) {
  const colecao = collection(db, 'usuarios', uid, 'tarefas');
  let atuais = [];
  let pararDeOuvir = () => {};

  return {
    aoMudar(funcao) {
      pararDeOuvir = onSnapshot(colecao, { includeMetadataChanges: true }, (resultado) => {
        atuais = resultado.docs
          .map((documento) => ({ ...documento.data(), id: documento.id }))
          .sort((a, b) => a.criadoEm - b.criadoEm);
        const { hasPendingWrites, fromCache } = resultado.metadata;
        const estado = hasPendingWrites ? 'enviando' : fromCache ? 'offline' : 'sincronizado';
        funcao(atuais, estado);
      }, aoErro);
    },
    adicionar(tarefa) {
      const [id, campos] = paraDocumento(tarefa);
      setDoc(doc(colecao, id), campos).catch(aoErro);
    },
    alterar(id, campos) {
      updateDoc(doc(colecao, id), campos).catch(aoErro);
    },
    remover(id) {
      deleteDoc(doc(colecao, id)).catch(aoErro);
    },
    substituirTudo(lista) {
      const novas = new Set(lista.map((t) => t.id));
      gravarEmLotes([
        ...atuais.filter((t) => !novas.has(t.id)).map((t) => (lote) => lote.delete(doc(colecao, t.id))),
        ...lista.map(paraDocumento).map(([id, campos]) => (lote) => lote.set(doc(colecao, id), campos)),
      ]).catch(aoErro);
    },
    parar() {
      pararDeOuvir();
    },

    // Usados só no primeiro login (envio das tarefas do aparelho).
    async contar() {
      return (await getDocs(colecao)).size;
    },
    enviar(lista) {
      return gravarEmLotes(lista.map(paraDocumento).map(([id, campos]) => (lote) => lote.set(doc(colecao, id), campos)));
    },
  };
}
