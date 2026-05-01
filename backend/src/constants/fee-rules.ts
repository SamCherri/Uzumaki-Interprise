export const PLATFORM_FEE_SHARE_PERCENT = 50;
export const COMPANY_FEE_SHARE_PERCENT = 50;

const FEE_SHARE_SUM = PLATFORM_FEE_SHARE_PERCENT + COMPANY_FEE_SHARE_PERCENT;

if (FEE_SHARE_SUM !== 100) {
  throw new Error(`Configuração inválida de taxa: plataforma (${PLATFORM_FEE_SHARE_PERCENT}%) + empresa (${COMPANY_FEE_SHARE_PERCENT}%) deve somar 100%.`);
}

export const RPC_MARKET_BUY_FEE_PERCENT = 1;
export const RPC_MARKET_SELL_FEE_PERCENT = 1;
