/*
 * Ilustração isométrica (projeção 2:1) de um centro de distribuição para a tela de login:
 * galpão, esteira com as etapas (pórtico de leitura, etiquetadora e túnel de triagem), terminal,
 * caminhão baú na
 * doca, racks de servidores, pilha de caixas em destaque e um cartão flutuante. O piso de placas
 * é `PisoIsometrico`, à parte, para cobrir a tela inteira por baixo do formulário.
 *
 * As cores vêm de variáveis CSS (com fallback para o tema claro), para o tema escuro só
 * redefini-las num ancestral:
 *   --ilustra-topo    faces de cima (as mais claras)                 #ffffff
 *   --ilustra-esq     faces voltadas para a esquerda (tom médio)     #e9ecf1
 *   --ilustra-dir     faces voltadas para a direita (as mais escuras) #d7dbe2
 *   --ilustra-linha   frisos, esteira, aros e detalhes               #c5cad3
 *   --ilustra-sombra  sombras, aberturas e vidros (com opacidade)    #94a3b8
 *   --brand           cor da empresa nos elementos de destaque        #1e40af
 *
 * Com `prefers-reduced-motion: no-preference`, as caixas andam na esteira e o cartão flutua;
 * caso contrário tudo fica parado nas mesmas posições.
 */

const COR = {
  topo: "var(--ilustra-topo, #ffffff)",
  esq: "var(--ilustra-esq, #e9ecf1)",
  dir: "var(--ilustra-dir, #d7dbe2)",
  linha: "var(--ilustra-linha, #c5cad3)",
  sombra: "var(--ilustra-sombra, #94a3b8)",
  marca: "var(--brand, #1e40af)",
} as const;

/** Ponto do mundo: x desce para a direita, y desce para a esquerda, z sobe. */
type Ponto3D = readonly [number, number, number];

const ORIGEM_X = 268;
const ORIGEM_Y = 166;

function projetar([x, y, z]: Ponto3D): readonly [number, number] {
  return [ORIGEM_X + x - y, ORIGEM_Y + (x + y) / 2 - z];
}

function pontos(lista: readonly Ponto3D[]): string {
  return lista.map((p) => projetar(p).join(",")).join(" ");
}

/* Matrizes que levam um desenho 2D (u para a direita, v para baixo) para uma face do mundo. */

/** Face voltada para +y (lado esquerdo da tela); u acompanha +x. */
function planoEsq(x: number, y: number, z: number): string {
  const [a, b] = projetar([x, y, z]);
  return `matrix(1 0.5 0 1 ${a} ${b})`;
}

/** Face voltada para +x (lado direito da tela); u acompanha -y. */
function planoDir(x: number, y: number, z: number): string {
  const [a, b] = projetar([x, y, z]);
  return `matrix(1 -0.5 0 1 ${a} ${b})`;
}

/** Face de cima; u acompanha +x e v acompanha +y. */
function planoTopo(x: number, y: number, z: number): string {
  const [a, b] = projetar([x, y, z]);
  return `matrix(1 0.5 -1 0.5 ${a} ${b})`;
}

function Face({
  p,
  cor,
  opacidade,
}: {
  p: readonly Ponto3D[];
  cor: string;
  opacidade?: number | undefined;
}) {
  // O contorno da mesma cor fecha a fresta de antialiasing entre faces vizinhas.
  return (
    <polygon
      points={pontos(p)}
      fill={cor}
      stroke={cor}
      strokeWidth={0.6}
      strokeLinejoin="round"
      fillOpacity={opacidade}
      strokeOpacity={opacidade}
    />
  );
}

type Medidas = { x: number; y: number; z?: number | undefined; w: number; d: number; h: number };

