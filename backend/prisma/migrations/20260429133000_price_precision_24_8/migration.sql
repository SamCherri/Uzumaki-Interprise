ALTER TABLE "Company"
  ALTER COLUMN "initialPrice" TYPE DECIMAL(24,8),
  ALTER COLUMN "currentPrice" TYPE DECIMAL(24,8),
  ALTER COLUMN "fictitiousMarketCap" TYPE DECIMAL(24,8);

ALTER TABLE "CompanyHolding"
  ALTER COLUMN "averageBuyPrice" TYPE DECIMAL(24,8),
  ALTER COLUMN "estimatedValue" TYPE DECIMAL(24,8);

ALTER TABLE "CompanyOperation"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(24,8);

ALTER TABLE "MarketOrder"
  ALTER COLUMN "limitPrice" TYPE DECIMAL(24,8);

ALTER TABLE "Trade"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(24,8);

ALTER TABLE "CompanyBoostInjection"
  ALTER COLUMN "priceBefore" TYPE DECIMAL(24,8),
  ALTER COLUMN "priceAfter" TYPE DECIMAL(24,8);
