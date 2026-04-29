INSERT INTO "UserRole" ("userId", "roleId")
SELECT DISTINCT c."founderUserId", r."id"
FROM "Company" c
JOIN "Role" r ON r."key" = 'BUSINESS_OWNER'
WHERE c."status" IN ('ACTIVE', 'SUSPENDED', 'CLOSED')
ON CONFLICT ("userId", "roleId") DO NOTHING;