/** Paralelepípedo com as três faces visíveis: topo claro, esquerda média, direita escura. */
function Bloco({ x, y, z = 0, w, d, h, destaque = false }: Medidas & { destaque?: boolean }) {
  const topo: Ponto3D[] = [
    [x, y, z + h],
    [x + w, y, z + h],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ];
  const dir: Ponto3D[] = [
    [x + w, y, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x + w, y, z + h],
  ];
  const esq: Ponto3D[] = [
    [x, y + d, z],
    [x + w, y + d, z],
    [x + w, y + d, z + h],
    [x, y + d, z + h],
  ];
  return (
    <g>
      <Face p={topo} cor={COR.topo} />
      <Face p={esq} cor={COR.esq} />
      <Face p={dir} cor={COR.dir} />
      {destaque ? (
        <>
          <Face p={topo} cor={COR.marca} opacidade={0.55} />
          <Face p={esq} cor={COR.marca} opacidade={0.82} />
          <Face p={dir} cor={COR.marca} />
        </>
      ) : null}
    </g>
  );
}

/** Sombra suave projetada para a direita (luz vindo de cima, à esquerda). */
function Sombra({
  x,
  y,
  w,
  d,
  z = 0,
  opacidade = 0.4,
}: {
  x: number;
  y: number;
  w: number;
  d: number;
  z?: number | undefined;
  opacidade?: number | undefined;
}) {
  const m = 3;
  const deslocamento = 10;
  return (
    <polygon
      points={pontos([
        [x - m, y - m, z],
        [x + w + m + deslocamento, y - m, z],
        [x + w + m + deslocamento, y + d + m + 4, z],
        [x - m, y + d + m + 4, z],
      ])}
      fill={COR.sombra}
      fillOpacity={opacidade}
      filter="url(#ilustra-logistica-desfoque)"
    />
  );
}

/** Caixa de papelão com fita no topo. */
function CaixaPapelao({ x, y, z = 0, w, d, h }: Medidas) {
  return (
    <g>
      <Bloco x={x} y={y} z={z} w={w} d={d} h={h} />
      <polygon
        points={pontos([
          [x + w / 2 - 1.5, y, z + h],
          [x + w / 2 + 1.5, y, z + h],
          [x + w / 2 + 1.5, y + d, z + h],
          [x + w / 2 - 1.5, y + d, z + h],
        ])}
        fill={COR.linha}
        fillOpacity={0.7}
      />
      <polygon
        points={pontos([
          [x + w / 2 - 1.5, y + d, z + h],
          [x + w / 2 + 1.5, y + d, z + h],
          [x + w / 2 + 1.5, y + d, z + h - 5],
          [x + w / 2 - 1.5, y + d, z + h - 5],
        ])}
        fill={COR.linha}
        fillOpacity={0.7}
      />
    </g>
  );
}

/* ---------------------------------------------------------------- cenário */

