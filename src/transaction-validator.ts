import { getUTXOKey, Transaction, TransactionInput, UTXO } from './types';
import { UTXOPoolManager } from './utxo-pool';
import { verify } from './utils/crypto';
import {
  ValidationResult,
  ValidationError,
  VALIDATION_ERRORS,
  createValidationError
} from './errors';

export class TransactionValidator {
  constructor(private utxoPool: UTXOPoolManager) {}

  /**
   * Validate a transaction
   * @param {Transaction} transaction - The transaction to validate
   * @returns {ValidationResult} The validation result
   */
    validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = [];

    // Set para rastrear los UTXOs que ya fueron referenciados y detectar doble gasto
    const referenciasVistas = new Set<string>();

    
    // Suma de montos de entradas y salidas
    let inputTotal = 0;
    let outputTotal = 0;
    
    // 1) Validar entradas
    for (const [i, entrada] of transaction.inputs.entries()) {
      // Genera una clave única para este UTXO
      const claveRef = getUTXOKey(entrada.utxoId);

      // 4) Doble gasto dentro de la misma transacción
      if (referenciasVistas.has(claveRef)) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.DOUBLE_SPENDING,
            `Entrada #${i}: UTXO referenciado más de una vez (${claveRef})`
          )
        );
        continue; // Pasamos a la siguiente entrada
      }
      referenciasVistas.add(claveRef);

      // 1) Verificación de existencia de UTXO en el pool
      const utxo: UTXO | null  = this.utxoPool.getUTXO(entrada.utxoId.txId, entrada.utxoId.outputIndex);

      if (!utxo) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.UTXO_NOT_FOUND,
            `Entrada #${i}: UTXO no encontrado (${claveRef})`
          )
        );
        continue; // No se puede validar esta entrada, seguimos con la siguiente
      }

      // 3) Verificación de firma
      const datosTransaccion =  this.createTransactionDataForSigning_(transaction);
      const firmaValida = verify(datosTransaccion, entrada.signature, entrada.owner);

      if (!firmaValida) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.INVALID_SIGNATURE,
            `Entrada #${i}: firma inválida`
          )
        );
      }

      // Sumar monto de entrada para luego verificar el balance
      inputTotal += utxo.amount;
    }

    // 2) Verificación de outputs
    for (const [i, out] of transaction.outputs.entries()) {
      // Rechazar montos nulos, negativos o cero
      if (out.amount == null || out.amount <= 0) {
        errors.push(
          createValidationError(
            VALIDATION_ERRORS.NEGATIVE_AMOUNT,
            `Output #${i}: monto inválido (${out.amount})`
          )
        );
        continue; // Pasamos al siguiente output
      }
      // Sumar monto de salida para luego verificar balance
      outputTotal += out.amount;
    }

    // 2) Verificación de balance
    // Las sumas de entradas y salidas deben coincidir
    if (inputTotal !== outputTotal) {
      errors.push(
        createValidationError(
          VALIDATION_ERRORS.AMOUNT_MISMATCH,
          `Suma de entradas (${inputTotal}) != suma de salidas (${outputTotal})`
        )
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a deterministic string representation of the transaction for signing
   * This excludes the signatures to prevent circular dependencies
   * @param {Transaction} transaction - The transaction to create a data for signing
   * @returns {string} The string representation of the transaction for signing
   */
  private createTransactionDataForSigning_(transaction: Transaction): string {
    const unsignedTx = {
      id: transaction.id,
      inputs: transaction.inputs.map(input => ({
        utxoId: input.utxoId,
        owner: input.owner
      })),
      outputs: transaction.outputs,
      timestamp: transaction.timestamp
    };

    return JSON.stringify(unsignedTx);
  }
}
