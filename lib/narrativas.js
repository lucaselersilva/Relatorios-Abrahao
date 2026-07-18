// Formato canônico da análise da IA, persistido em Report.narrativas (Json).
//
// MUDANÇA DE SHAPE (Fase 3 / F10): antes `narrativas` era apenas um array de
// destaques `{ titulo, texto, fonte }`. Agora é um objeto com três blocos:
//
//   {
//     sumarioExecutivo: string,                       // parágrafo de abertura
//     destaques:        [{ titulo, texto, fonte }],   // cartões (como antes)
//     pontosDeAtencao:  [{ titulo, texto, severidade }]
//   }
//
// `severidade` ∈ SEVERIDADES. Registros antigos (array puro) e nulos continuam
// válidos: normalizeNarrativas() converte qualquer entrada para o shape acima,
// para os geradores (.docx/PDF), a visualização web e o wizard lerem um formato
// só.

export const SEVERIDADES = ["alta", "media", "baixa"];

export function emptyNarrativas() {
  return { sumarioExecutivo: "", destaques: [], pontosDeAtencao: [] };
}

/**
 * Converte qualquer entrada (shape novo, shape legado em array, ou nulo) no
 * objeto canônico { sumarioExecutivo, destaques, pontosDeAtencao }.
 */
export function normalizeNarrativas(raw) {
  if (!raw) return emptyNarrativas();
  // Shape legado: array de destaques.
  if (Array.isArray(raw)) return { sumarioExecutivo: "", destaques: raw, pontosDeAtencao: [] };
  return {
    sumarioExecutivo: typeof raw.sumarioExecutivo === "string" ? raw.sumarioExecutivo : "",
    destaques: Array.isArray(raw.destaques) ? raw.destaques : [],
    pontosDeAtencao: Array.isArray(raw.pontosDeAtencao) ? raw.pontosDeAtencao : [],
  };
}

/** Severidade normalizada (default "media") — usada para escolher a cor do cartão. */
export function severidadeValida(s) {
  return SEVERIDADES.includes(s) ? s : "media";
}
