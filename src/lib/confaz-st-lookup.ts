/**
 * Reexporta o núcleo ST/CEST; `ConfazStItem` do Prisma é compatível com `ConfazStRow`.
 */
export type { ConfazStRow } from "./confaz-st-core";
export {
  normalizeCestDigits,
  formatCestForDisplay,
  isConfazVigente,
  findConfazRowsForNcm,
  parseEmitDate,
} from "./confaz-st-core";