function Galpao() {
  const comprimento = 160;
  const fundo = 150;
  const parede = 100;
  const cumeeira = 140;
  const meio = fundo / 2;
  const beiral = 6;
  return (
    <g>
      {/* parede lateral (voltada para a esquerda) */}
      <Face
        p={[
          [0, fundo, 0],
          [comprimento, fundo, 0],
          [comprimento, fundo, parede],
          [0, fundo, parede],
        ]}
        cor={COR.esq}
      />
      {/* oitão (voltado para a direita), com a abertura da esteira */}
      <Face
        p={[
          [comprimento, 0, 0],
          [comprimento, fundo, 0],
          [comprimento, fundo, parede],
          [comprimento, meio, cumeeira],
          [comprimento, 0, parede],
        ]}
        cor={COR.dir}
      />
      {/* janelas altas da lateral */}
      <g transform={planoEsq(0, fundo, 0)}>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect
              x={12 + i * 24}
              y={-84}
              width={16}
              height={20}
              fill={COR.sombra}
              fillOpacity={0.32}
            />
            <rect
              x={12 + i * 24}
              y={-84}
              width={16}
              height={4}
              fill={COR.sombra}
              fillOpacity={0.18}
            />
            <rect x={11 + i * 24} y={-64} width={18} height={2.5} fill={COR.topo} />
          </g>
        ))}
        {/* porta de enrolar fechada */}
        <rect x={106} y={-50} width={42} height={50} fill={COR.dir} />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <rect key={i} x={106} y={-47 + i * 5.5} width={42} height={1} fill={COR.linha} />
        ))}
        <rect x={104} y={-53} width={46} height={3} fill={COR.topo} />
        {/* faixa da marca acima da porta */}
        <rect x={12} y={-40} width={6} height={22} fill={COR.marca} />
        <rect x={22} y={-40} width={60} height={4} fill={COR.linha} fillOpacity={0.9} />
        <rect x={22} y={-32} width={40} height={4} fill={COR.linha} fillOpacity={0.6} />
      </g>
      {/* abertura da esteira e respiro no oitão */}
      <g transform={planoDir(comprimento, fundo, 0)}>
        <rect x={42} y={-62} width={56} height={62} fill={COR.sombra} fillOpacity={0.5} />
        <rect x={42} y={-62} width={56} height={14} fill={COR.esq} />
        {[0, 1].map((i) => (
          <rect key={i} x={42} y={-58 + i * 5} width={56} height={1} fill={COR.linha} />
        ))}
        <rect x={38} y={-66} width={64} height={4} fill={COR.topo} fillOpacity={0.9} />
        <circle cx={meio} cy={-112} r={8} fill={COR.sombra} fillOpacity={0.3} />
        <circle cx={meio} cy={-112} r={8} fill="none" stroke={COR.topo} strokeWidth={1.5} />
      </g>
      {/* telhado: a água de trás aparece como uma fresta acima da cumeeira */}
      <Face
        p={[
          [-beiral, -8, parede - 4],
          [comprimento + beiral, -8, parede - 4],
          [comprimento + beiral, meio, cumeeira],
          [-beiral, meio, cumeeira],
        ]}
        cor={COR.topo}
      />
      <Face
        p={[
          [-beiral, meio, cumeeira],
          [comprimento + beiral, meio, cumeeira],
          [comprimento + beiral, fundo + 8, parede - 4],
          [-beiral, fundo + 8, parede - 4],
        ]}
        cor={COR.topo}
      />
      <Face
        p={[
          [-beiral, fundo + 8, parede - 4],
          [comprimento + beiral, fundo + 8, parede - 4],
          [comprimento + beiral, fundo + 8, parede - 9],
          [-beiral, fundo + 8, parede - 9],
        ]}
        cor={COR.esq}
      />
      <Face
        p={[
          [comprimento + beiral, -8, parede - 4],
          [comprimento + beiral, meio, cumeeira],
          [comprimento + beiral, fundo + 8, parede - 4],
          [comprimento + beiral, fundo + 8, parede - 9],
          [comprimento + beiral, meio, cumeeira - 5],
          [comprimento + beiral, -8, parede - 9],
        ]}
        cor={COR.dir}
      />
      {/* claraboias no telhado */}
      {[0, 1, 2].map((i) => {
        const x0 = 18 + i * 48;
        return (
          <Face
            key={i}
            p={[
              [x0, meio + 14, cumeeira - 7.4],
              [x0 + 30, meio + 14, cumeeira - 7.4],
              [x0 + 30, meio + 50, cumeeira - 26.5],
              [x0, meio + 50, cumeeira - 26.5],
            ]}
            cor={COR.sombra}
            opacidade={0.22}
          />
        );
      })}
    </g>
  );
}

const ESTEIRA = { inicio: 160, fim: 424, y: 60, largura: 40, altura: 30 } as const;
const CAIXA_ESTEIRA = 22;
const PASSO_ESTEIRA = 44;
const CAIXAS_NA_ESTEIRA = 6;

