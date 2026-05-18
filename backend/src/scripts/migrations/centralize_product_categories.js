/**
 * Move a categoria/subcategoria do produto para a tabela produtos.
 * Depois remove as antigas tabelas de relacionamento produto_categorias e produto_sub_categorias.
 */
const db = require('../../config/database');

async function runOptionalQuery(sql, message) {
  try {
    await db.query(sql);
    console.log(message);
  } catch (err) {
    console.log(`${message} ignorado: ${err.message}`);
  }
}

async function migrate() {
  try {
    await runOptionalQuery(
      'ALTER TABLE produtos ADD COLUMN category_id INT DEFAULT NULL AFTER id',
      'Coluna produtos.category_id criada'
    );

    await runOptionalQuery(
      'ALTER TABLE produtos ADD COLUMN sub_category_id INT DEFAULT NULL AFTER category_id',
      'Coluna produtos.sub_category_id criada'
    );

    await runOptionalQuery(
      `
        UPDATE produtos p
        JOIN (
          SELECT product_id, MIN(category_id) AS category_id
          FROM produto_categorias
          GROUP BY product_id
        ) pc ON pc.product_id = p.id
        SET p.category_id = pc.category_id
        WHERE p.category_id IS NULL
      `,
      'Categorias copiadas para produtos.category_id'
    );

    await runOptionalQuery(
      `
        UPDATE produtos p
        JOIN (
          SELECT product_id, MIN(sub_category_id) AS sub_category_id
          FROM produto_sub_categorias
          GROUP BY product_id
        ) psc ON psc.product_id = p.id
        JOIN sub_categorias sc ON sc.id = psc.sub_category_id
        SET
          p.sub_category_id = psc.sub_category_id,
          p.category_id = sc.category_id
        WHERE p.sub_category_id IS NULL
      `,
      'Subcategorias copiadas para produtos.sub_category_id'
    );

    await runOptionalQuery(
      'DROP TABLE IF EXISTS produto_sub_categorias',
      'Tabela produto_sub_categorias removida'
    );

    await runOptionalQuery(
      'DROP TABLE IF EXISTS produto_categorias',
      'Tabela produto_categorias removida'
    );

    console.log('Migracao concluida.');
    process.exit(0);
  } catch (err) {
    console.error('Erro ao centralizar categorias dos produtos:', err);
    process.exit(1);
  }
}

migrate();
