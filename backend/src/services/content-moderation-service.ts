import { prisma } from '../lib/prisma.js';
import { FORBIDDEN_WORDS, RESERVED_NAME_TERMS, RESERVED_TICKERS, SUSPICIOUS_LINK_PATTERNS } from '../config/content-moderation.js';

export function normalizeModerationText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\-_./]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateTickerAllowed(ticker: string): void {
  const normalizedTicker = normalizeModerationText(ticker).replace(/\s+/g, '').toUpperCase();
  if (!normalizedTicker) return;

  if (RESERVED_TICKERS.includes(normalizedTicker as (typeof RESERVED_TICKERS)[number])) {
    throw new Error('Ticker reservado. Escolha outro identificador.');
  }

  if (
    (normalizedTicker.includes('RPC') && normalizedTicker.includes('EXCHANGE'))
    || normalizedTicker.startsWith('ADMIN')
    || normalizedTicker.startsWith('ADM')
    || normalizedTicker.includes('BANCO')
    || normalizedTicker.includes('TESOURARIA')
    || normalizedTicker.includes('EXCHANGE')
  ) {
    throw new Error('Ticker reservado. Escolha outro identificador.');
  }
}

export function validatePublicNameAllowed(name: string, _context?: string): void {
  const normalizedName = normalizeModerationText(name);
  if (!normalizedName) return;

  const hasReservedTerm = RESERVED_NAME_TERMS.some((term) => normalizedName.includes(normalizeModerationText(term)));
  if (hasReservedTerm) {
    throw new Error('Nome reservado ou parecido com autoridade oficial. Escolha outro nome.');
  }
}

export function validateDescriptionAllowed(description: string): void {
  const normalizedDescription = normalizeModerationText(description);

  const hasSuspiciousLink = SUSPICIOUS_LINK_PATTERNS.some((pattern) => description.toLowerCase().includes(pattern));
  if (hasSuspiciousLink) {
    throw new Error('Descrições não podem conter links externos.');
  }

  const hasForbiddenWord = FORBIDDEN_WORDS.some((word) => normalizedDescription.includes(normalizeModerationText(word)));
  if (hasForbiddenWord) {
    throw new Error('Descrição contém termo não permitido.');
  }
}

export async function validateRpAccountUnique(value: string, currentUserId?: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return;

  const existing = await prisma.user.findFirst({
    where: {
      bankAccountNumber: { equals: trimmed, mode: 'insensitive' },
      ...(currentUserId ? { id: { not: currentUserId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new Error('Conta RP já está em uso por outro usuário.');
  }
}
