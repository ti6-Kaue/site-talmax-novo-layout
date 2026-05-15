/**
 * Define as rotas das secoes especiais do site.
 * Atualiza os produtos destacados de paginas como Upcera, Scanners e Impressoras 3D.
 */
const express = require('express');
const db = require('../../config/database');
const { requireAdminSession } = require('../auth/adminSession');
const {
  normalizeStoredProductExtraData,
  validateSpecialSectionPayload
} = require('../validation/productSchemas');
const {
  ensureProductDatabaseTables,
  PRODUCTS_TABLE_NAME
} = require('../services/productService');
const { wrapError } = require('../utils/errorHandling');

const router = express.Router();

const VALID_DISPLAY_MODES = new Set(['description', 'features', 'none']);

const normalizeDisplayMode = (value) => (
  VALID_DISPLAY_MODES.has(value) ? value : 'features'
);

const parseSectionLabel = (config) => (
  config.sectionKey ? config.sectionKey.toUpperCase() : config.flagColumn.toUpperCase()
);

const saveSpecialSectionProducts = async (req, res, next, config) => {
  const connection = await db.getConnection();

  try {
    const { selected_products } = validateSpecialSectionPayload(req.body || {});

    const normalizedProducts = selected_products
      .map((item) => ({
        id: item.id,
        order: Number(item.order) || 0,
        displayMode: normalizeDisplayMode(item.displayMode)
      }));

    const selectedIds = normalizedProducts.map((item) => item.id);
    const selectedIdSet = new Set(selectedIds);
    const selectedIdPlaceholders = selectedIds.map(() => '?').join(', ');

    await ensureProductDatabaseTables(connection);
    await connection.beginTransaction();

    const [affectedProducts] = await connection.query(
      `SELECT id, extra_data
       FROM ${PRODUCTS_TABLE_NAME}
       WHERE ${config.flagColumn} = TRUE${selectedIds.length > 0 ? ` OR id IN (${selectedIdPlaceholders})` : ''}`,
      selectedIds
    );
    const foundProductIdSet = new Set(affectedProducts.map((product) => Number(product.id)));
    const missingProductIds = selectedIds.filter((id) => !foundProductIdSet.has(id));

    if (missingProductIds.length > 0) {
      await connection.rollback().catch(() => {});
      return res.status(400).json({
        error: `Os seguintes produtos nao foram encontrados: ${missingProductIds.join(', ')}.`
      });
    }

    if (config.orderColumn) {
      await connection.query(`UPDATE ${PRODUCTS_TABLE_NAME} SET ${config.flagColumn} = FALSE, ${config.orderColumn} = 0`);
    } else {
      await connection.query(`UPDATE ${PRODUCTS_TABLE_NAME} SET ${config.flagColumn} = FALSE`);
    }

    for (const product of affectedProducts) {
      if (selectedIdSet.has(product.id)) continue;

      const extra = normalizeStoredProductExtraData(product.extra_data);
      if (config.sectionKey) {
        const specialSectionDisplay = { ...(extra.specialSectionDisplay || {}) };
        delete specialSectionDisplay[config.sectionKey];

        if (Object.keys(specialSectionDisplay).length === 0) {
          delete extra.specialSectionDisplay;
        } else {
          extra.specialSectionDisplay = specialSectionDisplay;
        }
      }

      if (config.extraOrderKey) {
        delete extra[config.extraOrderKey];
      }

      await connection.query(`UPDATE ${PRODUCTS_TABLE_NAME} SET extra_data = ? WHERE id = ?`, [JSON.stringify(extra), product.id]);
    }

    for (const item of normalizedProducts) {
      const existingProduct = affectedProducts.find((product) => product.id === item.id);
      const extra = normalizeStoredProductExtraData(existingProduct?.extra_data);
      if (config.sectionKey) {
        const specialSectionDisplay = { ...(extra.specialSectionDisplay || {}) };
        specialSectionDisplay[config.sectionKey] = item.displayMode;
        extra.specialSectionDisplay = specialSectionDisplay;
      }

      if (config.extraOrderKey) {
        extra[config.extraOrderKey] = item.order;
      }

      if (config.orderColumn) {
        await connection.query(
          `UPDATE ${PRODUCTS_TABLE_NAME} SET ${config.flagColumn} = TRUE, ${config.orderColumn} = ?, extra_data = ? WHERE id = ?`,
          [item.order, JSON.stringify(extra), item.id]
        );
      } else {
        await connection.query(
          `UPDATE ${PRODUCTS_TABLE_NAME} SET ${config.flagColumn} = TRUE, extra_data = ? WHERE id = ?`,
          [JSON.stringify(extra), item.id]
        );
      }
    }

    await connection.commit();
    return res.json({ message: config.successMessage });
  } catch (err) {
    await connection.rollback().catch(() => {});
    return next(wrapError(err, {
      publicMessage: `Erro ao salvar configuracao da secao ${parseSectionLabel(config)}.`,
      meta: { section: parseSectionLabel(config) }
    }));
  } finally {
    connection.release();
  }
};

router.put('/upcera/products', requireAdminSession, async (req, res, next) => {
  await saveSpecialSectionProducts(req, res, next, {
    flagColumn: 'is_upcera',
    orderColumn: 'upcera_order',
    sectionKey: 'upcera',
    successMessage: 'Produtos Upcera atualizados com sucesso!'
  });
});

router.put('/scanners/products', requireAdminSession, async (req, res, next) => {
  await saveSpecialSectionProducts(req, res, next, {
    flagColumn: 'is_scanner',
    orderColumn: 'scanner_order',
    sectionKey: 'scanners',
    successMessage: 'Produtos Scanners atualizados com sucesso!'
  });
});

router.put('/3d-printers/products', requireAdminSession, async (req, res, next) => {
  await saveSpecialSectionProducts(req, res, next, {
    flagColumn: 'is_3d_printer',
    orderColumn: 'printer_order',
    sectionKey: 'printers',
    successMessage: 'Produtos Impressoras 3D atualizados com sucesso!'
  });
});

router.put('/featured-products', requireAdminSession, async (req, res, next) => {
  await saveSpecialSectionProducts(req, res, next, {
    flagColumn: 'is_featured',
    extraOrderKey: 'featured_order',
    successMessage: 'Produtos em destaque atualizados com sucesso!'
  });
});

module.exports = router;
