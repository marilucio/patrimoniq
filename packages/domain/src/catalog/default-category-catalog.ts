import type { CategoryCatalogEntry } from "../types";

export const defaultCategoryCatalog: CategoryCatalogEntry[] = [
  {
    slug: "receitas",
    name: "Receitas",
    direction: "income",
    subcategories: [
      { slug: "salario", name: "Salario" },
      { slug: "freelance", name: "Freelance" },
      { slug: "renda-extra", name: "Renda extra" }
    ]
  },
  {
    slug: "moradia",
    name: "Moradia",
    direction: "expense",
    subcategories: [
      { slug: "aluguel", name: "Aluguel", nature: "fixed", essentiality: "essential" },
      { slug: "condominio", name: "Condominio", nature: "fixed", essentiality: "essential" },
      { slug: "casa-manutencao", name: "Casa e manutencao", nature: "extraordinary", essentiality: "important" }
    ]
  },
  {
    slug: "alimentacao-casa",
    name: "Alimentacao em casa",
    direction: "expense",
    subcategories: [
      { slug: "mercado", name: "Mercado", nature: "variable", essentiality: "essential" },
      { slug: "feira", name: "Feira", nature: "variable", essentiality: "essential" }
    ]
  },
  {
    slug: "alimentacao-fora",
    name: "Alimentacao fora",
    direction: "expense",
    subcategories: [
      { slug: "restaurantes", name: "Restaurantes", nature: "variable", essentiality: "important" },
      { slug: "delivery", name: "Delivery", nature: "variable", essentiality: "superfluous" }
    ]
  },
  {
    slug: "transporte",
    name: "Transporte",
    direction: "expense",
    subcategories: [
      { slug: "combustivel", name: "Combustivel", nature: "variable", essentiality: "important" },
      { slug: "app-mobilidade", name: "App de mobilidade", nature: "variable", essentiality: "important" },
      { slug: "manutencao-carro", name: "Manutencao do carro", nature: "extraordinary", essentiality: "important" }
    ]
  },
  {
    slug: "saude",
    name: "Saude",
    direction: "expense",
    subcategories: [
      { slug: "plano-saude", name: "Plano de saude", nature: "fixed", essentiality: "essential" },
      { slug: "farmacia", name: "Farmacia", nature: "variable", essentiality: "essential" },
      { slug: "consultas", name: "Consultas", nature: "variable", essentiality: "important" }
    ]
  },
  {
    slug: "educacao",
    name: "Educacao",
    direction: "expense",
    subcategories: [
      { slug: "cursos", name: "Cursos", nature: "variable", essentiality: "important" },
      { slug: "livros", name: "Livros", nature: "variable", essentiality: "important" }
    ]
  },
  {
    slug: "servicos",
    name: "Contas e servicos",
    direction: "expense",
    subcategories: [
      { slug: "energia-eletrica", name: "Energia eletrica", nature: "fixed", essentiality: "essential" },
      { slug: "agua", name: "Agua", nature: "fixed", essentiality: "essential" },
      { slug: "internet", name: "Internet", nature: "fixed", essentiality: "essential" },
      { slug: "telefonia", name: "Telefonia", nature: "fixed", essentiality: "important" }
    ]
  },
  {
    slug: "assinaturas",
    name: "Streaming e assinaturas",
    direction: "expense",
    subcategories: [
      { slug: "video", name: "Video", nature: "fixed", essentiality: "superfluous" },
      { slug: "musica", name: "Musica", nature: "fixed", essentiality: "superfluous" },
      { slug: "software", name: "Software", nature: "fixed", essentiality: "important" }
    ]
  },
  {
    slug: "lazer",
    name: "Lazer",
    direction: "expense",
    subcategories: [
      { slug: "passeios", name: "Passeios", nature: "variable", essentiality: "important" },
      { slug: "eventos", name: "Eventos", nature: "variable", essentiality: "superfluous" },
      { slug: "viagens", name: "Viagens", nature: "extraordinary", essentiality: "important" }
    ]
  },
  {
    slug: "impostos",
    name: "Impostos e taxas",
    direction: "expense",
    subcategories: [
      { slug: "iptu", name: "IPTU", nature: "fixed", essentiality: "important" },
      { slug: "ipva", name: "IPVA", nature: "extraordinary", essentiality: "important" },
      { slug: "outras-taxas", name: "Outras taxas", nature: "variable", essentiality: "important" }
    ]
  },
  {
    slug: "dividas",
    name: "Dividas e emprestimos",
    direction: "debt",
    subcategories: [
      { slug: "cartao-credito", name: "Cartao de credito", nature: "fixed", essentiality: "important" },
      { slug: "emprestimo-pessoal", name: "Emprestimo pessoal", nature: "fixed", essentiality: "important" },
      { slug: "financiamento", name: "Financiamento", nature: "fixed", essentiality: "important" }
    ]
  },
  {
    slug: "investimentos",
    name: "Investimentos",
    direction: "saving",
    subcategories: [
      { slug: "tesouro", name: "Tesouro", nature: "fixed", essentiality: "important" },
      { slug: "renda-fixa", name: "Renda fixa", nature: "fixed", essentiality: "important" },
      { slug: "renda-variavel", name: "Renda variavel", nature: "variable", essentiality: "important" }
    ]
  },
  {
    slug: "reserva",
    name: "Reserva de emergencia",
    direction: "saving",
    subcategories: [
      { slug: "reserva-principal", name: "Reserva principal", nature: "fixed", essentiality: "important" }
    ]
  },
  {
    slug: "presentes",
    name: "Presentes",
    direction: "expense",
    subcategories: [
      { slug: "datas-especiais", name: "Datas especiais", nature: "variable", essentiality: "important" }
    ]
  },
  {
    slug: "imprevistos",
    name: "Imprevistos",
    direction: "expense",
    subcategories: [
      { slug: "emergencias", name: "Emergencias", nature: "extraordinary", essentiality: "important" }
    ]
  }
];