function Esteira() {
  const { inicio, fim, y, largura, altura } = ESTEIRA;
  const comprimento = fim - inicio;
  const pernas = [186, 250, 314, 378, 412];
  return (
    <g>
      {pernas.map((px) => (
        <Bloco key={`t${px}`} x={px} y={y + 3} w={5} d={5} h={altura - 10} />
      ))}
      <Bloco x={inicio} y={y} z={altura - 10} w={comprimento} d={largura} h={8} />
      {/* lona da esteira com roletes */}
      <Face
        p={[
          [inicio, y + 4, altura - 2],
          [fim, y + 4, altura - 2],
          [fim, y + largura - 4, altura - 2],
          [inicio, y + largura - 4, altura - 2],
        ]}
        cor={COR.linha}
      />
      <g transform={planoTopo(inicio, y + 4, altura - 2)}>
        {Array.from({ length: Math.floor(comprimento / 11) }, (_, i) => (
          <rect
            key={i}
            x={6 + i * 11}
            y={0}
            width={1.2}
            height={largura - 8}
            fill={COR.sombra}
            fillOpacity={0.35}
          />
        ))}
      </g>
      <Bloco x={inicio} y={y} z={altura - 2} w={comprimento} d={4} h={6} />
      <EtapasAtras />
      <g className="ilustra-logistica-caixas">
        {Array.from({ length: CAIXAS_NA_ESTEIRA }, (_, i) => (
          <g
            key={i}
            className="ilustra-logistica-caixa"
            transform={`translate(${i * PASSO_ESTEIRA} ${(i * PASSO_ESTEIRA) / 2})`}
            style={{ animationDelay: `${-i * 3}s` }}
          >
            <CaixaPapelao
              x={inicio + 6}
              y={y + 9}
              z={altura - 2}
              w={CAIXA_ESTEIRA}
              d={CAIXA_ESTEIRA}
              h={i % 2 === 0 ? 18 : 14}
            />
          </g>
        ))}
      </g>
      <Bloco x={inicio} y={y + largura - 4} z={altura - 2} w={comprimento} d={4} h={6} />
      {pernas.map((px) => (
        <Bloco key={`f${px}`} x={px} y={y + largura - 8} w={5} d={5} h={altura - 10} />
      ))}
      <EtapasNaFrente />
    </g>
  );
}

const PORTAL = { x: 200, w: 10, h: 50 } as const;
const ETIQUETADORA = { x: 262, w: 34 } as const;
const TUNEL = { x: 344, w: 36, h: 40 } as const;

/** Partes das etapas atrás das caixas: postes de trás, corpo da etiquetadora e fundo do túnel. */
function EtapasAtras() {
  const { y, altura } = ESTEIRA;
  const topo = altura - 2;
  return (
    <g>
      <Bloco x={PORTAL.x} y={y - 6} z={topo} w={PORTAL.w} d={6} h={PORTAL.h} />
      <Bloco x={TUNEL.x} y={y - 6} z={topo} w={TUNEL.w} d={6} h={TUNEL.h} />
      <Bloco x={ETIQUETADORA.x} y={y - 20} w={ETIQUETADORA.w} d={18} h={86} />
      <g transform={planoEsq(ETIQUETADORA.x, y - 2, 0)}>
        <rect x={5} y={-80} width={24} height={15} rx={1.5} fill={COR.marca} fillOpacity={0.9} />
        <rect x={8} y={-76} width={12} height={2} rx={1} fill={COR.topo} />
        <rect x={8} y={-71} width={18} height={2} rx={1} fill={COR.topo} fillOpacity={0.6} />
        <circle cx={9} cy={-58} r={2} fill={COR.marca} />
        <circle cx={16} cy={-58} r={2} fill={COR.linha} />
      </g>
      <g transform={planoDir(ETIQUETADORA.x + ETIQUETADORA.w, y - 2, 0)}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={4} y={-78 + i * 6} width={10} height={2} fill={COR.linha} />
        ))}
      </g>
    </g>
  );
}

/**
 * Partes das etapas que passam na frente das caixas: o feixe de leitura (translúcido, na cor da
 * empresa), o poste da frente e a viga do pórtico, o braço da etiquetadora e o túnel de triagem.
 */
