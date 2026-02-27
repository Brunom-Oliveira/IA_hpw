const { MAX_CONTEXT_WINDOW } = require("./rag.constants");

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function assertPromptFitsWindow(prompt) {
  const promptTokens = estimateTokens(prompt);
  if (promptTokens > MAX_CONTEXT_WINDOW) {
    const error = new Error(`Prompt excede janela de contexto (${promptTokens}/${MAX_CONTEXT_WINDOW})`);
    error.statusCode = 400;
    throw error;
  }
  return promptTokens;
}

function createQuestionTokenGuardMiddleware() {
  return (req, res, next) => {
    try {
      const question = req.body && typeof req.body.question === "string" ? req.body.question : "";
      const questionTokens = estimateTokens(question);
      if (questionTokens > MAX_CONTEXT_WINDOW) {
        return res.status(400).json({
          error: `Pergunta excede limite de tokens estimado (${questionTokens}/${MAX_CONTEXT_WINDOW})`,
        });
      }
      return next();
    } catch (_error) {
      return res.status(500).json({ error: "Falha ao validar tokens da pergunta" });
    }
  };
}

module.exports = {
  estimateTokens,
  assertPromptFitsWindow,
  createQuestionTokenGuardMiddleware,
};

