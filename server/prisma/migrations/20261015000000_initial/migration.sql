-- MySQL >= 8.0.16. Generated with Prisma 6.19.3, then reviewed.
-- Manual additions: InnoDB, ASCII binary code/token collations and three CHECK constraints.
-- No existing table/data is dropped or modified; apply only to the acknowledged empty schema.

-- CreateTable
CREATE TABLE `departments` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_code_key`(`code`),
    UNIQUE INDEX `departments_name_key`(`name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designations` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `department_id` INTEGER UNSIGNED NOT NULL,
    `code` VARCHAR(30) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `designations_code_key`(`code`),
    UNIQUE INDEX `designations_department_id_name_key`(`department_id`, `name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `countries` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` CHAR(2) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `countries_code_key`(`code`),
    UNIQUE INDEX `countries_name_key`(`name`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `currencies` (
    `code` CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `employee_code` VARCHAR(50) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `designation_id` INTEGER UNSIGNED NOT NULL,
    `country_id` INTEGER UNSIGNED NOT NULL,
    `hire_date` DATE NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_employee_code_key`(`employee_code`),
    INDEX `employees_is_active_id_idx`(`is_active`, `id`),
    INDEX `employees_country_id_is_active_id_idx`(`country_id`, `is_active`, `id`),
    INDEX `employees_designation_id_is_active_id_idx`(`designation_id`, `is_active`, `id`),
    INDEX `employees_name_id_idx`(`name`, `id`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `salary_records` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `employee_id` INTEGER UNSIGNED NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `currency_code` CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `effective_date` DATE NOT NULL,
    `created_by` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `salary_records_currency_code_idx`(`currency_code`),
    INDEX `salary_records_created_by_idx`(`created_by`),
    UNIQUE INDEX `salary_records_employee_id_effective_date_key`(`employee_id`, `effective_date`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exchange_rates` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `currency_code` CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `effective_date` DATE NOT NULL,
    `units_per_usd` DECIMAL(24, 12) NOT NULL,
    `source` VARCHAR(200) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `exchange_rates_currency_code_effective_date_key`(`currency_code`, `effective_date`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(254) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `token_hash` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `user_id` INTEGER UNSIGNED NOT NULL,
    `csrf_token` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `designations` ADD CONSTRAINT `designations_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_designation_id_fkey` FOREIGN KEY (`designation_id`) REFERENCES `designations`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_country_id_fkey` FOREIGN KEY (`country_id`) REFERENCES `countries`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `salary_records` ADD CONSTRAINT `salary_records_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `salary_records` ADD CONSTRAINT `salary_records_currency_code_fkey` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `salary_records` ADD CONSTRAINT `salary_records_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `exchange_rates` ADD CONSTRAINT `exchange_rates_currency_code_fkey` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Prisma cannot represent these CHECK constraints in schema.prisma.
ALTER TABLE `salary_records`
  ADD CONSTRAINT `salary_records_amount_nonnegative` CHECK (`amount` >= 0);
ALTER TABLE `exchange_rates`
  ADD CONSTRAINT `exchange_rates_positive` CHECK (`units_per_usd` > 0),
  ADD CONSTRAINT `exchange_rates_usd_identity` CHECK (`currency_code` <> 'USD' OR `units_per_usd` = 1);