function EtapasNaFrente() {
  const { y, largura, altura } = ESTEIRA;
  const topo = altura - 2;
  const frente = y + largura;
  const meio = PORTAL.x + PORTAL.w / 2;
  return (
    <g>
      <Face
        p={[
          [meio, y, topo + 6],
          [meio, frente, topo + 6],
          [meio, frente, topo + PORTAL.h],
          [meio, y, topo + PORTAL.h],
        ]}
        cor={COR.marca}
        opacidade={0.12}
      />
      <Bloco x={PORTAL.x} y={frente} z={topo} w={PORTAL.w} d={6} h={PORTAL.h} />
      <g transform={planoEsq(PORTAL.x, frente + 6, topo)}>
        <rect x={4} y={-44} width={2.5} height={34} rx={1} fill={COR.marca} />
      </g>
      <Bloco x={PORTAL.x} y={y - 6} z={topo + PORTAL.h} w={PORTAL.w} d={largura + 12} h={9} />
      <Bloco x={ETIQUETADORA.x + 4} y={y - 2} z={topo + 38} w={26} d={30} h={11} />
      <Bloco x={TUNEL.x} y={frente} z={topo} w={TUNEL.w} d={6} h={TUNEL.h} />
      <g transform={planoEsq(TUNEL.x, frente + 6, topo)}>
        <rect x={5} y={-30} width={TUNEL.w - 10} height={3} rx={1} fill={COR.marca} />
        <rect x={5} y={-23} width={(TUNEL.w - 10) * 0.6} height={2} rx={1} fill={COR.linha} />
      </g>
      <Bloco x={TUNEL.x - 2} y={y - 6} z={topo + TUNEL.h} w={TUNEL.w + 4} d={largura + 12} h={8} />
      <Bloco x={ETIQUETADORA.x + 13} y={y + 14} z={topo + 26} w={8} d={8} h={12} destaque />
    </g>
  );
}

/** Terminal de conferência ao lado da esteira, com a tela na cor da empresa. */
function Terminal() {
  const x = 196;
  const y = 124;
  return (
    <g>
      <Bloco x={x} y={y} w={18} d={14} h={4} />
      <Bloco x={x + 6} y={y + 4} z={4} w={6} d={6} h={34} />
      <Bloco x={x - 2} y={y + 6} z={38} w={22} d={4} h={18} />
      <g transform={planoEsq(x - 2, y + 10, 38)}>
        <rect x={2.5} y={-15.5} width={17} height={13} rx={1} fill={COR.marca} fillOpacity={0.9} />
        <rect x={5} y={-12} width={8} height={1.6} fill={COR.topo} />
        <rect x={5} y={-8.5} width={11} height={1.6} fill={COR.topo} fillOpacity={0.6} />
      </g>
    </g>
  );
}

function Roda({ x, y, z, raio }: { x: number; y: number; z: number; raio: number }) {
  return (
    <g>
      <g transform={planoEsq(x, y - 4, z)}>
        <circle r={raio} fill={COR.sombra} fillOpacity={0.9} />
      </g>
      <g transform={planoEsq(x, y, z)}>
        <circle r={raio} fill={COR.sombra} fillOpacity={0.75} />
        <circle r={raio * 0.55} fill={COR.dir} />
        <circle r={raio * 0.22} fill={COR.topo} />
      </g>
    </g>
  );
}

