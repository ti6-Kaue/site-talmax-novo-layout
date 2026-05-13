/**
 * Rotas de analytics proprio do site.
 * Registra eventos anonimos e entrega o resumo para o painel admin.
 */
const express = require('express');
const { requireAdminSession } = require('../auth/adminSession');
const { wrapError } = require('../utils/errorHandling');
const {
  getAnalyticsSummary,
  recordAnalyticsEvent
} = require('../services/analyticsService');

const router = express.Router();

router.post('/events', async (req, res, next) => {
  try {
    const result = await recordAnalyticsEvent(req.body || {});

    if (!result.ok) {
      return res.status(400).json({
        error: 'Evento de analytics invalido.',
        details: result.details
      });
    }

    return res.status(204).send();
  } catch (error) {
    return next(wrapError(error, {
      publicMessage: 'Erro ao registrar evento de analytics.'
    }));
  }
});

router.get('/summary', requireAdminSession, async (req, res, next) => {
  try {
    const summary = await getAnalyticsSummary({ days: req.query.days });
    return res.json(summary);
  } catch (error) {
    return next(wrapError(error, {
      publicMessage: 'Erro ao carregar analytics do dashboard.'
    }));
  }
});

module.exports = router;
