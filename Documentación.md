# Tarea 1

En mi implementación, el método `validateTransaction` aplica de forma sistemática todas
las reglas de validación requeridas. Para prevenir el doble gasto dentro de la misma
transacción, utilizo un `Set` que guarda claves únicas de cada entrada (`claveRef`),
obtenidas mediante `getUTXOKey(entrada.utxoId)`. Si una referencia aparece más de una
vez, se registra un error de tipo `DOUBLE_SPENDING`. Al mismo tiempo, se mantienen las
sumas `inputTotal` y `outputTotal` para verificar posteriormente la conservación de valor.

Cada entrada de la transacción se valida en varios pasos. Primero, se comprueba la
existencia del UTXO correspondiente en el pool mediante
`this.utxoPool.getUTXO(txId, outputIndex)`; si no se encuentra, se informa
`UTXO_NOT_FOUND`. En caso de existir, se verifica la autorización revisando la firma
digital con `verify(datosTransaccion, entrada.signature, entrada.owner)`. Si la firma no
coincide con el propietario del UTXO, se reporta `INVALID_SIGNATURE`. Los UTXOs válidos
van sumando su monto a `inputTotal`.

Finalmente, se recorren los outputs y se rechazan aquellos con montos nulos, cero o
negativos, registrando `NEGATIVE_AMOUNT` en caso necesario. Todos los montos válidos
se acumulan en `outputTotal`. Una vez procesadas las entradas y salidas, se verifica el
balance: el total de entradas debe coincidir con el de salidas, de lo contrario se marca
`AMOUNT_MISMATCH`. El método devuelve un `ValidationResult` que indica si la
transacción es válida y, en caso contrario, proporciona la lista detallada de errores.