function Caminhao() {
  const bau = { x: 344, y: 50, z: 20, w: 130, d: 64, h: 82 };
  const cabine = { x: 478, y: 54, z: 20, w: 40, d: 56, h: 60 };
  const ladoCabine = cabine.y + cabine.d;
  const frente = cabine.x + cabine.w;
  return (
    <g>
      {/* chassi */}
      <Bloco x={348} y={58} z={10} w={186} d={48} h={10} />
      {/* baú */}
      <Bloco {...bau} />
      <g transform={planoEsq(bau.x, bau.y + bau.d, bau.z)}>
        <rect x={8} y={-24} width={bau.w - 16} height={4} fill={COR.marca} />
        <rect
          x={8}
          y={-16}
          width={(bau.w - 16) * 0.6}
          height={2}
          fill={COR.marca}
          fillOpacity={0.45}
        />
        <rect x={0} y={-bau.h} width={bau.w} height={3} fill={COR.topo} />
      </g>
      {/* cabine com para-brisa inclinado e capô */}
      <Bloco {...cabine} />
      <Face
        p={[
          [frente, cabine.y, cabine.z + cabine.h],
          [frente, ladoCabine, cabine.z + cabine.h],
          [frente + 14, ladoCabine, cabine.z + 32],
          [frente + 14, cabine.y, cabine.z + 32],
        ]}
        cor={COR.topo}
      />
      <Face
        p={[
          [frente, ladoCabine, cabine.z + cabine.h],
          [frente + 14, ladoCabine, cabine.z + 32],
          [frente, ladoCabine, cabine.z + 32],
        ]}
        cor={COR.esq}
      />
      <Face
        p={[
          [frente + 1.5, cabine.y + 4, cabine.z + cabine.h - 3],
          [frente + 1.5, ladoCabine - 4, cabine.z + cabine.h - 3],
          [frente + 12, ladoCabine - 4, cabine.z + 36],
          [frente + 12, cabine.y + 4, cabine.z + 36],
        ]}
        cor={COR.sombra}
        opacidade={0.55}
      />
      <Face
        p={[
          [frente + 3, ladoCabine - 16, cabine.z + cabine.h - 6],
          [frente + 3, ladoCabine - 9, cabine.z + cabine.h - 6],
          [frente + 10, ladoCabine - 22, cabine.z + 40],
          [frente + 10, ladoCabine - 29, cabine.z + 40],
        ]}
        cor={COR.topo}
        opacidade={0.6}
      />
      <Bloco x={frente} y={cabine.y} z={cabine.z} w={16} d={cabine.d} h={32} />
      {/* janela lateral e maçaneta */}
      <g transform={planoEsq(cabine.x, ladoCabine, cabine.z)}>
        <path d={`M 6 -54 L 30 -54 L 36 -36 L 6 -36 Z`} fill={COR.sombra} fillOpacity={0.5} />
        <rect x={22} y={-30} width={8} height={2} fill={COR.linha} />
        <rect x={0} y={-10} width={cabine.w + 16} height={3} fill={COR.linha} fillOpacity={0.6} />
      </g>
      {/* grade e faróis */}
      <g transform={planoDir(frente + 16, ladoCabine, cabine.z)}>
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={14} y={-26 + i * 5} width={28} height={2} fill={COR.linha} />
        ))}
        <rect x={4} y={-24} width={7} height={6} rx={1.5} fill={COR.topo} />
        <rect x={45} y={-24} width={7} height={6} rx={1.5} fill={COR.topo} />
        <rect x={0} y={-6} width={cabine.d} height={6} fill={COR.linha} />
      </g>
      {/* rodas */}
      <Roda x={378} y={110} z={13} raio={13} />
      <Roda x={408} y={110} z={13} raio={13} />
      <Roda x={508} y={110} z={13} raio={13} />
    </g>
  );
}

function Rack({ x, y }: { x: number; y: number }) {
  const w = 34;
  const d = 40;
  const h = 84;
  return (
    <g>
      <Bloco x={x} y={y} w={w} d={d} h={h} />
      <g transform={planoEsq(x, y + d, 0)}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <rect x={4} y={-78 + i * 12} width={w - 8} height={8} fill={COR.dir} />
            <rect x={6} y={-75 + i * 12} width={14} height={1.5} fill={COR.linha} />
            <circle
              cx={w - 8}
              cy={-74 + i * 12}
              r={1.6}
              fill={COR.marca}
              fillOpacity={i % 3 === 1 ? 0.35 : 1}
            />
          </g>
        ))}
      </g>
      <g transform={planoDir(x + w, y + d, 0)}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x={6} y={-76 + i * 9} width={d - 12} height={2} fill={COR.linha} />
        ))}
      </g>
    </g>
  );
}

