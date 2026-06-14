import { prisma } from './client';

const categorias = [
  { nome: 'Bebidas', icone: 'cafe-outline', cor: '#7c3aed' },
  { nome: 'Alimentos', icone: 'fast-food-outline', cor: '#059669' },
  { nome: 'Limpeza', icone: 'sparkles-outline', cor: '#0284c7' },
  { nome: 'Higiene', icone: 'heart-outline', cor: '#db2777' },
  { nome: 'Outros', icone: 'cube-outline', cor: '#d97706' },
];

const produtos = [
  { nome: 'Cafe Especial 250g', categoria: 'Bebidas', quantidade: 4, quantidadeMinima: 10, preco: 32.9, unidade: 'un' },
  { nome: 'Agua Mineral 500ml', categoria: 'Bebidas', quantidade: 48, quantidadeMinima: 24, preco: 2.5, unidade: 'un' },
  { nome: 'Suco de Laranja 1L', categoria: 'Bebidas', quantidade: 6, quantidadeMinima: 12, preco: 8.9, unidade: 'un' },
  { nome: 'Arroz Branco 5kg', categoria: 'Alimentos', quantidade: 15, quantidadeMinima: 5, preco: 28, unidade: 'un' },
  { nome: 'Feijao Carioca 1kg', categoria: 'Alimentos', quantidade: 3, quantidadeMinima: 8, preco: 9.5, unidade: 'un' },
  { nome: 'Azeite Extra Virgem', categoria: 'Alimentos', quantidade: 2, quantidadeMinima: 5, preco: 45, unidade: 'un' },
  { nome: 'Detergente 500ml', categoria: 'Limpeza', quantidade: 22, quantidadeMinima: 10, preco: 3.99, unidade: 'un' },
  { nome: 'Sabao em Po 3kg', categoria: 'Limpeza', quantidade: 0, quantidadeMinima: 4, preco: 24.9, unidade: 'un' },
  { nome: 'Shampoo 400ml', categoria: 'Higiene', quantidade: 9, quantidadeMinima: 5, preco: 18.9, unidade: 'un' },
  { nome: 'Papel Toalha', categoria: 'Outros', quantidade: 12, quantidadeMinima: 6, preco: 7.5, unidade: 'un' },
];

function normalizar(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function main() {
  console.log('Executando seed...');

  const categoriasDoBanco = await prisma.categoria.findMany();
  const categoriasPorNome = new Map(
    categoriasDoBanco.map((categoria) => [normalizar(categoria.nome), categoria])
  );

  for (const data of categorias) {
    const chave = normalizar(data.nome);

    if (!categoriasPorNome.has(chave)) {
      const criada = await prisma.categoria.create({ data });
      categoriasPorNome.set(chave, criada);
    }
  }

  const produtosDoBanco = await prisma.produto.findMany();
  const nomesExistentes = new Set(produtosDoBanco.map((produto) => normalizar(produto.nome)));
  let produtosCriados = 0;

  for (const data of produtos) {
    if (nomesExistentes.has(normalizar(data.nome))) continue;

    const categoria = categoriasPorNome.get(normalizar(data.categoria));
    if (!categoria) throw new Error(`Categoria nao encontrada: ${data.categoria}`);

    await prisma.$transaction(async (tx) => {
      const produto = await tx.produto.create({
        data: {
          nome: data.nome,
          categoriaId: categoria.id,
          quantidade: data.quantidade,
          quantidadeMinima: data.quantidadeMinima,
          preco: data.preco,
          unidade: data.unidade,
        },
      });

      if (data.quantidade > 0) {
        await tx.movimentacao.create({
          data: {
            produtoId: produto.id,
            tipo: 'entrada',
            quantidade: data.quantidade,
            observacao: 'Estoque inicial do seed',
          },
        });
      }
    });

    nomesExistentes.add(normalizar(data.nome));
    produtosCriados += 1;
  }

  const totalProdutos = await prisma.produto.count();
  console.log(`Seed concluido: ${produtosCriados} produtos criados, ${totalProdutos} no total.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
