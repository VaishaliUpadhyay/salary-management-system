-- OPERATOR TEMPLATE ONLY. Not run by Prisma migrations or seed.
-- Review the database name and run as an authorized administrator after migration.
-- Provision the runtime login separately, without putting its password in this file.
-- Grant this role and SET DEFAULT ROLE for that login. Ensure it has NO additional
-- broad/schema/global privileges: MySQL grants are additive, not deny rules.
CREATE ROLE IF NOT EXISTS 'salary_runtime';
GRANT SELECT, INSERT, UPDATE ON `salary_management_dev`.`departments` TO 'salary_runtime';
GRANT SELECT, INSERT, UPDATE ON `salary_management_dev`.`designations` TO 'salary_runtime';
GRANT SELECT, INSERT, UPDATE ON `salary_management_dev`.`countries` TO 'salary_runtime';
GRANT SELECT, INSERT, UPDATE ON `salary_management_dev`.`employees` TO 'salary_runtime';
GRANT SELECT, INSERT ON `salary_management_dev`.`salary_records` TO 'salary_runtime';
GRANT SELECT ON `salary_management_dev`.`currencies` TO 'salary_runtime';
GRANT SELECT ON `salary_management_dev`.`exchange_rates` TO 'salary_runtime';
GRANT SELECT ON `salary_management_dev`.`users` TO 'salary_runtime';
GRANT SELECT, INSERT, DELETE ON `salary_management_dev`.`sessions` TO 'salary_runtime';