/** Pilha de caixas na cor da empresa sobre um estrado (lembra um gráfico de barras). */
function PilhaDestaque() {
  const base = { x: 60, y: 196, w: 92, d: 66 };
  const lado = 22;
  const alturas = [
    [30, 46, 22],
    [54, 36, 62],
  ];
  return (
    <g>
      <Bloco x={base.x} y={base.y} w={base.w} d={base.d} h={8} />
      {alturas.flatMap((linha, j) =>
        linha.map((h, i) => (
          <Bloco
            key={`${i}:${j}`}
            x={base.x + 6 + i * (lado + 6)}
            y={base.y + 6 + j * (lado + 7)}
            z={8}
            w={lado}
            d={lado}
            h={h}
            destaque
          />
        )),
      )}
    </g>
  );
}

/** Cartão flutuante com três linhas na cor da empresa, sobre um pedestal baixo. */
function CartaoFlutuante() {
  const pedestal = { x: 242, y: 176, w: 82, d: 38 };
  const cartao = { x: 254, y: 190, z: 26, w: 64, d: 5, h: 50 };
  return (
    <g>
      <Bloco x={pedestal.x} y={pedestal.y} w={pedestal.w} d={pedestal.d} h={6} />
      <Sombra x={cartao.x} y={cartao.y + 2} w={cartao.w - 10} d={10} z={6} opacidade={0.45} />
      <g className="ilustra-logistica-cartao">
        <Bloco {...cartao} />
        <g transform={planoEsq(cartao.x, cartao.y + cartao.d, cartao.z)}>
          <rect x={8} y={-40} width={9} height={9} rx={2} fill={COR.marca} />
          <rect x={22} y={-39} width={32} height={4} rx={2} fill={COR.marca} />
          <rect x={8} y={-25} width={46} height={4} rx={2} fill={COR.marca} fillOpacity={0.6} />
          <rect x={8} y={-15} width={30} height={4} rx={2} fill={COR.marca} fillOpacity={0.35} />
        </g>
      </g>
    </g>
  );
}

function PaleteComCaixas() {
  const x = 380;
  const y = 146;
  return (
    <g>
      <Bloco x={x} y={y} w={44} d={40} h={5} />
      <CaixaPapelao x={x + 2} y={y + 2} z={5} w={20} d={18} h={16} />
      <CaixaPapelao x={x + 22} y={y + 2} z={5} w={20} d={18} h={16} />
      <CaixaPapelao x={x + 2} y={y + 20} z={5} w={20} d={18} h={16} />
      <CaixaPapelao x={x + 22} y={y + 20} z={5} w={20} d={18} h={16} />
      <CaixaPapelao x={x + 10} y={y + 10} z={21} w={22} d={20} h={14} />
    </g>
  );
}

/** Quanto o caminhão (e o palete ao lado) andam no eixo x para a esteira mais longa caber. */
const AVANCO = 88;

const ESTILO = `
@media (prefers-reduced-motion: no-preference) {
  .ilustra-logistica-caixa {
    animation: ilustra-logistica-esteira 18s linear infinite;
  }
  .ilustra-logistica-cartao {
    animation: ilustra-logistica-flutuar 5s ease-in-out infinite;
  }
}
@keyframes ilustra-logistica-esteira {
  0% { transform: translate(0px, 0px); opacity: 0; }
  6% { opacity: 1; }
  94% { opacity: 1; }
  100% { transform: translate(${CAIXAS_NA_ESTEIRA * PASSO_ESTEIRA}px, ${(CAIXAS_NA_ESTEIRA * PASSO_ESTEIRA) / 2}px); opacity: 0; }
}
@keyframes ilustra-logistica-flutuar {
  0%, 100% { transform: translate(0px, 0px); }
  50% { transform: translate(0px, -5px); }
}
`;

