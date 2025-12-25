// lib/import-parsers.ts
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { parseString } from 'xml2js';

export interface ParsedData {
  headers: string[];
  rows: string[][];
}

/**
 * Parse CSV file using PapaParse for robust CSV handling
 */
export async function parseCSVFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error('CSV parsing error: ' + results.errors[0].message));
          return;
        }

        const data = results.data as string[][];
        if (data.length === 0) {
          reject(new Error('CSV file is empty'));
          return;
        }

        const headers = data[0];
        const rows = data.slice(1).filter(row => row.some(cell => cell.trim()));

        resolve({ headers, rows });
      },
      error: (error) => {
        reject(error);
      },
      skipEmptyLines: true,
    });
  });
}

/**
 * Parse XLSX/XLS file using SheetJS
 */
export async function parseXLSXFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Failed to read file'));
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });

        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // Convert to array of arrays
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }

        const headers = jsonData[0];
        const rows = jsonData.slice(1).filter(row => row.some(cell => cell && String(cell).trim()));

        resolve({ headers, rows });
      } catch (error) {
        reject(new Error('Failed to parse Excel file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
}

/**
 * Parse TXT file (tab-delimited or comma-delimited)
 */
export async function parseTXTFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          reject(new Error('Failed to read file'));
          return;
        }

        const lines = text.split(/\r?\n/).filter(line => line.trim());

        if (lines.length === 0) {
          reject(new Error('TXT file is empty'));
          return;
        }

        // Detect delimiter (tab or comma)
        const firstLine = lines[0];
        const delimiter = firstLine.includes('\t') ? '\t' : ',';

        // Parse lines
        const allRows = lines.map(line =>
          line.split(delimiter).map(cell => cell.trim())
        );

        const headers = allRows[0];
        const rows = allRows.slice(1).filter(row => row.some(cell => cell.trim()));

        resolve({ headers, rows });
      } catch (error) {
        reject(new Error('Failed to parse TXT file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Parse XML file
 */
export async function parseXMLFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const xmlText = e.target?.result as string;
        if (!xmlText) {
          reject(new Error('Failed to read file'));
          return;
        }

        parseString(xmlText, { explicitArray: false }, (err, result) => {
          if (err) {
            reject(new Error('Failed to parse XML: ' + err.message));
            return;
          }

          try {
            // Try to extract data from common XML structures
            let contacts: any[] = [];

            // Try different XML structures
            if (result.contacts?.contact) {
              contacts = Array.isArray(result.contacts.contact)
                ? result.contacts.contact
                : [result.contacts.contact];
            } else if (result.root?.row) {
              contacts = Array.isArray(result.root.row)
                ? result.root.row
                : [result.root.row];
            } else if (result.data?.record) {
              contacts = Array.isArray(result.data.record)
                ? result.data.record
                : [result.data.record];
            } else {
              // Generic: use first child array found
              const rootKey = Object.keys(result)[0];
              const rootData = result[rootKey];
              const firstArrayKey = Object.keys(rootData).find(key =>
                Array.isArray(rootData[key]) || typeof rootData[key] === 'object'
              );

              if (firstArrayKey) {
                const data = rootData[firstArrayKey];
                contacts = Array.isArray(data) ? data : [data];
              }
            }

            if (contacts.length === 0) {
              reject(new Error('No contacts found in XML file'));
              return;
            }

            // Extract headers from first contact
            const headers = Object.keys(contacts[0]);

            // Convert to rows
            const rows = contacts.map(contact =>
              headers.map(header => {
                const value = contact[header];
                return value ? String(value) : '';
              })
            );

            resolve({ headers, rows });
          } catch (error) {
            reject(new Error('Failed to extract data from XML: ' + (error as Error).message));
          }
        });
      } catch (error) {
        reject(new Error('Failed to parse XML file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Parse JSON file
 */
export async function parseJSONFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const jsonText = e.target?.result as string;
        if (!jsonText) {
          reject(new Error('Failed to read file'));
          return;
        }

        const data = JSON.parse(jsonText);

        let contacts: any[] = [];

        // Handle different JSON structures
        if (Array.isArray(data)) {
          contacts = data;
        } else if (data.contacts && Array.isArray(data.contacts)) {
          contacts = data.contacts;
        } else if (data.data && Array.isArray(data.data)) {
          contacts = data.data;
        } else if (data.records && Array.isArray(data.records)) {
          contacts = data.records;
        } else {
          // Try to find first array property
          const arrayKey = Object.keys(data).find(key => Array.isArray(data[key]));
          if (arrayKey) {
            contacts = data[arrayKey];
          } else {
            // Single object, wrap in array
            contacts = [data];
          }
        }

        if (contacts.length === 0) {
          reject(new Error('No contacts found in JSON file'));
          return;
        }

        // Extract headers from first contact
        const headers = Object.keys(contacts[0]);

        // Convert to rows
        const rows = contacts.map(contact =>
          headers.map(header => {
            const value = contact[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
          })
        );

        resolve({ headers, rows });
      } catch (error) {
        reject(new Error('Failed to parse JSON file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Main parser function that routes to appropriate parser based on file type
 */
export async function parseFile(file: File, type: 'csv' | 'xlsx' | 'txt' | 'xml' | 'json'): Promise<ParsedData> {
  switch (type) {
    case 'csv':
      return parseCSVFile(file);
    case 'xlsx':
      return parseXLSXFile(file);
    case 'txt':
      return parseTXTFile(file);
    case 'xml':
      return parseXMLFile(file);
    case 'json':
      return parseJSONFile(file);
    default:
      throw new Error('Unsupported file type');
  }
}
