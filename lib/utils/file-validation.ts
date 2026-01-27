/**
 * File Validation Utilities
 *
 * Provides validation and utility functions for file uploads including:
 * - Extension validation against an allowlist
 * - File size validation (max 25MB)
 * - Storage path generation with collision prevention
 * - MIME type lookup
 * - File size formatting for display
 */

/**
 * List of allowed file extensions for uploads.
 * Includes images, PDFs, and Microsoft Office documents (modern and legacy).
 */
export const ALLOWED_EXTENSIONS = [
  // Images
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  // PDF
  '.pdf',
  // Office modern
  '.docx',
  '.xlsx',
  '.pptx',
  // Office legacy
  '.doc',
  '.xls',
  '.ppt',
] as const;

/**
 * Maximum allowed file size in bytes (25MB).
 */
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

/**
 * Mapping of file extensions to their MIME types.
 */
export const EXTENSION_MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx':
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.doc': 'application/msword',
  '.xls': 'application/vnd.ms-excel',
  '.ppt': 'application/vnd.ms-powerpoint',
};

/**
 * Type for allowed extension strings
 */
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/**
 * Extracts the file extension from a filename.
 *
 * @param filename - The filename to extract extension from
 * @returns The lowercase extension including the dot (e.g., '.pdf'), or empty string if no extension
 *
 * @example
 * getFileExtension('document.PDF') // returns '.pdf'
 * getFileExtension('no-extension') // returns ''
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Validates whether a file's extension is in the allowed list.
 *
 * @param filename - The filename to validate
 * @returns true if the extension is allowed, false otherwise
 *
 * @example
 * validateFileExtension('doc.pdf') // returns true
 * validateFileExtension('script.exe') // returns false
 */
export function validateFileExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ALLOWED_EXTENSIONS.includes(ext as AllowedExtension);
}

/**
 * Validates whether a file size is within the allowed limit.
 *
 * @param sizeInBytes - The file size in bytes
 * @returns true if the size is valid (> 0 and <= 25MB), false otherwise
 *
 * @example
 * validateFileSize(1000000) // returns true (1MB)
 * validateFileSize(30000000) // returns false (30MB exceeds limit)
 * validateFileSize(0) // returns false (empty file)
 */
export function validateFileSize(sizeInBytes: number): boolean {
  return sizeInBytes > 0 && sizeInBytes <= MAX_FILE_SIZE;
}

/**
 * Result type for file validation
 */
export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validates both file extension and size.
 *
 * @param filename - The filename to validate
 * @param sizeInBytes - The file size in bytes
 * @returns Object with valid: true if both checks pass, or valid: false with error message
 *
 * @example
 * validateFile('document.pdf', 1000000) // returns { valid: true }
 * validateFile('script.exe', 1000000) // returns { valid: false, error: 'File type not allowed' }
 * validateFile('large.pdf', 30000000) // returns { valid: false, error: 'File size exceeds 25MB limit' }
 */
export function validateFile(
  filename: string,
  sizeInBytes: number
): ValidationResult {
  if (!validateFileExtension(filename)) {
    return { valid: false, error: 'File type not allowed' };
  }
  if (!validateFileSize(sizeInBytes)) {
    return { valid: false, error: 'File size exceeds 25MB limit' };
  }
  return { valid: true };
}

/**
 * Generates a unique storage path for a file to prevent collisions.
 * Path format: {entityType}/{entityId}/{safeName}_{timestamp}.{ext}
 *
 * @param entityType - The type of entity the file is attached to ('qmrl' or 'qmhq')
 * @param entityId - The UUID of the entity
 * @param filename - The original filename
 * @returns The generated storage path
 *
 * @example
 * generateStoragePath('qmrl', '123e4567-e89b-12d3-a456-426614174000', 'My Document.pdf')
 * // returns 'qmrl/123e4567-e89b-12d3-a456-426614174000/My_Document_1706400000000.pdf'
 */
export function generateStoragePath(
  entityType: 'qmrl' | 'qmhq',
  entityId: string,
  filename: string
): string {
  // Add timestamp to prevent collisions while preserving original name in metadata
  const timestamp = Date.now();
  const ext = getFileExtension(filename);
  const lastDotIndex = filename.lastIndexOf('.');
  const baseName = lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;
  // Sanitize baseName for safe path (remove special chars but keep readability)
  const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
  return `${entityType}/${entityId}/${safeName}_${timestamp}${ext}`;
}

/**
 * Gets the MIME type for a file based on its extension.
 *
 * @param filename - The filename to get MIME type for
 * @returns The MIME type string, or 'application/octet-stream' if unknown
 *
 * @example
 * getMimeType('document.pdf') // returns 'application/pdf'
 * getMimeType('unknown.xyz') // returns 'application/octet-stream'
 */
export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * Formats a file size in bytes to a human-readable string.
 *
 * @param bytes - The file size in bytes
 * @returns Formatted string (e.g., '1.5 MB', '256 KB')
 *
 * @example
 * formatFileSize(0) // returns '0 B'
 * formatFileSize(1536) // returns '1.5 KB'
 * formatFileSize(1048576) // returns '1 MB'
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Gets the human-readable list of allowed file types for display.
 *
 * @returns A formatted string listing allowed extensions
 *
 * @example
 * getAllowedTypesDisplay() // returns 'JPG, JPEG, PNG, GIF, WEBP, PDF, DOCX, XLSX, PPTX, DOC, XLS, PPT'
 */
export function getAllowedTypesDisplay(): string {
  return ALLOWED_EXTENSIONS.map((ext) => ext.slice(1).toUpperCase()).join(', ');
}