export function IlustracaoLogistica({ className }: { className?: string | undefined }) {
  return (
    <svg
      viewBox="40 80 840 460"
      role="img"
      aria-label="Ilustração de um centro de distribuição com caminhão"
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <defs>
        <filter id="ilustra-logistica-desfoque" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <style>{ESTILO}</style>

      {/* sombras de contato de tudo que está no chão */}
      <Sombra x={0} y={0} w={166} d={158} opacidade={0.35} />
      <Sombra
        x={ESTEIRA.inicio}
        y={ESTEIRA.y}
        w={ESTEIRA.fim - ESTEIRA.inicio}
        d={40}
        opacidade={0.25}
      />
      <Sombra x={380 + AVANCO} y={146} w={44} d={40} opacidade={0.3} />
      <Sombra x={344 + AVANCO} y={56} w={186} d={52} opacidade={0.18} />
      <Sombra x={206} y={-34} w={78} d={40} opacidade={0.35} />
      <Sombra x={60} y={196} w={92} d={66} opacidade={0.3} />
      <Sombra x={242} y={176} w={82} d={38} opacidade={0.25} />
      <Sombra x={262} y={40} w={34} d={18} opacidade={0.3} />
      <Sombra x={196} y={124} w={18} d={14} opacidade={0.3} />

      <Rack x={206} y={-34} />
      <Rack x={250} y={-34} />
      <Galpao />
      <Esteira />
      <Terminal />
      <g transform={`translate(${AVANCO} ${AVANCO / 2})`}>
        <Caminhao />
        <PaleteComCaixas />
      </g>
      <PilhaDestaque />
      <CartaoFlutuante />
    </svg>
  );
}

/** Lado da placa e vão entre placas, em unidades do mundo (o mesmo desenho da ilustração). */
const PLACA = 104;
const VAO = 8;
const PASSO = PLACA + VAO;

/** Uma placa do piso com o topo e as duas bordas visíveis, com o canto de cima em (cx, cy). */
function PlacaDoPiso({ cx, cy }: { cx: number; cy: number }) {
  const meia = PLACA / 2;
  const espessura = 6;
  return (
    <g>
      <polygon
        points={`${cx - PLACA},${cy + meia} ${cx},${cy + PLACA} ${cx},${cy + PLACA + espessura} ${cx - PLACA},${cy + meia + espessura}`}
        fill={COR.esq}
      />
      <polygon
        points={`${cx},${cy + PLACA} ${cx + PLACA},${cy + meia} ${cx + PLACA},${cy + meia + espessura} ${cx},${cy + PLACA + espessura}`}
        fill={COR.dir}
      />
      <polygon
        points={`${cx},${cy} ${cx + PLACA},${cy + meia} ${cx},${cy + PLACA} ${cx - PLACA},${cy + meia}`}
        fill={COR.topo}
      />
    </g>
  );
}

/**
 * Piso de placas isométricas que se repete pela tela inteira (fundo do login). O padrão tem duas
 * placas por célula (2·PASSO × PASSO) e repete as vizinhas para as bordas não cortarem.
 */
export function PisoIsometrico({ className }: { className?: string | undefined }) {
  const largura = 2 * PASSO;
  const altura = PASSO;
  const cantos: { cx: number; cy: number }[] = [];
  for (let i = -1; i <= 2; i++) {
    for (let j = -2; j <= 1; j++) {
      cantos.push({ cx: i * largura, cy: j * altura });
      cantos.push({ cx: i * largura + PASSO, cy: j * altura + altura / 2 });
    }
  }
  cantos.sort((a, b) => a.cy - b.cy);
  return (
    <svg aria-hidden className={className}>
      <defs>
        <pattern
          id="piso-isometrico"
          width={largura}
          height={altura}
          patternUnits="userSpaceOnUse"
          patternTransform="scale(1.7)"
        >
          <rect width={largura} height={altura} fill={COR.linha} fillOpacity={0.3} />
          {cantos.map((c) => (
            <PlacaDoPiso key={`${c.cx}:${c.cy}`} {...c} />
          ))}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#piso-isometrico)" />
    </svg>
  );
}
