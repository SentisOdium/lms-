import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileQueue } from './fileQueue.js';

/**
 * Ensure directory exists
 * @param {string} dirPath 
 */
export async function ensureDir(dirPath) {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * Safely read a JSON file. Returns defaultValue if file does not exist.
 * @param {string} filePath 
 * @param {any} defaultValue 
 * @returns {Promise<any>}
 */
export async function readJson(filePath, defaultValue = []) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const trimmed = raw.trim();
    if (!trimmed) return defaultValue;
    return JSON.parse(trimmed);
  } catch (err) {
    if (err.code === 'ENOENT') {
      await ensureDir(path.dirname(filePath));
      await writeJson(filePath, defaultValue);
      return defaultValue;
    }
    throw err;
  }
}

/**
 * Atomically writes data to a JSON file using a temp file and rename.
 * Serialized through fileQueue.
 * @param {string} filePath 
 * @param {any} data 
 * @returns {Promise<void>}
 */
export async function writeJson(filePath, data) {
  return fileQueue.enqueue(filePath, async () => {
    await ensureDir(path.dirname(filePath));
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const tempPath = `${filePath}.tmp.${randomSuffix}`;
    const payload = JSON.stringify(data, null, 2);

    await fs.promises.writeFile(tempPath, payload, 'utf-8');
    await fs.promises.rename(tempPath, filePath);
  });
}

/**
 * Reads, transforms, and writes back JSON data atomically under a queue lock.
 * Prevents lost updates during concurrent operations.
 * @param {string} filePath 
 * @param {(current: any) => Promise<any> | any} updaterFn 
 * @param {any} defaultValue 
 * @returns {Promise<any>} The updated data
 */
export async function updateJson(filePath, updaterFn, defaultValue = []) {
  return fileQueue.enqueue(filePath, async () => {
    let current;
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      current = raw.trim() ? JSON.parse(raw) : defaultValue;
    } catch (err) {
      if (err.code === 'ENOENT') {
        current = defaultValue;
      } else {
        throw err;
      }
    }

    const updated = await updaterFn(current);
    await ensureDir(path.dirname(filePath));
    const randomSuffix = crypto.randomBytes(6).toString('hex');
    const tempPath = `${filePath}.tmp.${randomSuffix}`;
    const payload = JSON.stringify(updated, null, 2);

    await fs.promises.writeFile(tempPath, payload, 'utf-8');
    await fs.promises.rename(tempPath, filePath);
    return updated;
  });
}

/**
 * Appends a single record as a JSON line to a JSONL file.
 * Serialized through fileQueue.
 * @param {string} filePath 
 * @param {object} record 
 * @returns {Promise<void>}
 */
export async function appendJsonl(filePath, record) {
  return fileQueue.enqueue(filePath, async () => {
    await ensureDir(path.dirname(filePath));
    const line = JSON.stringify(record) + '\n';
    await fs.promises.appendFile(filePath, line, 'utf-8');
  });
}

/**
 * Reads all records from a JSONL file.
 * @param {string} filePath 
 * @returns {Promise<Array<object>>}
 */
export async function readJsonl(filePath) {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
    return lines.map((line) => JSON.parse(line));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

