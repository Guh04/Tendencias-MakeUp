import type {
  AppState,
  Client,
  PaymentMethod,
  Product,
  Sale,
  Settings,
  Supplier,
  Transaction,
} from "@tendencias/core/types";
import { round2 } from "@tendencias/core/format";

export const STATE_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  storeName: "Tendencias MakeUp",
  logo: "",
  phone: "(11) 90000-0000",
  email: "contato@exemplo.com",
  address: "Rua das Flores, 123 - Centro",
  cnpj: "00.000.000/0001-00",
  owner: "Responsável (demonstração)",
  instagram: "@tendenciasmakeup",
  defaultMinStock: 5,
  defaultPayment: "pix",
  lowStockAlerts: true,
};

export function createEmptyState(isDemo = false): AppState {
  return {
    version: STATE_VERSION,
    isDemo,
    products: [],
    clients: [],
    suppliers: [],
    sales: [],
    transactions: [],
    settings: { ...DEFAULT_SETTINGS },
    saleCounter: 0,
  };
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DESCRIPTIONS: Record<string, string> = {
  Bases: "Base de cobertura média com acabamento natural e longa duração.",
  Corretivos: "Corretivo de alta cobertura, textura leve e confortável.",
  Pós: "Pó de acabamento sedoso que controla o brilho sem pesar.",
  Blushes: "Blush pigmentado de fácil esfumação e toque aveludado.",
  Batons: "Batom de alta pigmentação e conforto o dia todo.",
  Gloss: "Gloss com brilho intenso e efeito volumizador.",
  "Máscaras de cílios": "Máscara que alonga, define e separa os cílios.",
  Sombras: "Paleta de sombras com acabamentos matte e cintilante.",
  Delineadores: "Delineador à prova d'água com traço preciso.",
  Skincare: "Cuidado diário para pele hidratada e luminosa.",
  Perfumes: "Fragrância floral com notas de fundo amadeiradas.",
  Acessórios: "Acessório profissional para aplicação perfeita.",
};

// nome, sku, categoria, marca, custo, venda, estoque, mínimo, fornecedor (índice)
const PRODUCTS: [string, string, string, string, number, number, number, number, number][] = [
  ["Base Líquida Soft Matte 30ml", "BAS-001", "Bases", "Veloura", 28, 69.9, 24, 6, 0],
  ["Base Cushion Glow", "BAS-002", "Bases", "Aurea", 35, 89.9, 4, 6, 0],
  ["Base Stick Cobertura Total", "BAS-003", "Bases", "Nuance", 22, 59.9, 15, 5, 1],
  ["Corretivo Líquido Alta Cobertura", "COR-001", "Corretivos", "Veloura", 11, 32.9, 38, 8, 0],
  ["Corretivo Iluminador Pen", "COR-002", "Corretivos", "Rosé Atelier", 14, 39.9, 19, 6, 1],
  ["Pó Compacto Translúcido", "PO-001", "Pós", "Nuance", 13, 36.9, 27, 6, 1],
  ["Pó Solto Banana 25g", "PO-002", "Pós", "Aurea", 16, 44.9, 3, 5, 0],
  ["Blush Rosé Petal", "BLU-001", "Blushes", "Rosé Atelier", 12, 34.9, 31, 6, 2],
  ["Blush Cremoso Pêssego", "BLU-002", "Blushes", "Bella Doce", 10, 29.9, 22, 6, 2],
  ["Batom Matte Rosa Queimado", "BAT-001", "Batons", "Rosé Atelier", 9, 29.9, 54, 10, 2],
  ["Batom Matte Nude Cashmere", "BAT-002", "Batons", "Rosé Atelier", 9, 29.9, 47, 10, 2],
  ["Batom Cremoso Vermelho Clássico", "BAT-003", "Batons", "Veloura", 10, 32.9, 36, 10, 2],
  ["Batom Líquido Velvet Terracota", "BAT-004", "Batons", "Aurea", 12, 37.9, 2, 8, 0],
  ["Gloss Labial Cristal", "GLO-001", "Gloss", "Bella Doce", 6, 22.9, 61, 10, 2],
  ["Gloss Volumizador Mel", "GLO-002", "Gloss", "Aurea", 8, 27.9, 33, 8, 0],
  ["Máscara de Cílios Volume Extremo", "MAS-001", "Máscaras de cílios", "Veloura", 13, 38.9, 28, 8, 1],
  ["Máscara de Cílios À Prova D'água", "MAS-002", "Máscaras de cílios", "Nuance", 15, 42.9, 17, 8, 1],
  ["Paleta de Sombras Nude 12 cores", "SOM-001", "Sombras", "Rosé Atelier", 24, 69.9, 12, 4, 3],
  ["Paleta de Sombras Sunset 9 cores", "SOM-002", "Sombras", "Bella Doce", 20, 59.9, 9, 4, 3],
  ["Sombra Líquida Glitter Dourado", "SOM-003", "Sombras", "Aurea", 8, 24.9, 0, 5, 0],
  ["Delineador Gel Preto Intenso", "DEL-001", "Delineadores", "Nuance", 7, 24.9, 40, 8, 1],
  ["Delineador Caneta Ultra Fino", "DEL-002", "Delineadores", "Veloura", 8, 27.9, 29, 8, 1],
  ["Sérum Facial Vitamina C 30ml", "SKI-001", "Skincare", "Lumière", 32, 89.9, 14, 4, 4],
  ["Hidratante Facial Ácido Hialurônico", "SKI-002", "Skincare", "Lumière", 26, 74.9, 18, 5, 4],
  ["Água Termal Facial 150ml", "SKI-003", "Skincare", "Lumière", 14, 39.9, 25, 6, 4],
  ["Perfume Fleur de Nuit 50ml", "PER-001", "Perfumes", "Lumière", 58, 149.9, 8, 3, 4],
  ["Body Splash Baunilha 200ml", "PER-002", "Perfumes", "Bella Doce", 19, 54.9, 16, 4, 2],
  ["Pincel Kabuki Esfumar", "ACE-001", "Acessórios", "Rosé Atelier", 11, 34.9, 21, 5, 3],
  ["Kit 8 Pincéis Profissionais", "ACE-002", "Acessórios", "Veloura", 38, 99.9, 7, 3, 3],
  ["Esponja de Maquiagem Gota", "ACE-003", "Acessórios", "Nuance", 4, 14.9, 70, 15, 3],
];

const SUPPLIERS: Omit<Supplier, "id">[] = [
  {
    name: "Distribuidora Veloura Cosméticos",
    contact: "Mariana Costa",
    phone: "(11) 90000-1001",
    email: "vendas@fornecedor-demo1.exemplo",
    notes: "Pedido mínimo de R$ 500. Entrega em até 5 dias úteis.",
  },
  {
    name: "Nuance Atacado de Beleza",
    contact: "Rafael Lima",
    phone: "(11) 90000-1002",
    email: "comercial@fornecedor-demo2.exemplo",
    notes: "Frete grátis acima de R$ 800. Pagamento em até 30 dias.",
  },
  {
    name: "Rosé Atelier & Bella Doce",
    contact: "Camila Ferreira",
    phone: "(21) 90000-1003",
    email: "pedidos@fornecedor-demo3.exemplo",
    notes: "Lançamentos mensais. Aceita PIX com 3% de desconto.",
  },
  {
    name: "Casa dos Pincéis Profissional",
    contact: "Juliana Alves",
    phone: "(31) 90000-1004",
    email: "contato@fornecedor-demo4.exemplo",
    notes: "Acessórios e paletas. Troca em até 15 dias.",
  },
  {
    name: "Lumière Skincare Brasil",
    contact: "Patrícia Souza",
    phone: "(11) 90000-1005",
    email: "atendimento@fornecedor-demo5.exemplo",
    notes: "Produtos com validade controlada. Lote sob consulta.",
  },
];

const CLIENT_NAMES = [
  "Ana Beatriz Oliveira",
  "Camila Rodrigues",
  "Fernanda Martins",
  "Juliana Pereira",
  "Larissa Santos",
  "Mariana Almeida",
  "Patrícia Gomes",
  "Renata Carvalho",
  "Thaís Ribeiro",
  "Vanessa Barbosa",
];

export function createSeedState(now = new Date()): AppState {
  const rand = rng(2024);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  let n = 0;
  const id = (p: string) => `${p}-${++n}`;

  const daysAgo = (d: number, hour = 12, min = 0) => {
    const x = new Date(now);
    x.setDate(x.getDate() - d);
    x.setHours(hour, min, 0, 0);
    return x;
  };

  const suppliers: Supplier[] = SUPPLIERS.map((s) => ({ ...s, id: id("sup") }));

  const products: Product[] = PRODUCTS.map((p, i) => ({
    id: id("prod"),
    name: p[0],
    sku: p[1],
    category: p[2],
    brand: p[3],
    description: DESCRIPTIONS[p[2]],
    costPrice: p[4],
    salePrice: p[5],
    stock: p[6],
    minStock: p[7],
    supplierId: suppliers[p[8]].id,
    createdAt: daysAgo(90 - i).toISOString(),
  }));

  const clients: Client[] = CLIENT_NAMES.map((name, i) => ({
    id: id("cli"),
    name,
    phone: `(11) 9${String(1000 + i * 137).padStart(4, "0")}-${String(2000 + i * 211).slice(0, 4)}`,
    email: `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}${i + 1}@exemplo.com`,
    createdAt: daysAgo(80 - i * 6).toISOString(),
  }));

  // Produtos "populares" têm mais chance de aparecer nas vendas
  const weights = products.map((p, i) => (i < 14 ? 3 : 1) + (p.category === "Batons" ? 3 : 0));
  const pool = weights.flatMap((w, i) => Array(w).fill(i) as number[]);
  const payments: PaymentMethod[] = ["pix", "pix", "pix", "credito", "credito", "debito", "dinheiro"];

  const sales: Sale[] = [];
  let counter = 0;
  for (let d = 29; d >= 0; d--) {
    const count = d === 0 ? 3 : 1 + Math.floor(rand() * 4);
    const times: Date[] = [];
    for (let k = 0; k < count; k++) {
      const t =
        d === 0
          ? new Date(now.getTime() - Math.floor(rand() * Math.max(1, now.getHours() * 60 + now.getMinutes())) * 60000)
          : daysAgo(d, 9 + Math.floor(rand() * 10), Math.floor(rand() * 60));
      times.push(t);
    }
    times.sort((a, b) => a.getTime() - b.getTime());
    for (const date of times) {
      const lines = 1 + Math.floor(rand() * 3);
      const used = new Set<number>();
      const items = [];
      for (let l = 0; l < lines; l++) {
        const idx = pick(pool);
        if (used.has(idx)) continue;
        used.add(idx);
        const p = products[idx];
        items.push({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          qty: 1 + Math.floor(rand() * 2),
          unitPrice: p.salePrice,
          unitCost: p.costPrice,
        });
      }
      const subtotal = round2(items.reduce((s, i) => s + i.qty * i.unitPrice, 0));
      const discount = rand() < 0.2 ? round2(subtotal * 0.05) : 0;
      counter++;
      sales.push({
        id: id("sale"),
        number: counter,
        date: date.toISOString(),
        clientId: rand() < 0.7 ? pick(clients).id : null,
        items,
        subtotal,
        discount,
        total: round2(subtotal - discount),
        payment: pick(payments),
      });
    }
  }

  const tx = (
    d: number,
    type: Transaction["type"],
    category: string,
    description: string,
    amount: number,
  ): Transaction => ({
    id: id("tx"),
    date: daysAgo(d, 10).toISOString(),
    type,
    category,
    description,
    amount,
  });

  const transactions: Transaction[] = [
    tx(28, "entrada", "Aporte", "Aporte inicial de capital de giro (demo)", 3000),
    tx(27, "saida", "Aluguel", "Aluguel da loja", 1800),
    tx(25, "saida", "Compra de estoque", "Reposição - Distribuidora Veloura", 1350),
    tx(21, "saida", "Marketing", "Impulsionamento de posts", 220),
    tx(18, "saida", "Compra de estoque", "Reposição - Rosé Atelier & Bella Doce", 980),
    tx(14, "saida", "Energia e água", "Conta de energia", 310),
    tx(14, "saida", "Internet e telefone", "Internet e telefone", 149.9),
    tx(10, "saida", "Embalagens", "Sacolas e caixas personalizadas", 265),
    tx(7, "saida", "Salários", "Auxiliar de loja (parcial)", 1200),
    tx(4, "saida", "Compra de estoque", "Reposição - Lumière Skincare", 720),
    tx(2, "saida", "Impostos e taxas", "Taxas de maquininha", 185.4),
  ];

  return {
    version: STATE_VERSION,
    isDemo: true,
    products,
    clients,
    suppliers,
    sales,
    transactions,
    settings: { ...DEFAULT_SETTINGS },
    saleCounter: counter,
  };
}
