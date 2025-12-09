// --- CONFIGURACIÓN GLOBAL ---
// PEGA AQUÍ EL ID QUE COPIASTE DE LA URL DE TU HOJA
const SHEET_ID = '1jj1md4oivyLxYLCxv8ilyR0xTT5F40drc6Gawu5EGtk'; 

function contabilizarFactura(idFactura, numeroFactura, fecha, concepto, base, tipoIva, total, nombrePaciente) {
  // CAMBIO CLAVE: Usamos openById en lugar de getActiveSpreadsheet
  const ss = SpreadsheetApp.openById(SHEET_ID);
  
  const sheetDiario = ss.getSheetByName('Libro_Diario');
  const sheetApuntes = ss.getSheetByName('Apuntes_Contables');
  
  // 1. Crear el Asiento (Cabecera)
  const idAsiento = Utilities.getUuid();
  // Calculamos numero asiento (simplificado, idealmente buscar max)
  const numeroAsiento = Math.max(0, sheetDiario.getLastRow() - 1) + 1; 
  
  sheetDiario.appendRow([
    idAsiento,
    numeroAsiento,
    fecha, 
    "Factura Venta: " + numeroFactura + " - " + nombrePaciente, 
    idFactura, 
    "Asentado", // Estado Directo
    "", "", "Sistema_Bot", new Date() 
  ]);

  // 2. Preparar los Apuntes (Líneas)
  
  // A. DEBE: Cliente (430000)
  sheetApuntes.appendRow([
    Utilities.getUuid(),
    idAsiento,
    "430000", // Cuenta Clientes (Asegúrate que existe en tu Plan_Contable)
    total,    // DEBE
    0,        // HABER
    "LIN_NUTRI", // Centro Coste por defecto (puedes pasar esto como argumento extra si quieres)
    "UBI_PROPIA"
  ]);

  // B. HABER: Ingreso (705000)
  sheetApuntes.appendRow([
    Utilities.getUuid(),
    idAsiento,
    "705000", 
    0,        
    base,     
    "LIN_NUTRI",
    "UBI_PROPIA"
  ]);

  // C. HABER: IVA Repercutido (477000)
  const cuotaIva = total - base;
  if (cuotaIva > 0) {
    sheetApuntes.appendRow([
      Utilities.getUuid(),
      idAsiento,
      "477000", 
      0,        
      cuotaIva, 
      "",       
      "" 
    ]);
  }
}
// Función para generar el Hash SHA-256 encadenado (VeriFactu)
function firmarFacturaVeriFactu(idFactura, numeroFactura, fecha, total, nifEmisor) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetFacturas = ss.getSheetByName('Facturas');
  const data = sheetFacturas.getDataRange().getValues();
  
  // 1. Encontrar la fila de la factura actual y la "Huella Anterior"
  let rowIndex = -1;
  let hashAnterior = "0000000000000000000000000000000000000000000000000000000000000000"; // Hash Génesis
  
  // Buscamos la fila actual
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == idFactura) { // Columna 0 es ID_Factura
      rowIndex = i + 1; // +1 porque los arrays son base-0 y las filas base-1
      break;
    }
  }
  
  if (rowIndex === -1) throw new Error("Factura no encontrada: " + idFactura);

  // Buscamos el hash de la factura ANTERIOR (Asumimos orden cronológico/secuencial en la hoja)
  // Estrategia simple: El registro válido inmediatamente arriba que tenga hash.
  for (let j = rowIndex - 2; j >= 1; j--) {
     // Asumimos que la columna 9 (índice 9, la décima) es VeriFactu_Hash. Ajustar si cambia estructura.
     let posibleHash = data[j][9]; 
     if (posibleHash && posibleHash.length > 10) {
       hashAnterior = posibleHash;
       break;
     }
  }

  // 2. Construir la Cadena de Registro (The Chain) [Fuente: 181]
  // Formato: HashAnterior + NIF + NumFactura + Fecha(ISO) + Importe
  // Aseguramos formato de fecha y números para consistencia
  const fechaISO = new Date(fecha).toISOString().split('T')[0]; 
  const importeFixed = parseFloat(total).toFixed(2);
  
  const cadenaOriginal = hashAnterior + nifEmisor + numeroFactura + fechaISO + importeFixed;
  
  // 3. Generar Hash SHA-256
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, cadenaOriginal, Utilities.Charset.UTF_8);
  
  // Convertir bytes a Hexadecimal (formato estándar legible)
  let txtHash = "";
  for (let k = 0; k < rawHash.length; k++) {
    let byte = rawHash[k];
    if (byte < 0) byte += 256;
    let byteStr = byte.toString(16);
    // Asegurar 2 caracteres (padding 0)
    if (byteStr.length == 1) byteStr = "0" + byteStr;
    txtHash += byteStr;
  }
  
  // 4. Guardar la Huella en la Factura
  // Asumimos que VeriFactu_Hash es la columna 10 (J)
  sheetFacturas.getRange(rowIndex, 10).setValue(txtHash);
  
  return txtHash;
}
function setupAntropometria() {
  const ss = SpreadsheetApp.openById(SHEET_ID); // Usa la constante global que ya definimos
  const sheetName = 'Antropometria';
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Cabeceras basadas en el Informe Técnico [Fuente: 98-105]
    const headers = [
      'ID_Medicion', 
      'Ref_Paciente', // Foreign Key
      'Fecha', 
      'Peso_kg', 
      'Altura_cm', 
      'Masa_Grasa_Porc', // % Grasa
      'Masa_Muscular_kg', 
      'Perimetro_Cintura_cm',
      'Perimetro_Cadera_cm',
      'Foto_Progreso', // Para subir fotos del antes/después
      'Notas_Revision'
    ];
    
    sheet.appendRow(headers);
    // Formato profesional
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight("bold").setBackground("#fff2cc").setBorder(true, true, true, true, true, true);
    sheet.setFrozenRows(1);
  }
}
function setupUsuarios() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetName = 'Usuarios';
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = ['Email', 'Nombre_Completo', 'Rol', 'Estado'];
    sheet.appendRow(headers);
    sheet.getRange("A1:D1").setFontWeight("bold").setBackground("#e6b8af"); // Color rojizo (Seguridad)
    
    // Crear el primer usuario (TÚ) como Admin
    const myEmail = Session.getActiveUser().getEmail();
    sheet.appendRow([myEmail, "Administrador Principal", "Admin", "Activo"]);
  }
}