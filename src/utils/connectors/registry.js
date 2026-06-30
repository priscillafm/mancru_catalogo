import { ExcelConnector } from './excel.connector'

/**
 * Central registry of all available data source connectors.
 * To add a new connector: implement the interface and register it here.
 */
export const ConnectorRegistry = {
  excel:         ExcelConnector,
  // csv:          CsvConnector,        // future
  // google_sheets: GoogleSheetsConnector, // future
  // rest_api:     RestApiConnector,    // future
}

export function getConnector(type) {
  const connector = ConnectorRegistry[type]
  if (!connector) throw new Error(`Unknown connector type: "${type}"`)
  return connector
}
