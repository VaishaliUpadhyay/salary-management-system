-- OPERATOR TEMPLATE: never run automatically. Replace the database/login after review.
-- First create a NEW Aiven user using mysql_grants: [] via its API.
-- Inspect SHOW GRANTS: reject any broad grant/role before applying these grants.
-- An authorized provisioning account must have the necessary grant rights.
-- No CREATE ROLE, SUPER, root, or access to mysql.* is assumed.
-- MySQL grants are additive. Do not apply this to an admin/default service user.
GRANT SELECT, INSERT, UPDATE ON `salary_management_demo`.`employees` TO 'salary_runtime'@'%';
GRANT SELECT ON `salary_management_demo`.`departments` TO 'salary_runtime'@'%';
GRANT SELECT ON `salary_management_demo`.`designations` TO 'salary_runtime'@'%';
GRANT SELECT ON `salary_management_demo`.`countries` TO 'salary_runtime'@'%';
GRANT SELECT, INSERT ON `salary_management_demo`.`salary_records` TO 'salary_runtime'@'%';
GRANT SELECT ON `salary_management_demo`.`currencies` TO 'salary_runtime'@'%';
GRANT SELECT ON `salary_management_demo`.`exchange_rates` TO 'salary_runtime'@'%';
GRANT SELECT ON `salary_management_demo`.`users` TO 'salary_runtime'@'%';
GRANT SELECT, INSERT, DELETE ON `salary_management_demo`.`sessions` TO 'salary_runtime'@'%';
-- Verify under the runtime account: both statements MUST fail with MySQL 1142.
-- EXPLAIN UPDATE salary_records SET amount=amount WHERE 1=0;
-- EXPLAIN DELETE FROM salary_records WHERE 1=0;
